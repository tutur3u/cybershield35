import { cachedData } from "@/lib/cache/data";
import "server-only";

import { and, asc, eq, gt, ne } from "drizzle-orm";

import type {
	RelatedEvidenceItem,
	RelatedEvidenceResponse,
} from "@/components/dashboard/types";
import {
	DASHBOARD_INTELLIGENCE_TAG,
	dashboardIntelligenceTag,
} from "@/lib/dashboard/cache-tags";
import { cosineSimilarity } from "@/lib/db/vector-similarity";
import { inJsonArray } from "@/lib/db/sqlite-lists";
import { adminDb } from "@/lib/db/client";
import {
	evidenceItems,
	evidenceSemanticProfiles,
	evidenceTriage,
	facebookPageProfiles,
} from "@/lib/db/schema";
import {
	LOCAL_EVIDENCE_EMBEDDING_MODEL,
	LOCAL_RELATED_EVIDENCE_MIN_RELEVANCE,
	RELATED_EVIDENCE_MIN_RELEVANCE,
	rankEvidenceRelationship,
} from "@/lib/domain/evidence-semantics";
import {
	effectivePublishedAt,
	facebookPageProfileJoin,
	timelinePostSelection,
	topicsForEvidence,
} from "@/lib/dashboard/timeline-shared";
import { mapTimelinePost } from "@/lib/dashboard/timeline-mapping";

export async function listRelatedEvidence(
	evidenceId: string,
	limit = 6,
): Promise<RelatedEvidenceResponse> {
	return getCachedRelatedEvidence(evidenceId, limit);
}

async function getCachedRelatedEvidence(
	evidenceId: string,
	limit: number,
): Promise<RelatedEvidenceResponse> {
 return cachedData("lib/dashboard/timeline-related.ts:getCachedRelatedEvidence", [evidenceId, limit], {revalidate: 300, tags: [DASHBOARD_INTELLIGENCE_TAG, dashboardIntelligenceTag("evidence")]}, async () => {
const targetRows = await adminDb
		.select({
			author: evidenceItems.author,
			createdAt: evidenceItems.createdAt,
			embedding: evidenceSemanticProfiles.embedding,
			model: evidenceSemanticProfiles.model,
			publishedAt: evidenceItems.publishedAt,
			quote: evidenceItems.quote,
			sourceUrl: evidenceItems.sourceUrl,
			summary: evidenceItems.summary,
			updatedAt: evidenceSemanticProfiles.updatedAt,
		})
		.from(evidenceSemanticProfiles)
		.innerJoin(
			evidenceItems,
			eq(evidenceItems.id, evidenceSemanticProfiles.evidenceItemId),
		)
		.where(eq(evidenceSemanticProfiles.evidenceItemId, evidenceId))
		.limit(1);
const target = targetRows[0];
if (!target) {
		return {
			generatedAt: null,
			items: [],
			model: null,
			profileReady: false,
		};
	}
const minimumRelevance =
		target.model === LOCAL_EVIDENCE_EMBEDDING_MODEL
			? LOCAL_RELATED_EVIDENCE_MIN_RELEVANCE
			: RELATED_EVIDENCE_MIN_RELEVANCE;
const candidateFloor = Math.max(0.5, minimumRelevance - 0.14);
const candidateLimit = Math.max(limit * 12, 72);
let cursor: string | undefined;
let candidates: { id: string; score: number; publishedAt: number }[] = [];
for (;;) {
		const profiles = await adminDb.select({
			id: evidenceSemanticProfiles.evidenceItemId,
			embedding: evidenceSemanticProfiles.embedding,
			publishedAt: effectivePublishedAt,
		}).from(evidenceSemanticProfiles)
			.innerJoin(evidenceItems, eq(evidenceItems.id, evidenceSemanticProfiles.evidenceItemId))
			.where(and(eq(evidenceSemanticProfiles.model, target.model), ne(evidenceItems.id, evidenceId),
				cursor ? gt(evidenceSemanticProfiles.evidenceItemId, cursor) : undefined))
			.orderBy(asc(evidenceSemanticProfiles.evidenceItemId)).limit(200);
		for (const profile of profiles) {
			const score = cosineSimilarity(target.embedding, profile.embedding);
			if (score >= candidateFloor) candidates.push({id: profile.id, score, publishedAt: profile.publishedAt.getTime()});
		}
		candidates = candidates.sort((a,b) => b.score-a.score || b.publishedAt-a.publishedAt || a.id.localeCompare(b.id)).slice(0,candidateLimit);
		if (profiles.length < 200) break;
		cursor = profiles.at(-1)!.id;
	}
const scores = new Map(candidates.map(candidate => [candidate.id, candidate.score]));
const matches = candidates.length ? await adminDb.select(timelinePostSelection)
		.from(evidenceItems)
		.leftJoin(evidenceTriage, eq(evidenceTriage.evidenceItemId, evidenceItems.id))
		.leftJoin(facebookPageProfiles, facebookPageProfileJoin)
		.where(inJsonArray(evidenceItems.id, candidates.map(candidate => candidate.id))) : [];
const rows = matches.map(row => ({...row, semanticSimilarity: scores.get(row.id)!}));
const topicMap = await topicsForEvidence(rows.map((row) => row.id));
const targetTopicSlugs =
		(await topicsForEvidence([evidenceId])).get(evidenceId) ?? [];
const targetTopics = new Set(targetTopicSlugs);
const rankedRows = rows
		.map((row) => {
			const topicSlugs = topicMap.get(row.id) ?? [];
			const post = mapTimelinePost(row, topicSlugs);
			const rank = rankEvidenceRelationship(
				{
					author: target.author,
					publishedAt: (target.publishedAt ?? target.createdAt).toISOString(),
					quote: target.quote,
					sourceUrl: target.sourceUrl,
					summary: target.summary,
					topicSlugs: targetTopicSlugs,
				},
				{
					author: post.author,
					publishedAt: post.publishedAt ?? post.createdAt,
					quote: post.quote,
					sourceUrl: post.sourceUrl,
					summary: post.summary,
					topicSlugs,
				},
				Number(row.semanticSimilarity),
			);
			return {
				...post,
				reasons: rank.reasons,
				relevance: rank.score,
				relationship: rank.relationship,
				semanticSimilarity: rank.semanticSimilarity,
				sharedTopics: topicSlugs.filter((slug) => targetTopics.has(slug)),
			} satisfies RelatedEvidenceItem;
		})
		.filter((item) => item.relevance >= minimumRelevance)
		.toSorted(
			(left, right) =>
				right.relevance - left.relevance ||
				right.semanticSimilarity - left.semanticSimilarity ||
				new Date(right.publishedAt ?? right.createdAt).getTime() -
					new Date(left.publishedAt ?? left.createdAt).getTime(),
		);
const seenUrls = new Set<string>();
const seenQuotes = new Set<string>();
const items: RelatedEvidenceItem[] = [];
for (const item of rankedRows) {
		const normalizedQuote = item.quote.trim().toLocaleLowerCase("vi");
		if (
			(item.sourceUrl && seenUrls.has(item.sourceUrl)) ||
			seenQuotes.has(normalizedQuote)
		) {
			continue;
		}
		if (item.sourceUrl) seenUrls.add(item.sourceUrl);
		seenQuotes.add(normalizedQuote);
		items.push(item);
		if (items.length >= limit) break;
	}
return {
		generatedAt: target.updatedAt.toISOString(),
		items,
		model: target.model,
		profileReady: true,
	};
 });
}
