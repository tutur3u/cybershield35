import "server-only";

import { and, cosineDistance, desc, eq, ne, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import type {
	RelatedEvidenceItem,
	RelatedEvidenceResponse,
} from "@/components/dashboard/types";
import {
	DASHBOARD_INTELLIGENCE_TAG,
	dashboardIntelligenceTag,
} from "@/lib/dashboard/cache-tags";
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
	"use cache";
	cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
	cacheTag(
		DASHBOARD_INTELLIGENCE_TAG,
		dashboardIntelligenceTag("evidence"),
	);

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

	const distance = cosineDistance(
		evidenceSemanticProfiles.embedding,
		target.embedding,
	);
	const semanticSimilarity = sql<number>`1 - (${distance})`.mapWith(Number);
	const minimumRelevance =
		target.model === LOCAL_EVIDENCE_EMBEDDING_MODEL
			? LOCAL_RELATED_EVIDENCE_MIN_RELEVANCE
			: RELATED_EVIDENCE_MIN_RELEVANCE;
	const candidateFloor = Math.max(0.5, minimumRelevance - 0.14);
	const rows = await adminDb
		.select({ ...timelinePostSelection, semanticSimilarity })
		.from(evidenceSemanticProfiles)
		.innerJoin(
			evidenceItems,
			eq(evidenceItems.id, evidenceSemanticProfiles.evidenceItemId),
		)
		.leftJoin(evidenceTriage, eq(evidenceTriage.evidenceItemId, evidenceItems.id))
		.leftJoin(facebookPageProfiles, facebookPageProfileJoin)
		.where(
			and(
				ne(evidenceItems.id, evidenceId),
				eq(evidenceSemanticProfiles.model, target.model),
				sql`${distance} <= ${1 - candidateFloor}`,
			),
		)
		.orderBy(distance, desc(effectivePublishedAt))
		.limit(Math.max(limit * 12, 72));
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
}
