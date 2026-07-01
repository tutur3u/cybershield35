import "server-only";

import { and, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import type {
	IntelligenceActivityRow,
	IntelligenceClaimRow,
	IntelligenceEvidenceRow,
	IntelligenceFilters,
	IntelligenceHealthState,
	IntelligenceKpi,
	IntelligenceOverviewView,
	IntelligencePage,
	IntelligenceProviderRow,
	IntelligenceReadiness,
	IntelligenceSourceRow,
	IntelligenceTopicRow,
} from "@/components/dashboard/types";
import { adminDb } from "@/lib/db/client";
import {
	evidenceItems,
	evidenceTopics,
	intelligenceActivityRollups,
	intelligenceClaimIndex,
	intelligenceDailyRollups,
	intelligenceProviderRollups,
	intelligenceSourceRollups,
	intelligenceTopicRollups,
	providerRuns,
	topics,
	type ProviderName,
	type RiskLevel,
} from "@/lib/db/schema";
import { DASHBOARD_INTELLIGENCE_TAG } from "@/lib/dashboard/cache-tags";

const DEFAULT_PAGE_LIMIT = 25;
const MAX_PAGE_LIMIT = 80;

export async function getIntelligenceOverview(
	filters: IntelligenceFilters = {},
): Promise<IntelligenceOverviewView> {
	return getCachedIntelligenceOverview(normalizeFilters(filters));
}

async function getCachedIntelligenceOverview(filters: NormalizedFilters) {
	"use cache";
	cacheLife({ stale: 30, revalidate: 10, expire: 180 });
	cacheTag(DASHBOARD_INTELLIGENCE_TAG);

	const [dailyRows, topTopics, topEvidence, topClaims, sourceHealth, providerHealth] =
		await Promise.all([
			getDailyTrend(filters),
			listIntelligenceTopics({ filters, limit: 8 }),
			listIntelligenceEvidence({ filters, limit: 6 }),
			listIntelligenceClaims({ filters, limit: 6 }),
			listIntelligenceSources({ filters, limit: 8 }),
			listProviderHealth(),
		]);
	const totals = dailyRows.reduce(
		(acc, row) => ({
			approvedDrafts: acc.approvedDrafts + row.approvedDraftCount,
			claimCount: acc.claimCount + row.claimCount,
			completedScanCount: acc.completedScanCount + row.completedScanCount,
			draftCount: acc.draftCount + row.draftCount,
			evidenceCount: acc.evidenceCount + row.evidenceCount,
			failedScanCount: acc.failedScanCount + row.failedScanCount,
			highRiskEvidenceCount:
				acc.highRiskEvidenceCount + row.highRiskEvidenceCount,
			reportReadyCount: acc.reportReadyCount + row.reportReadyCount,
			scanCount: acc.scanCount + row.scanCount,
		}),
		{
			approvedDrafts: 0,
			claimCount: 0,
			completedScanCount: 0,
			draftCount: 0,
			evidenceCount: 0,
			failedScanCount: 0,
			highRiskEvidenceCount: 0,
			reportReadyCount: 0,
			scanCount: 0,
		},
	);
	const readiness: IntelligenceReadiness = {
		approvedDrafts: totals.approvedDrafts,
		citationCoverage:
			totals.evidenceCount > 0
				? Math.round((totals.approvedDrafts / Math.max(1, totals.draftCount)) * 100)
				: 0,
		draftCount: totals.draftCount,
		label: totals.reportReadyCount > 0 ? "Ready for briefing" : "Needs evidence",
		readyReports: totals.reportReadyCount,
	};

	return {
		actions: buildActionItems({
			claims: topClaims.items,
			providers: providerHealth,
			sources: sourceHealth.items,
			totals,
		}),
		filters,
		generatedAt: new Date().toISOString(),
		kpis: buildKpis(totals, readiness),
		providerHealth,
		readiness,
		sourceHealth: sourceHealth.items,
		topClaims: topClaims.items,
		topEvidence: topEvidence.items,
		topTopics: topTopics.items,
		trends: dailyRows.map((row) => ({
			day: row.day,
			evidence: row.evidenceCount,
			highRisk: row.highRiskEvidenceCount,
			scans: row.scanCount,
		})),
	} satisfies IntelligenceOverviewView;
}

export async function listIntelligenceEvidence({
	cursor,
	filters,
	limit,
}: {
	cursor?: string | null;
	filters?: IntelligenceFilters;
	limit?: number;
} = {}): Promise<IntelligencePage<IntelligenceEvidenceRow>> {
	const normalized = normalizeFilters(filters);
	const pageLimit = normalizePageLimit(limit);
	const offset = normalizeOffsetCursor(cursor);
	const conditions = [
		timeCondition(evidenceItems.createdAt, normalized),
		normalized.risk && normalized.risk !== "all"
			? eq(evidenceItems.riskLevel, normalized.risk)
			: undefined,
		normalized.provider ? eq(evidenceItems.provider, normalized.provider) : undefined,
		normalized.source
			? or(
					ilike(evidenceItems.sourceLabel, `%${normalized.source}%`),
					ilike(evidenceItems.sourceUrl, `%${normalized.source}%`),
				)
			: undefined,
		normalized.query
			? or(
					ilike(evidenceItems.quote, `%${normalized.query}%`),
					ilike(evidenceItems.summary, `%${normalized.query}%`),
					ilike(evidenceItems.sourceLabel, `%${normalized.query}%`),
				)
			: undefined,
		normalized.topic ? eq(topics.slug, normalized.topic) : undefined,
	].filter(Boolean);
	const rows = await adminDb
		.select({
			author: evidenceItems.author,
			createdAt: evidenceItems.createdAt,
			id: evidenceItems.id,
			provider: evidenceItems.provider,
			publishedAt: evidenceItems.publishedAt,
			quote: evidenceItems.quote,
			riskLevel: evidenceItems.riskLevel,
			scanJobId: evidenceItems.scanJobId,
			sentiment: evidenceItems.sentiment,
			sourceLabel: evidenceItems.sourceLabel,
			sourceUrl: evidenceItems.sourceUrl,
			stance: evidenceItems.stance,
			summary: evidenceItems.summary,
		})
		.from(evidenceItems)
		.leftJoin(evidenceTopics, eq(evidenceTopics.evidenceItemId, evidenceItems.id))
		.leftJoin(topics, eq(topics.id, evidenceTopics.topicId))
		.where(conditions.length ? and(...conditions) : undefined)
		.groupBy(evidenceItems.id)
		.orderBy(desc(evidenceItems.createdAt))
		.limit(pageLimit + 1)
		.offset(offset);
	const pageRows = rows.slice(0, pageLimit);
	const topicMap = await topicsForEvidence(pageRows.map((row) => row.id));

	return {
		hasNextPage: rows.length > pageLimit,
		items: pageRows.map((row) => ({
			author: row.author,
			createdAt: toIso(row.createdAt),
			href: `/evidence/${row.id}`,
			id: row.id,
			provider: row.provider,
			publishedAt: toIsoOrNull(row.publishedAt),
			quote: row.quote,
			riskLevel: row.riskLevel,
			scanHref: `/scans/${row.scanJobId}`,
			scanId: row.scanJobId,
			sentiment: row.sentiment,
			sourceLabel: row.sourceLabel,
			sourceUrl: row.sourceUrl,
			stance: row.stance,
			summary: row.summary,
			topicSlugs: topicMap.get(row.id) ?? [],
		})),
		limit: pageLimit,
		nextCursor: rows.length > pageLimit ? String(offset + pageLimit) : null,
	};
}

export async function listIntelligenceTopics({
	cursor,
	filters,
	limit,
}: {
	cursor?: string | null;
	filters?: IntelligenceFilters;
	limit?: number;
} = {}): Promise<IntelligencePage<IntelligenceTopicRow>> {
	const normalized = normalizeFilters(filters);
	const pageLimit = normalizePageLimit(limit);
	const offset = normalizeOffsetCursor(cursor);
	const conditions = [
		normalized.risk && normalized.risk !== "all"
			? eq(intelligenceTopicRollups.riskLevel, normalized.risk)
			: undefined,
		normalized.topic ? eq(intelligenceTopicRollups.slug, normalized.topic) : undefined,
		normalized.query
			? or(
					ilike(intelligenceTopicRollups.name, `%${normalized.query}%`),
					ilike(intelligenceTopicRollups.slug, `%${normalized.query}%`),
				)
			: undefined,
	].filter(Boolean);
	const rows = await adminDb
		.select()
		.from(intelligenceTopicRollups)
		.where(conditions.length ? and(...conditions) : undefined)
		.orderBy(
			desc(intelligenceTopicRollups.momentumScore),
			desc(intelligenceTopicRollups.evidenceCount),
		)
		.limit(pageLimit + 1)
		.offset(offset);

	return {
		hasNextPage: rows.length > pageLimit,
		items: rows.slice(0, pageLimit).map((row) => ({
			claimCount: row.claimCount,
			evidenceCount: row.evidenceCount,
			firstSeenAt: toIsoOrNull(row.firstSeenAt),
			highRiskEvidenceCount: row.highRiskEvidenceCount,
			href: `/topics/${row.slug}`,
			id: row.topicId,
			lastSeenAt: toIsoOrNull(row.lastSeenAt),
			momentumScore: row.momentumScore,
			name: row.name,
			riskLevel: row.riskLevel,
			scanCount: row.scanCount,
			sourceCount: row.sourceCount,
			slug: row.slug,
			trend: row.trend,
		})),
		limit: pageLimit,
		nextCursor: rows.length > pageLimit ? String(offset + pageLimit) : null,
	};
}

export async function listIntelligenceClaims({
	cursor,
	filters,
	limit,
}: {
	cursor?: string | null;
	filters?: IntelligenceFilters;
	limit?: number;
} = {}): Promise<IntelligencePage<IntelligenceClaimRow>> {
	const normalized = normalizeFilters(filters);
	const pageLimit = normalizePageLimit(limit);
	const offset = normalizeOffsetCursor(cursor);
	const conditions = [
		normalized.risk && normalized.risk !== "all"
			? eq(intelligenceClaimIndex.riskLevel, normalized.risk)
			: undefined,
		normalized.query
			? or(
					ilike(intelligenceClaimIndex.claim, `%${normalized.query}%`),
					ilike(intelligenceClaimIndex.stance, `%${normalized.query}%`),
				)
			: undefined,
		normalized.topic
			? sql`${intelligenceClaimIndex.topicSlugs} ? ${normalized.topic}`
			: undefined,
	].filter(Boolean);
	const rows = await adminDb
		.select()
		.from(intelligenceClaimIndex)
		.where(conditions.length ? and(...conditions) : undefined)
		.orderBy(
			desc(intelligenceClaimIndex.riskLevel),
			desc(intelligenceClaimIndex.confidence),
			desc(intelligenceClaimIndex.updatedAt),
		)
		.limit(pageLimit + 1)
		.offset(offset);

	return {
		hasNextPage: rows.length > pageLimit,
		items: rows.slice(0, pageLimit).map((row) => ({
			claim: row.claim,
			claimKey: row.claimKey,
			confidence: row.confidence,
			deepLink: row.deepLink,
			evidenceCount: row.evidenceCount,
			evidenceHrefs: row.evidenceIds.map((id) => `/evidence/${id}`),
			id: row.id,
			riskLevel: row.riskLevel,
			scanHref: row.scanJobId ? `/scans/${row.scanJobId}` : null,
			sourceLabels: row.sourceLabels,
			stance: row.stance,
			topicSlugs: row.topicSlugs,
			updatedAt: toIso(row.updatedAt),
		})),
		limit: pageLimit,
		nextCursor: rows.length > pageLimit ? String(offset + pageLimit) : null,
	};
}

export async function listIntelligenceSources({
	cursor,
	filters,
	limit,
}: {
	cursor?: string | null;
	filters?: IntelligenceFilters;
	limit?: number;
} = {}): Promise<IntelligencePage<IntelligenceSourceRow>> {
	const normalized = normalizeFilters(filters);
	const pageLimit = normalizePageLimit(limit);
	const offset = normalizeOffsetCursor(cursor);
	const conditions = [
		normalized.provider
			? eq(intelligenceSourceRollups.provider, normalized.provider)
			: undefined,
		normalized.status
			? eq(intelligenceSourceRollups.health, normalized.status)
			: undefined,
		normalized.source
			? ilike(intelligenceSourceRollups.sourceLabel, `%${normalized.source}%`)
			: undefined,
		normalized.query
			? ilike(intelligenceSourceRollups.sourceLabel, `%${normalized.query}%`)
			: undefined,
	].filter(Boolean);
	const rows = await adminDb
		.select()
		.from(intelligenceSourceRollups)
		.where(conditions.length ? and(...conditions) : undefined)
		.orderBy(
			desc(intelligenceSourceRollups.highRiskEvidenceCount),
			desc(intelligenceSourceRollups.lastScannedAt),
		)
		.limit(pageLimit + 1)
		.offset(offset);

	return {
		hasNextPage: rows.length > pageLimit,
		items: rows.slice(0, pageLimit).map(toSourceRow),
		limit: pageLimit,
		nextCursor: rows.length > pageLimit ? String(offset + pageLimit) : null,
	};
}

export async function listIntelligenceActivity({
	cursor,
	filters,
	limit,
}: {
	cursor?: string | null;
	filters?: IntelligenceFilters;
	limit?: number;
} = {}): Promise<IntelligencePage<IntelligenceActivityRow>> {
	const normalized = normalizeFilters(filters);
	const pageLimit = normalizePageLimit(limit);
	const offset = normalizeOffsetCursor(cursor);
	const conditions = [
		timeCondition(intelligenceActivityRollups.occurredAt, normalized),
		normalized.risk && normalized.risk !== "all"
			? eq(intelligenceActivityRollups.severity, normalized.risk)
			: undefined,
		normalized.query
			? or(
					ilike(intelligenceActivityRollups.title, `%${normalized.query}%`),
					ilike(intelligenceActivityRollups.description, `%${normalized.query}%`),
				)
			: undefined,
	].filter(Boolean);
	const rows = await adminDb
		.select()
		.from(intelligenceActivityRollups)
		.where(conditions.length ? and(...conditions) : undefined)
		.orderBy(desc(intelligenceActivityRollups.occurredAt))
		.limit(pageLimit + 1)
		.offset(offset);

	return {
		hasNextPage: rows.length > pageLimit,
		items: rows.slice(0, pageLimit).map((row) => ({
			action: row.action,
			description: row.description,
			entityId: row.entityId,
			entityType: row.entityType,
			href: row.href,
			id: row.id,
			occurredAt: toIso(row.occurredAt),
			severity: row.severity,
			title: row.title,
		})),
		limit: pageLimit,
		nextCursor: rows.length > pageLimit ? String(offset + pageLimit) : null,
	};
}

async function getDailyTrend(filters: NormalizedFilters) {
	const conditions = [dailyRangeCondition(filters)].filter(Boolean);
	return adminDb
		.select()
		.from(intelligenceDailyRollups)
		.where(conditions.length ? and(...conditions) : undefined)
		.orderBy(intelligenceDailyRollups.day);
}

async function listProviderHealth(): Promise<IntelligenceProviderRow[]> {
	const rows = await adminDb
		.select()
		.from(intelligenceProviderRollups)
		.orderBy(
			desc(intelligenceProviderRollups.failedRunCount),
			desc(intelligenceProviderRollups.lastRunAt),
		)
		.limit(12);

	if (rows.length) {
		return rows.map((row) => ({
			avgDurationMs: row.avgDurationMs,
			completedRunCount: row.completedRunCount,
			failedRunCount: row.failedRunCount,
			health: normalizeHealth(row.health),
			lastRunAt: toIsoOrNull(row.lastRunAt),
			lastStatus: row.lastStatus,
			provider: row.provider,
			scanCount: row.scanCount,
		}));
	}

	const fallbackRows = await adminDb
		.select({
			lastRunAt: providerRuns.startedAt,
			provider: providerRuns.provider,
			status: providerRuns.status,
		})
		.from(providerRuns)
		.orderBy(desc(providerRuns.startedAt))
		.limit(6);

	return fallbackRows.map((row) => ({
		avgDurationMs: 0,
		completedRunCount: row.status === "completed" ? 1 : 0,
		failedRunCount: row.status === "failed" ? 1 : 0,
		health: row.status === "failed" ? "blocked" : "healthy",
		lastRunAt: toIsoOrNull(row.lastRunAt),
		lastStatus: row.status,
		provider: row.provider,
		scanCount: 1,
	}));
}

async function topicsForEvidence(ids: string[]) {
	if (!ids.length) return new Map<string, string[]>();
	const rows = await adminDb
		.select({
			evidenceItemId: evidenceTopics.evidenceItemId,
			slug: topics.slug,
		})
		.from(evidenceTopics)
		.innerJoin(topics, eq(topics.id, evidenceTopics.topicId))
		.where(inArray(evidenceTopics.evidenceItemId, ids));
	const map = new Map<string, string[]>();
	for (const row of rows) {
		const current = map.get(row.evidenceItemId) ?? [];
		current.push(row.slug);
		map.set(row.evidenceItemId, current);
	}
	return map;
}

function buildKpis(
	totals: {
		claimCount: number;
		completedScanCount: number;
		evidenceCount: number;
		failedScanCount: number;
		highRiskEvidenceCount: number;
		scanCount: number;
	},
	readiness: IntelligenceReadiness,
): IntelligenceKpi[] {
	const completion =
		totals.scanCount > 0
			? Math.round((totals.completedScanCount / totals.scanCount) * 100)
			: 0;
	const highRiskShare =
		totals.evidenceCount > 0
			? Math.round((totals.highRiskEvidenceCount / totals.evidenceCount) * 100)
			: 0;

	return [
		{
			description: "Completed scan coverage in the active time range.",
			help: "Measures whether the scan fleet is producing usable analysis rather than queue or failure states.",
			href: `/sources?status=completed`,
			id: "scan-throughput",
			label: "Scan throughput",
			tone: completion >= 80 ? "success" : completion >= 50 ? "warning" : "danger",
			trendLabel: `${completion}% complete`,
			value: totals.scanCount.toLocaleString("vi-VN"),
		},
		{
			description: "High-risk evidence requiring leadership attention.",
			help: "Counts stored evidence tagged high risk; click through to inspect the underlying citations.",
			href: `/evidence?risk=high`,
			id: "risk-posture",
			label: "Risk posture",
			tone: highRiskShare > 35 ? "danger" : highRiskShare > 10 ? "warning" : "success",
			trendLabel: `${highRiskShare}% high risk`,
			value: totals.highRiskEvidenceCount.toLocaleString("vi-VN"),
		},
		{
			description: "Claims indexed with supporting evidence links.",
			help: "Claims are extracted from structured analyses and linked back to scan/evidence detail for auditability.",
			href: "/alerts",
			id: "claim-index",
			label: "Claim index",
			tone: totals.claimCount > 0 ? "accent" : "neutral",
			trendLabel: `${totals.evidenceCount} evidence items`,
			value: totals.claimCount.toLocaleString("vi-VN"),
		},
		{
			description: "Reports with approved drafts and evidence coverage.",
			help: "A readiness indicator for executive briefings; it improves when approved drafts cite stored evidence.",
			href: "/reports",
			id: "report-readiness",
			label: "Report readiness",
			tone: readiness.readyReports > 0 ? "success" : "warning",
			trendLabel: `${readiness.citationCoverage}% citation coverage`,
			value: readiness.readyReports.toLocaleString("vi-VN"),
		},
	];
}

function buildActionItems({
	claims,
	providers,
	sources,
	totals,
}: {
	claims: IntelligenceClaimRow[];
	providers: IntelligenceProviderRow[];
	sources: IntelligenceSourceRow[];
	totals: { failedScanCount: number; highRiskEvidenceCount: number };
}) {
	const actions = [];
	const blockedProvider = providers.find((provider) => provider.health === "blocked");
	const blockedSource = sources.find((source) => source.health === "blocked");
	const topClaim = claims.find((claim) => claim.riskLevel === "high");

	if (totals.highRiskEvidenceCount > 0) {
		actions.push({
			body: `${totals.highRiskEvidenceCount} high-risk evidence items need review.`,
			help: "Open the filtered vault to confirm citations before using the claim in a report.",
			href: "/evidence?risk=high",
			id: "review-high-risk-evidence",
			label: "Review high-risk evidence",
			severity: "high" as RiskLevel,
		});
	}
	if (topClaim) {
		actions.push({
			body: topClaim.claim,
			help: "This claim has high risk and evidence links. Open it to inspect support and disputes.",
			href: topClaim.deepLink,
			id: "inspect-top-claim",
			label: "Inspect priority claim",
			severity: topClaim.riskLevel,
		});
	}
	if (blockedProvider || blockedSource || totals.failedScanCount > 0) {
		actions.push({
			body: blockedProvider
				? `${providerLabel(blockedProvider.provider)} is blocked.`
				: blockedSource
					? `${blockedSource.sourceLabel} has blocked scans.`
					: `${totals.failedScanCount} scans failed.`,
			help: "Open source and provider health to rerun failed scans or fix the provider configuration.",
			href: "/sources?status=blocked",
			id: "recover-pipeline",
			label: "Recover collection pipeline",
			severity: "medium" as RiskLevel,
		});
	}
	if (!actions.length) {
		actions.push({
			body: "No urgent exception is visible in the current rollup window.",
			help: "Keep the scan schedule active and review topic momentum for emerging risks.",
			href: "/topics",
			id: "monitor-topic-momentum",
			label: "Monitor topic momentum",
			severity: "low" as RiskLevel,
		});
	}

	return actions.slice(0, 4);
}

function toSourceRow(row: typeof intelligenceSourceRollups.$inferSelect): IntelligenceSourceRow {
	return {
		completedScanCount: row.completedScanCount,
		evidenceCount: row.evidenceCount,
		failedScanCount: row.failedScanCount,
		health: normalizeHealth(row.health),
		highRiskEvidenceCount: row.highRiskEvidenceCount,
		href: `/sources?source=${encodeURIComponent(row.sourceLabel)}`,
		lastScanHref: row.lastScanJobId ? `/scans/${row.lastScanJobId}` : null,
		lastScannedAt: toIsoOrNull(row.lastScannedAt),
		provider: row.provider,
		scanCount: row.scanCount,
		sourceId: row.sourceId,
		sourceLabel: row.sourceLabel,
		sourceType: row.sourceType,
	};
}

type NormalizedFilters = {
	provider?: ProviderName;
	query?: string;
	risk?: RiskLevel | "all";
	source?: string;
	status?: string;
	timeRange: "7d" | "30d" | "90d" | "all";
	topic?: string;
};

function normalizeFilters(filters: IntelligenceFilters = {}): NormalizedFilters {
	return {
		provider: normalizeProvider(filters.provider),
		query: normalizeText(filters.query),
		risk: normalizeRisk(filters.risk),
		source: normalizeText(filters.source),
		status: normalizeText(filters.status),
		timeRange: normalizeTimeRange(filters.timeRange),
		topic: normalizeText(filters.topic),
	};
}

function timeCondition<TColumn>(
	column: TColumn,
	filters: NormalizedFilters,
) {
	const from = rangeStart(filters.timeRange);
	return from ? gte(column as never, from) : undefined;
}

function dailyRangeCondition(filters: NormalizedFilters) {
	const from = rangeStart(filters.timeRange);
	return from ? gte(intelligenceDailyRollups.day, from.toISOString().slice(0, 10)) : undefined;
}

function rangeStart(range: NormalizedFilters["timeRange"]) {
	if (range === "all") return null;
	const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function normalizePageLimit(value?: number) {
	const parsed = Math.floor(Number(value ?? DEFAULT_PAGE_LIMIT));
	if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_PAGE_LIMIT;
	return Math.min(parsed, MAX_PAGE_LIMIT);
}

function normalizeOffsetCursor(value?: string | null) {
	if (!value) return 0;
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 0) return 0;
	return Math.floor(parsed);
}

function normalizeProvider(value?: string): ProviderName | undefined {
	const providers: ProviderName[] = [
		"apify_facebook_posts",
		"apify_facebook_comments",
		"apify_facebook_groups",
		"firecrawl",
		"firecrawl_parse",
		"browser_use",
		"local_text",
	];
	return providers.includes(value as ProviderName)
		? (value as ProviderName)
		: undefined;
}

function normalizeRisk(value?: string): RiskLevel | "all" | undefined {
	if (value === "all") return value;
	if (value === "high" || value === "medium" || value === "low") return value;
	return undefined;
}

function normalizeTimeRange(value?: string): NormalizedFilters["timeRange"] {
	if (value === "7d" || value === "30d" || value === "90d" || value === "all") {
		return value;
	}
	return "30d";
}

function normalizeText(value?: string) {
	const trimmed = value?.trim();
	return trimmed ? trimmed.slice(0, 160) : undefined;
}

function normalizeHealth(value: string): IntelligenceHealthState {
	if (
		value === "healthy" ||
		value === "attention" ||
		value === "blocked" ||
		value === "stale" ||
		value === "unseen" ||
		value === "unknown"
	) {
		return value;
	}
	return "unknown";
}

function toIso(value: Date | string) {
	return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toIsoOrNull(value: Date | string | null) {
	return value ? toIso(value) : null;
}

function providerLabel(provider: ProviderName) {
	const labels: Record<ProviderName, string> = {
		apify_facebook_comments: "Apify comments",
		apify_facebook_groups: "Apify groups",
		apify_facebook_posts: "Apify posts",
		browser_use: "Browser Use",
		firecrawl: "Firecrawl",
		firecrawl_parse: "Firecrawl parse",
		local_text: "Local text",
	};
	return labels[provider];
}
