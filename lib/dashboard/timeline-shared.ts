import "server-only";

import { eq, inArray, or, sql, type SQL } from "drizzle-orm";

import type { TimelinePost } from "@/components/dashboard/types";
import { adminDb } from "@/lib/db/client";
import {
	evidenceItems,
	evidenceTopics,
	evidenceTriage,
	facebookPageProfiles,
	topics,
	type EvidenceTriageStatus,
} from "@/lib/db/schema";

/**
 * SQL fragments and row mapping shared by every timeline read path: the paged
 * list, the single-post lookup, the head poll and the related-evidence ranking.
 */
export const effectivePublishedAt = sql<Date>`coalesce(${evidenceItems.publishedAt}, ${evidenceItems.createdAt})`.mapWith(
	evidenceItems.createdAt,
);
/**
 * Compares a timestamp expression against a moment in time.
 *
 * `gte(expr, date)` cannot be used here: the operand is a `coalesce(...)`
 * expression rather than a column, so Drizzle has no column type to encode the
 * parameter with and sends the Date through JavaScript's own `toString` —
 * "Tue Jul 07 2026 10:56:58 GMT+0000 (Coordinated Universal Time)", which
 * Postgres rejects outright. Every time-range filter on the timeline failed
 * with a 503 because of it. An ISO string with an explicit cast leaves nothing
 * to infer.
 */
export function atOrAfter(expression: SQL, moment: Date) {
	return sql`${expression} >= ${moment.toISOString()}::timestamptz`;
}

export function before(expression: SQL, moment: Date) {
	return sql`${expression} < ${moment.toISOString()}::timestamptz`;
}

const safeEngagementPart = (key: "comments" | "reactions" | "shares") =>
	sql<number>`case when coalesce(${evidenceItems.engagement}->>${key}, '') ~ '^\\d+$' then (${evidenceItems.engagement}->>${key})::int else 0 end`;
export const reactionsExpr = safeEngagementPart("reactions");
export const commentsExpr = safeEngagementPart("comments");
export const sharesExpr = safeEngagementPart("shares");
export const engagementScore = sql<number>`(${reactionsExpr} + ${commentsExpr} + ${sharesExpr})`;
export const riskScore = sql<number>`case ${evidenceItems.riskLevel} when 'high' then 3 when 'medium' then 2 else 1 end`;
export const effectiveTriageUpdatedAt = sql<Date>`coalesce(${evidenceTriage.updatedAt}, ${evidenceItems.createdAt})`.mapWith(
	evidenceItems.createdAt,
);
export const effectiveTriageStatus = sql<EvidenceTriageStatus>`coalesce(${evidenceTriage.status}, 'new'::evidence_triage_status)`;
export const effectivePinned = sql<boolean>`coalesce(${evidenceTriage.isPinned}, false)`;
const facebookPageKeyExpr = sql<string | null>`case
	when nullif(trim(${evidenceItems.metadata}->>'facebookId'), '') is not null
		then 'id:' || trim(${evidenceItems.metadata}->>'facebookId')
	when nullif(trim(${evidenceItems.author}), '') is not null
		then 'username:' || lower(regexp_replace(trim(${evidenceItems.author}), '^@|\\s+', '', 'g'))
	else null
end`;
export const facebookPageProfileJoin = or(
	eq(facebookPageProfiles.pageKey, facebookPageKeyExpr),
	eq(
		facebookPageProfiles.facebookPageId,
		sql<string | null>`${evidenceItems.metadata}->>'facebookId'`,
	),
	eq(
		facebookPageProfiles.username,
		sql<string | null>`nullif(lower(regexp_replace(trim(${evidenceItems.author}), '^@|\\s+', '', 'g')), '')`,
	),
);
export const publishedMicros = sql<number>`floor(extract(epoch from ${effectivePublishedAt}) * 1000000)`;
export const triageUpdatedMicros = sql<number>`floor(extract(epoch from ${effectiveTriageUpdatedAt}) * 1000000)`;
export const collectedMicros = sql<number>`floor(extract(epoch from ${evidenceItems.createdAt}) * 1000000)`;

export const timelinePostSelection = {
	author: evidenceItems.author,
	collectedMicros,
	comments: commentsExpr,
	createdAt: evidenceItems.createdAt,
	engagementTotal: engagementScore,
	facebookPageId: sql<string | null>`${evidenceItems.metadata}->>'facebookId'`,
	pageClassification: sql<TimelinePost["pageClassification"]>`coalesce(${facebookPageProfiles.classification}, 'uncategorized'::facebook_page_classification)`,
	id: evidenceItems.id,
	originalImageUrl: sql<string | null>`${evidenceItems.metadata}->>'originalImageUrl'`,
	provider: evidenceItems.provider,
	publishedAt: evidenceItems.publishedAt,
	publishedMicros,
	quote: evidenceItems.quote,
	reactions: reactionsExpr,
	riskLevel: evidenceItems.riskLevel,
	riskScore,
	scanJobId: evidenceItems.scanJobId,
	sentiment: evidenceItems.sentiment,
	shares: sharesExpr,
	sourceLabel: evidenceItems.sourceLabel,
	sourceUrl: evidenceItems.sourceUrl,
	stance: evidenceItems.stance,
	summary: evidenceItems.summary,
	triageAssigneeDisplayName: evidenceTriage.assigneeDisplayName,
	triageAssigneeUserId: evidenceTriage.assigneeUserId,
	triageDueAt: evidenceTriage.dueAt,
	triageIsPinned: evidenceTriage.isPinned,
	triageStatus: effectiveTriageStatus,
	triageUpdatedAt: evidenceTriage.updatedAt,
	triageUpdatedMicros,
	triageUpdatedByDisplayName: evidenceTriage.updatedByDisplayName,
};

export type TimelineRow = typeof timelinePostSelection extends infer T ? T : never;

export async function topicsForEvidence(ids: string[]) {
	const result = new Map<string, string[]>();
	if (!ids.length) return result;
	const rows = await adminDb
		.select({ evidenceItemId: evidenceTopics.evidenceItemId, slug: topics.slug })
		.from(evidenceTopics)
		.innerJoin(topics, eq(topics.id, evidenceTopics.topicId))
		.where(inArray(evidenceTopics.evidenceItemId, ids));
	for (const row of rows) {
		result.set(row.evidenceItemId, [...(result.get(row.evidenceItemId) ?? []), row.slug]);
	}
	return result;
}

export function facebookUsername(author: string | null, url: string | null) {
	if (author?.trim()) return author.trim().replace(/^@/u, "");
	if (!url) return null;
	try {
		return new URL(url).pathname.split("/").filter(Boolean)[0] ?? null;
	} catch {
		return null;
	}
}

export class TimelineNotFoundError extends Error {
	constructor() {
		super("Không tìm thấy bằng chứng.");
		this.name = "TimelineNotFoundError";
	}
}
