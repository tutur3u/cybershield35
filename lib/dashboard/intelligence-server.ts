import "server-only";

import { and, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import type {
	IntelligenceActivityRow,
	IntelligenceClaimRow,
	IntelligenceEvidenceRow,
	IntelligenceFilters,
	IntelligenceFacebookPageOption,
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
	draftAutomationJobs,
	facebookPageProfiles,
	intelligenceActivityRollups,
	intelligenceClaimIndex,
	intelligenceDailyRollups,
	intelligenceProviderRollups,
	intelligenceSourceRollups,
	intelligenceTopicRollups,
	providerRuns,
	trackedSources,
	topics,
	type ProviderName,
	type RiskLevel,
} from "@/lib/db/schema";
import { facebookPageIdentity } from "@/lib/domain/facebook-page-policy";
import {
	DASHBOARD_INTELLIGENCE_TAG,
	dashboardIntelligenceTag,
} from "@/lib/dashboard/cache-tags";

const DEFAULT_PAGE_LIMIT = 25;
const MAX_PAGE_LIMIT = 80;

export async function getIntelligenceOverview(
	filters: IntelligenceFilters = {},
): Promise<IntelligenceOverviewView> {
	return getCachedIntelligenceOverview(normalizeFilters(filters));
}

async function getCachedIntelligenceOverview(filters: NormalizedFilters) {
	"use cache";
	cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
	cacheTag(DASHBOARD_INTELLIGENCE_TAG, dashboardIntelligenceTag("overview"));

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
		approvedDraftRate: Math.round(
			(totals.approvedDrafts / Math.max(1, totals.draftCount)) * 100,
		),
		draftCount: totals.draftCount,
		label:
			totals.reportReadyCount > 0
				? "Sẵn sàng báo cáo"
				: "Cần thêm bằng chứng",
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
	return getCachedIntelligenceEvidence(
		normalizeFilters(filters),
		normalizePageLimit(limit),
		normalizeOffsetCursor(cursor),
	);
}

async function getCachedIntelligenceEvidence(
	normalized: NormalizedFilters,
	pageLimit: number,
	offset: number,
): Promise<IntelligencePage<IntelligenceEvidenceRow>> {
	"use cache";
	cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
	cacheTag(
		DASHBOARD_INTELLIGENCE_TAG,
		dashboardIntelligenceTag("evidence"),
	);

	const conditions = [
		timeCondition(evidenceItems.createdAt, normalized),
		facebookEvidenceCondition(normalized),
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
			facebookPageId: sql<string | null>`${evidenceItems.metadata}->>'facebookId'`,
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
			facebookPageId: row.facebookPageId,
			facebookUsername: facebookUsernameFromEvidence(row.author, row.sourceUrl),
			href: `/evidence/${row.id}`,
			id: row.id,
			originalPostHref: row.sourceUrl,
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
	return getCachedIntelligenceTopics(
		normalizeFilters(filters),
		normalizePageLimit(limit),
		normalizeOffsetCursor(cursor),
	);
}

async function getCachedIntelligenceTopics(
	normalized: NormalizedFilters,
	pageLimit: number,
	offset: number,
): Promise<IntelligencePage<IntelligenceTopicRow>> {
	"use cache";
	cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
	cacheTag(DASHBOARD_INTELLIGENCE_TAG, dashboardIntelligenceTag("topics"));

	const conditions = [
		facebookTopicCondition(normalized),
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
	return getCachedIntelligenceClaims(
		normalizeFilters(filters),
		normalizePageLimit(limit),
		normalizeOffsetCursor(cursor),
	);
}

async function getCachedIntelligenceClaims(
	normalized: NormalizedFilters,
	pageLimit: number,
	offset: number,
): Promise<IntelligencePage<IntelligenceClaimRow>> {
	"use cache";
	cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
	cacheTag(DASHBOARD_INTELLIGENCE_TAG, dashboardIntelligenceTag("claims"));

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
		normalized.facebookPage
			? sql`${intelligenceClaimIndex.sourceLabels} ? ${normalized.facebookPage}`
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
	return getCachedIntelligenceSources(
		normalizeFilters(filters),
		normalizePageLimit(limit),
		normalizeOffsetCursor(cursor),
	);
}

async function getCachedIntelligenceSources(
	normalized: NormalizedFilters,
	pageLimit: number,
	offset: number,
): Promise<IntelligencePage<IntelligenceSourceRow>> {
	"use cache";
	cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
	cacheTag(DASHBOARD_INTELLIGENCE_TAG, dashboardIntelligenceTag("sources"));

	const conditions = [
		normalized.provider
			? eq(intelligenceSourceRollups.provider, normalized.provider)
			: undefined,
		normalized.status
			? eq(intelligenceSourceRollups.health, normalized.status)
			: undefined,
		normalized.facebookPage
			? ilike(
					intelligenceSourceRollups.sourceLabel,
					`%${normalized.facebookPage}%`,
				)
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

export async function listIntelligenceFacebookPages(): Promise<
	IntelligenceFacebookPageOption[]
> {
	"use cache";
	cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
	cacheTag(
		DASHBOARD_INTELLIGENCE_TAG,
		dashboardIntelligenceTag("facebook-pages"),
	);

	const facebookIdExpr = sql<string | null>`${evidenceItems.metadata}->>'facebookId'`;
	const [evidenceRows, trackedRows, profiles, automationRows] = await Promise.all([
		adminDb
			.select({
				evidenceCount: sql<number>`count(*)::int`,
				facebookId: facebookIdExpr,
				lastSeenAt: sql<Date | null>`max(${evidenceItems.createdAt})`,
				username: evidenceItems.author,
			})
			.from(evidenceItems)
			.where(eq(evidenceItems.provider, "apify_facebook_posts"))
			.groupBy(evidenceItems.author, facebookIdExpr)
			.orderBy(sql`count(*) desc`),
		adminDb
			.select({
				displayName: trackedSources.displayName,
				id: trackedSources.id,
				lastScannedAt: trackedSources.lastScannedAt,
				metadata: trackedSources.metadata,
				normalizedUrl: trackedSources.normalizedUrl,
			})
			.from(trackedSources)
			.where(eq(trackedSources.provider, "apify_facebook_posts"))
			.orderBy(desc(trackedSources.updatedAt)),
		adminDb.select().from(facebookPageProfiles),
		adminDb
			.select({
				completed: sql<number>`count(*) filter (where ${draftAutomationJobs.status} = 'completed')::int`,
				failed: sql<number>`count(*) filter (where ${draftAutomationJobs.status} = 'failed')::int`,
				pageKey: draftAutomationJobs.pageKey,
				pending: sql<number>`count(*) filter (where ${draftAutomationJobs.status} in ('queued', 'running', 'retrying'))::int`,
			})
			.from(draftAutomationJobs)
			.groupBy(draftAutomationJobs.pageKey),
	]);
	const profileByKey = new Map(profiles.map((profile) => [profile.pageKey, profile]));
	const profileByFacebookId = new Map(
		profiles.flatMap((profile) =>
			profile.facebookPageId ? [[profile.facebookPageId, profile] as const] : [],
		),
	);
	const profileByUsername = new Map(
		profiles.flatMap((profile) =>
			profile.username ? [[profile.username, profile] as const] : [],
		),
	);
	const automationByKey = new Map(automationRows.map((row) => [row.pageKey, row]));
	const pagesByKey = new Map<string, IntelligenceFacebookPageOption>();

	for (const row of evidenceRows) {
		const username = cleanFacebookUsername(row.username);
		const identity = facebookPageIdentity({
			author: username,
			facebookPageId: row.facebookId,
		});
		if (!identity.pageKey) continue;
		const profile =
			profileByKey.get(identity.pageKey) ??
			(identity.facebookPageId
				? profileByFacebookId.get(identity.facebookPageId)
				: undefined) ??
			(identity.username ? profileByUsername.get(identity.username) : undefined);
		const pageKey = profile?.pageKey ?? identity.pageKey;
		const automation = automationByKey.get(pageKey);
		const value = username ?? cleanText(row.facebookId) ?? identity.pageKey;
		pagesByKey.set(pageKey, {
			autoDraftEnabled: profile?.autoDraftEnabled ?? false,
			automation: {
				completed: automation?.completed ?? 0,
				failed: automation?.failed ?? 0,
				pending: automation?.pending ?? 0,
			},
			classification: profile?.classification ?? "uncategorized",
			evidenceCount: Number(row.evidenceCount) || 0,
			facebookId: cleanText(row.facebookId),
			href: `/evidence?facebookPage=${encodeURIComponent(value)}`,
			label: username ?? `Facebook ID ${row.facebookId}`,
			lastSeenAt: toIsoOrNull(row.lastSeenAt),
			pageKey,
			sourceUrl: username ? `https://www.facebook.com/${username}` : null,
			trackedSourceId: null,
			username,
			value,
		});
	}

	for (const row of trackedRows) {
		const metadataLabel =
			typeof row.metadata?.label === "string" ? row.metadata.label : null;
		const username =
			cleanFacebookUsername(metadataLabel) ??
			usernameFromFacebookUrl(row.normalizedUrl);
		const identity = facebookPageIdentity({
			author: username,
			sourceUrl: row.normalizedUrl,
		});
		const matchingEvidencePage = [...pagesByKey.values()].find(
			(page) => username && page.username === username,
		);
		const matchingProfile =
			(identity.pageKey ? profileByKey.get(identity.pageKey) : undefined) ??
			(username ? profileByUsername.get(username) : undefined);
		const pageKey =
			matchingEvidencePage?.pageKey ??
			matchingProfile?.pageKey ??
			identity.pageKey ??
			`tracked:${row.id}`;
		const value = username ?? row.id;
		const current = pagesByKey.get(pageKey) ?? matchingEvidencePage;
		const profile = matchingProfile ?? profileByKey.get(pageKey);
		const automation = automationByKey.get(pageKey);
		pagesByKey.set(pageKey, {
			autoDraftEnabled: profile?.autoDraftEnabled ?? false,
			automation: {
				completed: automation?.completed ?? 0,
				failed: automation?.failed ?? 0,
				pending: automation?.pending ?? 0,
			},
			classification: profile?.classification ?? "uncategorized",
			evidenceCount: current?.evidenceCount ?? 0,
			facebookId: current?.facebookId ?? null,
			href: `/evidence?facebookPage=${encodeURIComponent(value)}`,
			label: row.displayName,
			lastSeenAt: current?.lastSeenAt ?? toIsoOrNull(row.lastScannedAt),
			pageKey,
			sourceUrl: row.normalizedUrl,
			trackedSourceId: row.id,
			username,
			value,
		});
	}

	return [...pagesByKey.values()].sort(
		(left, right) =>
			right.evidenceCount - left.evidenceCount ||
			left.label.localeCompare(right.label, "vi"),
	);
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
	return getCachedIntelligenceActivity(
		normalizeFilters(filters),
		normalizePageLimit(limit),
		normalizeOffsetCursor(cursor),
	);
}

async function getCachedIntelligenceActivity(
	normalized: NormalizedFilters,
	pageLimit: number,
	offset: number,
): Promise<IntelligencePage<IntelligenceActivityRow>> {
	"use cache";
	cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
	cacheTag(DASHBOARD_INTELLIGENCE_TAG, dashboardIntelligenceTag("activity"));

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
			description: "Độ phủ scan đã hoàn tất trong khoảng thời gian đang xem.",
			help: "Đo xem pipeline scan có tạo phân tích dùng được hay đang bị kẹt ở trạng thái chờ, chạy hoặc lỗi.",
			href: `/sources?status=completed`,
			id: "scan-throughput",
			label: "Thông lượng scan",
			tone: completion >= 80 ? "success" : completion >= 50 ? "warning" : "danger",
			trendLabel: `${completion}% hoàn tất`,
			value: totals.scanCount.toLocaleString("vi-VN"),
		},
		{
			description: "Bằng chứng rủi ro cao cần ưu tiên xem xét.",
			help: "Đếm bằng chứng được gắn mức rủi ro cao; mở chi tiết để kiểm tra trích dẫn gốc.",
			href: `/evidence?risk=high`,
			id: "risk-posture",
			label: "Tư thế rủi ro",
			tone: highRiskShare > 35 ? "danger" : highRiskShare > 10 ? "warning" : "success",
			trendLabel: `${highRiskShare}% rủi ro cao`,
			value: totals.highRiskEvidenceCount.toLocaleString("vi-VN"),
		},
		{
			description: "Claim đã được lập chỉ mục với liên kết bằng chứng hỗ trợ.",
			help: "Claim được trích xuất từ phân tích có cấu trúc và liên kết ngược về scan/bằng chứng để kiểm toán.",
			href: "/alerts",
			id: "claim-index",
			label: "Chỉ mục claim",
			tone: totals.claimCount > 0 ? "accent" : "neutral",
			trendLabel: `${totals.evidenceCount} bằng chứng`,
			value: totals.claimCount.toLocaleString("vi-VN"),
		},
		{
			description: "Lượt quét đã hoàn tất và có bản nháp được người vận hành duyệt.",
			help: "Chỉ báo sẵn sàng cho báo cáo nội bộ; tỷ lệ đi kèm là số bản nháp đã duyệt trên tổng số bản nháp.",
			href: "/reports",
			id: "report-readiness",
			label: "Sẵn sàng báo cáo",
			tone: readiness.readyReports > 0 ? "success" : "warning",
			trendLabel: `${readiness.approvedDraftRate}% bản nháp đã duyệt`,
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
			body: `${totals.highRiskEvidenceCount} bằng chứng rủi ro cao cần được xem xét.`,
			help: "Mở kho bằng chứng đã lọc để xác nhận citation trước khi dùng claim trong báo cáo.",
			href: "/evidence?risk=high",
			id: "review-high-risk-evidence",
			label: "Duyệt bằng chứng rủi ro cao",
			severity: "high" as RiskLevel,
		});
	}
	if (topClaim) {
		actions.push({
			body: topClaim.claim,
			help: "Claim này có rủi ro cao và đã liên kết bằng chứng. Mở để kiểm tra phần hỗ trợ hoặc tranh chấp.",
			href: topClaim.deepLink,
			id: "inspect-top-claim",
			label: "Kiểm tra claim ưu tiên",
			severity: topClaim.riskLevel,
		});
	}
	if (blockedProvider || blockedSource || totals.failedScanCount > 0) {
		actions.push({
			body: blockedProvider
				? `${providerLabel(blockedProvider.provider)} đang bị chặn.`
				: blockedSource
					? `${blockedSource.sourceLabel} có scan bị chặn.`
					: `${totals.failedScanCount} scan bị lỗi.`,
			help: "Mở sức khỏe nguồn/provider để chạy lại scan lỗi hoặc xử lý cấu hình provider.",
			href: "/sources?status=blocked",
			id: "recover-pipeline",
			label: "Khôi phục pipeline thu thập",
			severity: "medium" as RiskLevel,
		});
	}
	if (!actions.length) {
		actions.push({
			body: "Không có ngoại lệ khẩn cấp trong cửa sổ rollup hiện tại.",
			help: "Giữ lịch scan hoạt động và theo dõi động lượng chủ đề để phát hiện rủi ro mới.",
			href: "/topics",
			id: "monitor-topic-momentum",
			label: "Theo dõi động lượng chủ đề",
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
	facebookPage?: string;
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
		facebookPage: normalizeText(filters.facebookPage),
		provider: normalizeProvider(filters.provider),
		query: normalizeText(filters.query),
		risk: normalizeRisk(filters.risk),
		source: normalizeText(filters.source),
		status: normalizeText(filters.status),
		timeRange: normalizeTimeRange(filters.timeRange),
		topic: normalizeText(filters.topic),
	};
}

function facebookEvidenceCondition(filters: NormalizedFilters) {
	if (!filters.facebookPage) return undefined;
	const value = filters.facebookPage;
	return or(
		eq(evidenceItems.author, value),
		sql`${evidenceItems.metadata}->>'facebookId' = ${value}`,
		ilike(evidenceItems.sourceUrl, `%facebook.com/${value}%`),
	);
}

function facebookTopicCondition(filters: NormalizedFilters) {
	if (!filters.facebookPage) return undefined;
	const value = filters.facebookPage;
	const evidenceCondition = or(
		eq(evidenceItems.author, value),
		sql`${evidenceItems.metadata}->>'facebookId' = ${value}`,
		ilike(evidenceItems.sourceUrl, `%facebook.com/${value}%`),
	);
	return sql`${intelligenceTopicRollups.slug} in (
		select ${topics.slug}
		from ${topics}
		inner join ${evidenceTopics}
			on ${evidenceTopics.topicId} = ${topics.id}
		inner join ${evidenceItems}
			on ${evidenceItems.id} = ${evidenceTopics.evidenceItemId}
		where ${evidenceCondition}
	)`;
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
	if (value === "all") return undefined;
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

function toIso(value: Date | string): string {
	return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toIsoOrNull(value: Date | string | null): string | null {
	return value ? toIso(value) : null;
}

function providerLabel(provider: ProviderName): string {
	const labels: Record<ProviderName, string> = {
		apify_facebook_comments: "Apify bình luận",
		apify_facebook_groups: "Apify nhóm",
		apify_facebook_posts: "Apify bài viết",
		browser_use: "Browser Use",
		firecrawl: "Firecrawl",
		firecrawl_parse: "Firecrawl parse",
		local_text: "Văn bản nội bộ",
	};
	return labels[provider];
}

function facebookUsernameFromEvidence(
	author: string | null,
	sourceUrl: string | null,
): string | null {
	return cleanFacebookUsername(author) ?? usernameFromFacebookUrl(sourceUrl);
}

function usernameFromFacebookUrl(value?: string | null): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		if (!/(^|\.)facebook\.com$/iu.test(url.hostname)) return null;
		return cleanFacebookUsername(url.pathname.split("/").filter(Boolean)[0]);
	} catch {
		return null;
	}
}

function cleanFacebookUsername(value?: string | null): string | null {
	const cleaned = cleanText(value);
	if (!cleaned) return null;
	if (/^\d+$/u.test(cleaned)) return null;
	if (/facebook\.com/iu.test(cleaned)) return usernameFromFacebookUrl(cleaned);
	return cleaned.replace(/^@/u, "");
}

function cleanText(value?: string | null): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed.slice(0, 160) : null;
}
