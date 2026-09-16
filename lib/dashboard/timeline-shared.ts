import { inJsonArray } from "@/lib/db/sqlite-lists";
import { utcTimestamp } from "@/lib/db/utc-timestamp";
import "server-only";

import { eq, or, sql, type SQL } from "drizzle-orm";

import type { TimelinePost } from "@/components/dashboard/types";
import { adminDb } from "@/lib/db/client";
import {
	facebookHandleFromAuthor,
	trackedSourceNameForHandle,
} from "@/lib/db/page-name";
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
/** Bind fixed-width UTC text even when comparing a computed expression. */
export function atOrAfter(expression: SQL, moment: Date) {
	return sql`${expression} >= ${utcTimestamp(moment)}`;
}

export function before(expression: SQL, moment: Date) {
	return sql`${expression} < ${utcTimestamp(moment)}`;
}

const safeEngagementPart = (key: "comments" | "reactions" | "shares") => {
    const value = sql`cast(${evidenceItems.engagement}->>${key} as text)`;
    return sql<number>`case when ${value} <> '' and ${value} not glob '*[^0-9]*' then cast(${value} as integer) else 0 end`;
};
export const reactionsExpr = safeEngagementPart("reactions");
export const commentsExpr = safeEngagementPart("comments");
export const sharesExpr = safeEngagementPart("shares");
export const engagementScore = sql<number>`(${reactionsExpr} + ${commentsExpr} + ${sharesExpr})`;
export const riskScore = sql<number>`case ${evidenceItems.riskLevel} when 'high' then 3 when 'medium' then 2 else 1 end`;
export const effectiveTriageUpdatedAt = sql<Date>`coalesce(${evidenceTriage.updatedAt}, ${evidenceItems.createdAt})`.mapWith(
	evidenceItems.createdAt,
);
export const effectiveTriageStatus = sql<EvidenceTriageStatus>`coalesce(${evidenceTriage.status}, 'new')`;
export const effectivePinned = sql<boolean>`coalesce(${evidenceTriage.isPinned}, false)`.mapWith(Boolean);
const facebookPageKeyExpr = sql<string | null>`case
	when nullif(trim(${evidenceItems.metadata}->>'facebookId'), '') is not null
		then 'id:' || trim(${evidenceItems.metadata}->>'facebookId')
	when nullif(trim(${evidenceItems.author}), '') is not null
		then 'username:' || ${facebookHandleFromAuthor(evidenceItems.author)}
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
		facebookHandleFromAuthor(evidenceItems.author),
	),
);

const evidenceHandleExpr = facebookHandleFromAuthor(evidenceItems.author);
const trackedSourceNameExpr = trackedSourceNameForHandle(evidenceHandleExpr);

function timestampMicros(expression: SQL | typeof evidenceItems.createdAt) {
    return sql<number>`cast(strftime('%s',substr(${expression},1,19)||'Z') as integer)*1000000 + cast(substr(replace(substr(${expression},21),'Z','')||'000000',1,6) as integer)`;
}
export const publishedMicros = timestampMicros(effectivePublishedAt);
export const triageUpdatedMicros = timestampMicros(effectiveTriageUpdatedAt);
export const collectedMicros = timestampMicros(evidenceItems.createdAt);

export const timelinePostSelection = {
	author: evidenceItems.author,
	collectedMicros,
	comments: commentsExpr,
	createdAt: evidenceItems.createdAt,
	engagementTotal: engagementScore,
	facebookPageId: sql<string | null>`${evidenceItems.metadata}->>'facebookId'`,
	pageClassification: sql<TimelinePost["pageClassification"]>`coalesce(${facebookPageProfiles.classification}, 'uncategorized')`,
	// The name the team gave the page, and its handle — always both, so a card
	// can lead with the name a reader recognises and still say which account it
	// came from. The tracked source wins because that is the field the team
	// actually edits.
	pageDisplayName: sql<string | null>`coalesce(${trackedSourceNameExpr}, nullif(trim(${facebookPageProfiles.displayName}), ''))`,
	pageUsername: sql<string | null>`coalesce(nullif(lower(trim(${facebookPageProfiles.username})), ''), ${evidenceHandleExpr})`,
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
		.where(inJsonArray(evidenceTopics.evidenceItemId, ids));
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
