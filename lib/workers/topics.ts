import "server-only";

import { desc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import type {
	TopicDetailView,
	TopicsPage,
	TopicView,
} from "@/components/dashboard/types";
import {
	DASHBOARD_TOPICS_TAG,
	dashboardTopicTag,
} from "@/lib/dashboard/cache-tags";
import { adminDb, adminSqlClient } from "@/lib/db/client";
import {
	analyses,
	evidenceItems,
	evidenceTopics,
	scanJobs,
	sources,
	topics,
	type RiskLevel,
} from "@/lib/db/schema";
import {
	inferTopicsForEvidence,
	inferTopicsFromEvidence,
	MIN_TOPIC_CONFIDENCE,
	normalizeTopicName,
	scoreEvidenceForTopic,
	selectEvidenceForTopic,
	topicSlug,
	type TopicEvidenceLike,
	type TopicLike,
} from "@/lib/domain/topics";

const DEFAULT_PAGE_LIMIT = 25;
const MAX_PAGE_LIMIT = 50;

type TopicClusterInput = {
	count?: unknown;
	name?: unknown;
	riskLevel?: unknown;
	trend?: unknown;
};

type TopicEvidenceRow = TopicEvidenceLike & {
	author: string | null;
	createdAt: Date;
	engagement: Record<string, unknown>;
	provider: string;
	publishedAt: Date | null;
	scanJobId: string;
	sentiment: string;
	sourceId: string;
	sourceUrl: string | null;
	stance: string;
};

export async function listTopicsPage(input?: {
	cursor?: string | null;
	limit?: number;
}): Promise<TopicsPage> {
	return getCachedTopicsPage(
		normalizePageLimit(input?.limit),
		normalizeOffsetCursor(input?.cursor),
	);
}

async function getCachedTopicsPage(
	limit: number,
	offset: number,
): Promise<TopicsPage> {
	"use cache";
	cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
	cacheTag(DASHBOARD_TOPICS_TAG);

	const rows = await adminDb
		.select()
		.from(topics)
		.orderBy(desc(topics.evidenceCount), desc(topics.updatedAt))
		.limit(limit + 1)
		.offset(offset);

	const hasNextPage = rows.length > limit;
	return {
		hasNextPage,
		items: rows.slice(0, limit).map(toTopicView),
		limit,
		nextCursor: hasNextPage ? String(offset + limit) : null,
	};
}

export async function getTopicDetailPage(input: {
	cursor?: string | null;
	limit?: number;
	slug: string;
}): Promise<TopicDetailView | null> {
	return getCachedTopicDetailPage(
		input.slug.trim(),
		normalizePageLimit(input.limit),
		normalizeOffsetCursor(input.cursor),
	);
}

async function getCachedTopicDetailPage(
	slug: string,
	limit: number,
	offset: number,
): Promise<TopicDetailView | null> {
	"use cache";
	cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
	cacheTag(DASHBOARD_TOPICS_TAG, dashboardTopicTag(slug));

	const [topic] = await adminDb
		.select()
		.from(topics)
		.where(eq(topics.slug, slug))
		.limit(1);

	if (!topic) return null;

	const rows = await adminDb
		.select({
			author: evidenceItems.author,
			confidence: evidenceTopics.confidence,
			createdAt: evidenceItems.createdAt,
			engagement: evidenceItems.engagement,
			id: evidenceItems.id,
			provider: evidenceItems.provider,
			publishedAt: evidenceItems.publishedAt,
			quote: evidenceItems.quote,
			riskLevel: evidenceItems.riskLevel,
			scanJobId: evidenceItems.scanJobId,
			scanTitle: sources.title,
			sentiment: evidenceItems.sentiment,
			sourceId: evidenceItems.sourceId,
			sourceLabel: evidenceItems.sourceLabel,
			sourceUrl: evidenceItems.sourceUrl,
			stance: evidenceItems.stance,
			summary: evidenceItems.summary,
		})
		.from(evidenceTopics)
		.innerJoin(evidenceItems, eq(evidenceTopics.evidenceItemId, evidenceItems.id))
		.innerJoin(scanJobs, eq(evidenceTopics.scanJobId, scanJobs.id))
		.innerJoin(sources, eq(scanJobs.sourceId, sources.id))
		.where(eq(evidenceTopics.topicId, topic.id))
		.orderBy(
			desc(evidenceTopics.confidence),
			desc(evidenceItems.createdAt),
			desc(evidenceItems.id),
		)
		.limit(limit + 1)
		.offset(offset);

	const hasNextPage = rows.length > limit;
	return {
		...toTopicView(topic),
		evidence: rows.slice(0, limit).map((row) => ({
			author: row.author,
			createdAt: row.createdAt,
			engagement: row.engagement,
			id: row.id,
			provider: row.provider,
			publishedAt: row.publishedAt,
			quote: row.quote,
			riskLevel: row.riskLevel,
			scanJobId: row.scanJobId,
			sentiment: row.sentiment,
			sourceId: row.sourceId,
			sourceLabel: row.sourceLabel ?? row.scanTitle ?? "Nguồn công khai",
			sourceUrl: row.sourceUrl,
			stance: row.stance,
			summary: row.summary,
			topicConfidence: row.confidence,
		})),
		hasNextPage,
		limit,
		nextCursor: hasNextPage ? String(offset + limit) : null,
	};
}

export async function syncTopicsForScan(
	scanId: string,
	topicClusters: unknown,
	evidenceRows?: TopicEvidenceRow[],
) {
	const evidence = evidenceRows ?? (await listEvidenceForTopicSync(scanId));
	const clusters = mergeTopicClusters(
		normalizeTopicClusters(topicClusters),
		inferTopicsFromEvidence(evidence),
	);
	const started = {
		evidenceTagsCreated: 0,
		topicsSeen: clusters.length,
	};

	await adminDb.delete(evidenceTopics).where(eq(evidenceTopics.scanJobId, scanId));
	const topicRecords: Array<{
		cluster: TopicLike;
		topicId: string;
	}> = [];
	const linkedEvidenceIds = new Set<string>();

	for (const cluster of clusters) {
		const now = new Date();
		const slug = topicSlug(cluster.name);
		const [topic] = await adminDb
			.insert(topics)
			.values({
				firstSeenAt: now,
				lastSeenAt: now,
				name: cluster.name,
				riskLevel: cluster.riskLevel,
				slug,
				trend: cluster.trend ?? "stable",
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: topics.slug,
				set: {
					lastSeenAt: now,
					name: cluster.name,
					riskLevel: cluster.riskLevel,
					trend: cluster.trend ?? "stable",
					updatedAt: now,
				},
			})
			.returning();

		if (!topic || !evidence.length) continue;
		topicRecords.push({ cluster, topicId: topic.id });

		const selected = selectEvidenceForTopic(cluster, evidence);
		if (!selected.length) continue;
		for (const { item } of selected) linkedEvidenceIds.add(item.id);

		await adminDb
			.insert(evidenceTopics)
			.values(
				selected.map(({ confidence, item }) => ({
					confidence,
					evidenceItemId: item.id,
					scanJobId: scanId,
					topicId: topic.id,
				})),
			)
			.onConflictDoNothing();
		started.evidenceTagsCreated += selected.length;
	}

	const unlinked = evidence.filter((item) => !linkedEvidenceIds.has(item.id));
	const fallbackTags = unlinked
		.map((item) => {
			const inferredSlugs = new Set(
				inferTopicsForEvidence(item).map((topic) => topicSlug(topic.name)),
			);
			const bestTopic = topicRecords
				.map((record) => ({
					...record,
					confidence: Math.min(
						100,
						scoreEvidenceForTopic(record.cluster, item),
					),
					isInferred: inferredSlugs.has(topicSlug(record.cluster.name)),
				}))
				.filter((record) => record.confidence >= MIN_TOPIC_CONFIDENCE)
				.sort((left, right) => {
					if (left.isInferred !== right.isInferred) {
						return left.isInferred ? -1 : 1;
					}
					return right.confidence - left.confidence;
				})[0];

			return bestTopic
				? {
						confidence: bestTopic.confidence,
						evidenceItemId: item.id,
						scanJobId: scanId,
						topicId: bestTopic.topicId,
					}
				: null;
		})
		.filter((tag) => tag !== null);

	if (fallbackTags.length) {
		await adminDb.insert(evidenceTopics).values(fallbackTags).onConflictDoNothing();
		started.evidenceTagsCreated += fallbackTags.length;
	}

	await refreshTopicCounts();
	return started;
}

export async function syncExistingAnalysisTopicsForScan(scanId: string) {
	const [analysis] = await adminDb
		.select({ topicClusters: analyses.topicClusters })
		.from(analyses)
		.where(eq(analyses.scanJobId, scanId))
		.limit(1);

	if (!analysis) {
		return {
			evidenceTagsCreated: 0,
			topicsSeen: 0,
		};
	}

	return syncTopicsForScan(scanId, analysis.topicClusters);
}

export async function backfillTopicsFromAnalyses() {
	const rows = await adminDb
		.select({
			scanId: analyses.scanJobId,
			topicClusters: analyses.topicClusters,
		})
		.from(analyses);
	const summary = {
		evidenceTagsCreated: 0,
		scansProcessed: 0,
		topicsSeen: 0,
	};

	for (const row of rows) {
		const result = await syncTopicsForScan(row.scanId, row.topicClusters);
		summary.evidenceTagsCreated += result.evidenceTagsCreated;
		summary.topicsSeen += result.topicsSeen;
		summary.scansProcessed += 1;
	}

	await refreshTopicCounts();
	const [counts] = await adminSqlClient<
		Array<{ evidence_tags: number; topics: number }>
	>`
		select
			(select count(*)::int from topics) as topics,
			(select count(*)::int from evidence_topics) as evidence_tags
	`;

	return {
		...summary,
		evidenceTagsTotal: counts?.evidence_tags ?? 0,
		topicsTotal: counts?.topics ?? 0,
	};
}

async function listEvidenceForTopicSync(scanId: string): Promise<TopicEvidenceRow[]> {
	return adminDb
		.select({
			author: evidenceItems.author,
			createdAt: evidenceItems.createdAt,
			engagement: evidenceItems.engagement,
			id: evidenceItems.id,
			provider: evidenceItems.provider,
			publishedAt: evidenceItems.publishedAt,
			quote: evidenceItems.quote,
			riskLevel: evidenceItems.riskLevel,
			scanJobId: evidenceItems.scanJobId,
			sentiment: evidenceItems.sentiment,
			sourceId: evidenceItems.sourceId,
			sourceLabel: evidenceItems.sourceLabel,
			sourceUrl: evidenceItems.sourceUrl,
			stance: evidenceItems.stance,
			summary: evidenceItems.summary,
		})
		.from(evidenceItems)
		.where(eq(evidenceItems.scanJobId, scanId))
		.orderBy(desc(evidenceItems.createdAt));
}

async function refreshTopicCounts() {
	await adminSqlClient`
		update topics as topic
		set
			evidence_count = counted.evidence_count,
			updated_at = now()
		from (
			select topics.id, count(evidence_topics.id)::int as evidence_count
			from topics
			left join evidence_topics on evidence_topics.topic_id = topics.id
			group by topics.id
		) as counted
		where topic.id = counted.id
	`;
	await adminSqlClient`
		delete from topics as topic
		where not exists (
			select 1
			from evidence_topics
			where evidence_topics.topic_id = topic.id
		)
	`;
}

function normalizeTopicClusters(input: unknown): TopicLike[] {
	if (!Array.isArray(input)) return [];
	const deduped = new Map<string, TopicLike>();

	for (const item of input as TopicClusterInput[]) {
		const name =
			typeof item.name === "string" ? normalizeTopicName(item.name) : "";
		if (!name) continue;
		const riskLevel = normalizeRiskLevel(item.riskLevel);
		const slug = topicSlug(name);
		const existing = deduped.get(slug);
		const count = Number(item.count ?? existing?.count ?? 1);
		deduped.set(slug, {
			count: Number.isFinite(count) ? Math.max(1, Math.round(count)) : 1,
			name,
			riskLevel,
			trend: typeof item.trend === "string" ? item.trend : "stable",
		});
	}

	return [...deduped.values()];
}

function mergeTopicClusters(...groups: TopicLike[][]): TopicLike[] {
	const deduped = new Map<string, TopicLike>();

	for (const topic of groups.flat()) {
		const slug = topicSlug(topic.name);
		const existing = deduped.get(slug);
		if (!existing) {
			deduped.set(slug, topic);
			continue;
		}

		deduped.set(slug, {
			count: Math.max(existing.count ?? 1, topic.count ?? 1),
			name: existing.name,
			riskLevel: maxRiskLevel(existing.riskLevel, topic.riskLevel),
			trend: existing.trend ?? topic.trend ?? "stable",
		});
	}

	return [...deduped.values()];
}

function normalizeRiskLevel(value: unknown): RiskLevel {
	if (value === "high" || value === "medium" || value === "low") return value;
	return "medium";
}

function maxRiskLevel(left: RiskLevel, right: RiskLevel): RiskLevel {
	const order: Record<RiskLevel, number> = {
		high: 3,
		low: 1,
		medium: 2,
	};
	return order[left] >= order[right] ? left : right;
}

function toTopicView(row: {
	createdAt: Date;
	evidenceCount: number;
	firstSeenAt: Date;
	id: string;
	lastSeenAt: Date;
	name: string;
	riskLevel: RiskLevel;
	slug: string;
	trend: string;
	updatedAt: Date;
}): TopicView {
	return {
		createdAt: row.createdAt.toISOString(),
		evidenceCount: row.evidenceCount,
		firstSeenAt: row.firstSeenAt.toISOString(),
		id: row.id,
		lastSeenAt: row.lastSeenAt.toISOString(),
		name: row.name,
		riskLevel: row.riskLevel,
		slug: row.slug,
		trend: row.trend,
		updatedAt: row.updatedAt.toISOString(),
	};
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
