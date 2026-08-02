import "server-only";

import {
	and,
	asc,
	cosineDistance,
	desc,
	eq,
	gt,
	gte,
	ilike,
	inArray,
	isNull,
	lt,
	ne,
	or,
	sql,
	type SQL,
} from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";

import type {
	EvidenceTriageNoteView,
	EvidenceTriageView,
	RelatedEvidenceResponse,
	TimelineFilters,
	TimelineHead,
	TimelinePage,
	TimelinePost,
	TimelineSort,
} from "@/components/dashboard/types";
import {
	DASHBOARD_INTELLIGENCE_TAG,
	dashboardIntelligenceTag,
} from "@/lib/dashboard/cache-tags";
import { adminDb } from "@/lib/db/client";
import {
	auditEvents,
	evidenceItems,
	evidenceSemanticProfiles,
	evidenceTopics,
	evidenceTriage,
	evidenceTriageNotes,
	facebookPageProfiles,
	intelligenceActivityRollups,
	topics,
	type EvidenceTriageStatus,
} from "@/lib/db/schema";
import {
	LOCAL_EVIDENCE_EMBEDDING_MODEL,
	LOCAL_RELATED_EVIDENCE_MIN_RELEVANCE,
	RELATED_EVIDENCE_MIN_RELEVANCE,
} from "@/lib/domain/evidence-semantics";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;
const VIETNAM_OFFSET = "+07:00";

const cursorSchema = z
	.object({
		id: z.uuid(),
		primary: z.number().finite(),
		publishedAt: z.number().finite(),
		sort: z.enum([
			"published-desc",
			"published-asc",
			"engagement-desc",
			"risk-desc",
			"triage-updated-desc",
		]),
	})
	.strict();

type TimelineCursor = z.infer<typeof cursorSchema>;
type TimelineActor = { displayName: string | null; id: string };
export type TimelineTriagePatch = {
	assigneeDisplayName?: string | null;
	assigneeUserId?: string | null;
	dueAt?: Date | null;
	isPinned?: boolean;
	status?: EvidenceTriageStatus;
};

const effectivePublishedAt = sql<Date>`coalesce(${evidenceItems.publishedAt}, ${evidenceItems.createdAt})`.mapWith(
	evidenceItems.createdAt,
);
const safeEngagementPart = (key: "comments" | "reactions" | "shares") =>
	sql<number>`case when coalesce(${evidenceItems.engagement}->>${key}, '') ~ '^\\d+$' then (${evidenceItems.engagement}->>${key})::int else 0 end`;
const reactionsExpr = safeEngagementPart("reactions");
const commentsExpr = safeEngagementPart("comments");
const sharesExpr = safeEngagementPart("shares");
const engagementScore = sql<number>`(${reactionsExpr} + ${commentsExpr} + ${sharesExpr})`;
const riskScore = sql<number>`case ${evidenceItems.riskLevel} when 'high' then 3 when 'medium' then 2 else 1 end`;
const effectiveTriageUpdatedAt = sql<Date>`coalesce(${evidenceTriage.updatedAt}, ${evidenceItems.createdAt})`.mapWith(
	evidenceItems.createdAt,
);
const effectiveTriageStatus = sql<EvidenceTriageStatus>`coalesce(${evidenceTriage.status}, 'new'::evidence_triage_status)`;
const effectivePinned = sql<boolean>`coalesce(${evidenceTriage.isPinned}, false)`;
const facebookPageKeyExpr = sql<string | null>`case
	when nullif(trim(${evidenceItems.metadata}->>'facebookId'), '') is not null
		then 'id:' || trim(${evidenceItems.metadata}->>'facebookId')
	when nullif(trim(${evidenceItems.author}), '') is not null
		then 'username:' || lower(regexp_replace(trim(${evidenceItems.author}), '^@|\\s+', '', 'g'))
	else null
end`;
const facebookPageProfileJoin = or(
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
const publishedMicros = sql<number>`floor(extract(epoch from ${effectivePublishedAt}) * 1000000)`;
const triageUpdatedMicros = sql<number>`floor(extract(epoch from ${effectiveTriageUpdatedAt}) * 1000000)`;
const timelinePostSelection = {
	author: evidenceItems.author,
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

export async function listTimeline({
	cursor,
	filters = {},
	limit = DEFAULT_LIMIT,
}: {
	cursor?: string | null;
	filters?: TimelineFilters;
	limit?: number;
} = {}): Promise<TimelinePage> {
	return getCachedTimeline(
		normalizeFilters(filters),
		normalizeLimit(limit),
		cursor ? decodeCursor(cursor) : null,
	);
}

async function getCachedTimeline(
	filters: NormalizedTimelineFilters,
	limit: number,
	cursor: TimelineCursor | null,
): Promise<TimelinePage> {
	"use cache";
	cacheLife({ stale: 30, revalidate: 30, expire: 300 });
	cacheTag(DASHBOARD_INTELLIGENCE_TAG, dashboardIntelligenceTag("timeline"));

	const sort = filters.sort;
	if (cursor && cursor.sort !== sort) throw new Error("Con trỏ không khớp kiểu sắp xếp.");
	const baseConditions = timelineConditions(filters);
	const cursorCondition = cursor ? timelineCursorCondition(sort, cursor) : undefined;
	const where = and(...baseConditions, cursorCondition);
	const rowsQuery = adminDb
		.select(timelinePostSelection)
		.from(evidenceItems)
		.leftJoin(evidenceTriage, eq(evidenceTriage.evidenceItemId, evidenceItems.id))
		.leftJoin(facebookPageProfiles, facebookPageProfileJoin)
		.where(where)
		.orderBy(...timelineOrderBy(sort))
		.limit(limit + 1);
	const totalQuery = adminDb
		.select({ count: sql<number>`count(*)::int` })
		.from(evidenceItems)
		.leftJoin(evidenceTriage, eq(evidenceTriage.evidenceItemId, evidenceItems.id))
		.leftJoin(facebookPageProfiles, facebookPageProfileJoin)
		.where(and(...baseConditions));
	const [rows, totalRows] = await Promise.all([rowsQuery, totalQuery]);
	const pageRows = rows.slice(0, limit);
	const topicMap = await topicsForEvidence(pageRows.map((row) => row.id));
	const last = pageRows.at(-1);

	return {
		hasNextPage: rows.length > limit,
		items: pageRows.map((row) => mapTimelinePost(row, topicMap.get(row.id) ?? [])),
		limit,
		nextCursor:
			rows.length > limit && last
				? encodeCursor(cursorFromRow(sort, last))
				: null,
		refreshedAt: new Date().toISOString(),
		total: totalRows[0]?.count ?? 0,
	};
}

export async function getTimelinePostById(
	evidenceId: string,
): Promise<TimelinePost | null> {
	return getCachedTimelinePostById(evidenceId);
}

export async function listRelatedEvidence(
	evidenceId: string,
	limit = 6,
): Promise<RelatedEvidenceResponse> {
	const targetRows = await adminDb
		.select({
			embedding: evidenceSemanticProfiles.embedding,
			model: evidenceSemanticProfiles.model,
			updatedAt: evidenceSemanticProfiles.updatedAt,
		})
		.from(evidenceSemanticProfiles)
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
	const relevance = sql<number>`1 - (${distance})`.mapWith(Number);
	const minimumRelevance =
		target.model === LOCAL_EVIDENCE_EMBEDDING_MODEL
			? LOCAL_RELATED_EVIDENCE_MIN_RELEVANCE
			: RELATED_EVIDENCE_MIN_RELEVANCE;
	const rows = await adminDb
		.select({ ...timelinePostSelection, relevance })
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
				sql`${distance} <= ${1 - minimumRelevance}`,
			),
		)
		.orderBy(distance, desc(effectivePublishedAt))
		.limit(Math.max(limit * 4, 24));
	const topicMap = await topicsForEvidence(rows.map((row) => row.id));
	const targetTopics = new Set((await topicsForEvidence([evidenceId])).get(evidenceId) ?? []);
	const seenUrls = new Set<string>();
	const seenQuotes = new Set<string>();
	const items = [];
	for (const row of rows) {
		const normalizedQuote = row.quote.trim().toLocaleLowerCase("vi");
		if (
			(row.sourceUrl && seenUrls.has(row.sourceUrl)) ||
			seenQuotes.has(normalizedQuote)
		) {
			continue;
		}
		if (row.sourceUrl) seenUrls.add(row.sourceUrl);
		seenQuotes.add(normalizedQuote);
		const topicSlugs = topicMap.get(row.id) ?? [];
		items.push({
			...mapTimelinePost(row, topicSlugs),
			relevance: Math.max(0, Math.min(1, Number(row.relevance))),
			sharedTopics: topicSlugs.filter((slug) => targetTopics.has(slug)),
		});
		if (items.length >= limit) break;
	}

	return {
		generatedAt: target.updatedAt.toISOString(),
		items,
		model: target.model,
		profileReady: true,
	};
}

async function getCachedTimelinePostById(
	evidenceId: string,
): Promise<TimelinePost | null> {
	"use cache";
	cacheLife({ stale: 30, revalidate: 30, expire: 300 });
	cacheTag(DASHBOARD_INTELLIGENCE_TAG, dashboardIntelligenceTag("evidence"));

	const rows = await adminDb
		.select(timelinePostSelection)
		.from(evidenceItems)
		.leftJoin(evidenceTriage, eq(evidenceTriage.evidenceItemId, evidenceItems.id))
		.leftJoin(facebookPageProfiles, facebookPageProfileJoin)
		.where(eq(evidenceItems.id, evidenceId))
		.limit(1);
	const row = rows[0];
	if (!row) return null;
	const topicMap = await topicsForEvidence([row.id]);
	return mapTimelinePost(row, topicMap.get(row.id) ?? []);
}

export async function getTimelineHead(
	filters: TimelineFilters = {},
): Promise<TimelineHead> {
	return getCachedTimelineHead(normalizeFilters(filters));
}

async function getCachedTimelineHead(
	filters: NormalizedTimelineFilters,
): Promise<TimelineHead> {
	"use cache";
	cacheLife({ stale: 30, revalidate: 30, expire: 300 });
	cacheTag(DASHBOARD_INTELLIGENCE_TAG, dashboardIntelligenceTag("timeline"));

	const conditions = timelineConditions(filters);
	const [newest, totalRows, triageVersion, noteVersion] = await Promise.all([
		adminDb
			.select({ id: evidenceItems.id, publishedAt: effectivePublishedAt })
			.from(evidenceItems)
			.leftJoin(evidenceTriage, eq(evidenceTriage.evidenceItemId, evidenceItems.id))
			.where(and(...conditions))
			.orderBy(desc(effectivePublishedAt), desc(evidenceItems.id))
			.limit(1),
		adminDb
			.select({ count: sql<number>`count(*)::int` })
			.from(evidenceItems)
			.leftJoin(evidenceTriage, eq(evidenceTriage.evidenceItemId, evidenceItems.id))
			.where(and(...conditions)),
		adminDb.select({ value: sql<Date | null>`max(${evidenceTriage.updatedAt})`.mapWith(evidenceTriage.updatedAt) }).from(evidenceTriage),
		adminDb.select({ value: sql<Date | null>`max(${evidenceTriageNotes.createdAt})`.mapWith(evidenceTriageNotes.createdAt) }).from(evidenceTriageNotes),
	]);
	const latestTriage = maxDate(triageVersion[0]?.value, noteVersion[0]?.value);

	return {
		latestTriageUpdatedAt: latestTriage?.toISOString() ?? null,
		newestPostId: newest[0]?.id ?? null,
		newestPublishedAt: newest[0]?.publishedAt?.toISOString() ?? null,
		refreshedAt: new Date().toISOString(),
		total: totalRows[0]?.count ?? 0,
	};
}

export async function getEvidenceTriageDetails(evidenceId: string): Promise<{
	notes: EvidenceTriageNoteView[];
	triage: EvidenceTriageView;
}> {
	const [evidence, triageRows, notes] = await Promise.all([
		adminDb.select({ id: evidenceItems.id }).from(evidenceItems).where(eq(evidenceItems.id, evidenceId)).limit(1),
		adminDb.select().from(evidenceTriage).where(eq(evidenceTriage.evidenceItemId, evidenceId)).limit(1),
		adminDb
			.select()
			.from(evidenceTriageNotes)
			.where(eq(evidenceTriageNotes.evidenceItemId, evidenceId))
			.orderBy(desc(evidenceTriageNotes.createdAt)),
	]);
	if (!evidence[0]) throw new TimelineNotFoundError();
	return {
		notes: notes.map((note) => ({
			authorDisplayName: note.authorDisplayName,
			authorUserId: note.authorUserId,
			body: note.body,
			createdAt: note.createdAt.toISOString(),
			id: note.id,
		})),
		triage: triageRows[0] ? mapTriage(triageRows[0]) : emptyTriage(),
	};
}

export async function updateEvidenceTriage(
	evidenceId: string,
	patch: TimelineTriagePatch,
	actor: TimelineActor,
): Promise<EvidenceTriageView> {
	const now = new Date();
	const updated = await adminDb.transaction(async (tx) => {
		const evidence = await tx
			.select({ id: evidenceItems.id, riskLevel: evidenceItems.riskLevel })
			.from(evidenceItems)
			.where(eq(evidenceItems.id, evidenceId))
			.limit(1);
		if (!evidence[0]) throw new TimelineNotFoundError();
		const [row] = await tx
			.insert(evidenceTriage)
			.values({
				assigneeDisplayName: patch.assigneeDisplayName ?? null,
				assigneeUserId: patch.assigneeUserId ?? null,
				dueAt: patch.dueAt ?? null,
				evidenceItemId: evidenceId,
				isPinned: patch.isPinned ?? false,
				status: patch.status ?? "new",
				updatedAt: now,
				updatedByDisplayName: actor.displayName,
				updatedByUserId: actor.id,
			})
			.onConflictDoUpdate({
				set: {
					...(patch.assigneeDisplayName !== undefined
						? { assigneeDisplayName: patch.assigneeDisplayName }
						: {}),
					...(patch.assigneeUserId !== undefined
						? { assigneeUserId: patch.assigneeUserId }
						: {}),
					...(patch.dueAt !== undefined ? { dueAt: patch.dueAt } : {}),
					...(patch.isPinned !== undefined ? { isPinned: patch.isPinned } : {}),
					...(patch.status !== undefined ? { status: patch.status } : {}),
					updatedAt: now,
					updatedByDisplayName: actor.displayName,
					updatedByUserId: actor.id,
				},
				target: evidenceTriage.evidenceItemId,
			})
			.returning();
		await Promise.all([
			tx.insert(auditEvents).values({
				action: "evidence_triage_updated",
				entityId: evidenceId,
				entityType: "evidence_item",
				payload: {
					actorId: actor.id,
					fields: Object.keys(patch).filter((key) => key !== "assigneeDisplayName"),
				},
			}),
			tx.insert(intelligenceActivityRollups).values({
				action: "evidence_triage_updated",
				description: `${actor.displayName ?? "Một thành viên"} đã cập nhật phân loại nội bộ.`,
				entityId: evidenceId,
				entityType: "evidence_item",
				href: `/evidence/${evidenceId}`,
				metadata: { actorId: actor.id },
				occurredAt: now,
				severity: evidence[0].riskLevel,
				title: "Cập nhật xử lý bằng chứng",
			}),
		]);
		return row;
	});
	if (!updated) throw new Error("Không thể lưu trạng thái xử lý.");
	return mapTriage(updated);
}

export async function addEvidenceTriageNote(
	evidenceId: string,
	body: string,
	actor: TimelineActor,
): Promise<EvidenceTriageNoteView> {
	const now = new Date();
	const note = await adminDb.transaction(async (tx) => {
		const evidence = await tx
			.select({ id: evidenceItems.id, riskLevel: evidenceItems.riskLevel })
			.from(evidenceItems)
			.where(eq(evidenceItems.id, evidenceId))
			.limit(1);
		if (!evidence[0]) throw new TimelineNotFoundError();
		const [created] = await tx
			.insert(evidenceTriageNotes)
			.values({
				authorDisplayName: actor.displayName,
				authorUserId: actor.id,
				body,
				createdAt: now,
				evidenceItemId: evidenceId,
			})
			.returning();
		await Promise.all([
			tx.insert(auditEvents).values({
				action: "evidence_triage_note_added",
				entityId: evidenceId,
				entityType: "evidence_item",
				payload: { actorId: actor.id, noteId: created?.id },
			}),
			tx.insert(intelligenceActivityRollups).values({
				action: "evidence_triage_note_added",
				description: `${actor.displayName ?? "Một thành viên"} đã thêm ghi chú nội bộ.`,
				entityId: evidenceId,
				entityType: "evidence_item",
				href: `/evidence/${evidenceId}`,
				metadata: { actorId: actor.id, noteId: created?.id },
				occurredAt: now,
				severity: evidence[0].riskLevel,
				title: "Ghi chú xử lý mới",
			}),
		]);
		return created;
	});
	if (!note) throw new Error("Không thể tạo ghi chú.");
	return {
		authorDisplayName: note.authorDisplayName,
		authorUserId: note.authorUserId,
		body: note.body,
		createdAt: note.createdAt.toISOString(),
		id: note.id,
	};
}

export class TimelineNotFoundError extends Error {
	constructor() {
		super("Không tìm thấy bằng chứng.");
		this.name = "TimelineNotFoundError";
	}
}

type NormalizedTimelineFilters = {
	assignee: string;
	dateFrom: string;
	dateTo: string;
	due: NonNullable<TimelineFilters["due"]>;
	facebookPage: string;
	isPinned: boolean | null;
	provider: string;
	query: string;
	risk: NonNullable<TimelineFilters["risk"]>;
	sentiment: string;
	sort: TimelineSort;
	stance: string;
	timeRange: NonNullable<TimelineFilters["timeRange"]>;
	topic: string;
	triageStatus: NonNullable<TimelineFilters["triageStatus"]>;
};

function normalizeFilters(filters: TimelineFilters): NormalizedTimelineFilters {
	return {
		assignee: filters.assignee?.trim() ?? "",
		dateFrom: filters.dateFrom ?? "",
		dateTo: filters.dateTo ?? "",
		due: filters.due ?? "all",
		facebookPage: filters.facebookPage?.trim() ?? "",
		isPinned: filters.isPinned ?? null,
		provider: filters.provider?.trim() ?? "",
		query: filters.query?.trim() ?? "",
		risk: filters.risk ?? "all",
		sentiment: filters.sentiment?.trim() ?? "",
		sort: filters.sort ?? "published-desc",
		stance: filters.stance?.trim() ?? "",
		timeRange: filters.timeRange ?? "all",
		topic: filters.topic?.trim() ?? "",
		triageStatus: filters.triageStatus ?? "all",
	};
}

function timelineConditions(filters: NormalizedTimelineFilters): SQL[] {
	const conditions: Array<SQL | undefined> = [];
	const range = vietnamDateRange(filters);
	conditions.push(
		range.from ? gte(effectivePublishedAt, range.from) : undefined,
		range.to ? lt(effectivePublishedAt, range.to) : undefined,
		filters.risk !== "all" ? eq(evidenceItems.riskLevel, filters.risk) : undefined,
		filters.provider ? sql`${evidenceItems.provider}::text = ${filters.provider}` : undefined,
		filters.sentiment ? eq(evidenceItems.sentiment, filters.sentiment) : undefined,
		filters.stance ? eq(evidenceItems.stance, filters.stance) : undefined,
		filters.triageStatus !== "all" ? eq(effectiveTriageStatus, filters.triageStatus) : undefined,
		filters.assignee === "unassigned"
			? isNull(evidenceTriage.assigneeUserId)
			: filters.assignee
				? eq(evidenceTriage.assigneeUserId, filters.assignee)
				: undefined,
		filters.isPinned === null ? undefined : eq(effectivePinned, filters.isPinned),
		filters.query
			? or(
					ilike(evidenceItems.quote, `%${filters.query}%`),
					ilike(evidenceItems.summary, `%${filters.query}%`),
					ilike(evidenceItems.author, `%${filters.query}%`),
					ilike(evidenceItems.sourceLabel, `%${filters.query}%`),
				)
			: undefined,
		filters.facebookPage
			? or(
					ilike(evidenceItems.sourceLabel, `%${filters.facebookPage}%`),
					ilike(evidenceItems.author, `%${filters.facebookPage}%`),
					sql`${evidenceItems.metadata}->>'facebookId' = ${filters.facebookPage}`,
				)
			: undefined,
		filters.topic
			? sql`exists (
				select 1 from ${evidenceTopics}
				inner join ${topics} on ${topics.id} = ${evidenceTopics.topicId}
				where ${evidenceTopics.evidenceItemId} = ${evidenceItems.id}
				and ${topics.slug} = ${filters.topic}
			)`
			: undefined,
	);
	const today = vietnamTodayRange();
	if (filters.due === "none") conditions.push(isNull(evidenceTriage.dueAt));
	if (filters.due === "overdue") {
		conditions.push(lt(evidenceTriage.dueAt, today.from), sql`${effectiveTriageStatus} not in ('resolved', 'dismissed')`);
	}
	if (filters.due === "today") conditions.push(gte(evidenceTriage.dueAt, today.from), lt(evidenceTriage.dueAt, today.to));
	return conditions.filter((condition): condition is SQL => Boolean(condition));
}

function timelineOrderBy(sort: TimelineSort): SQL[] {
	if (sort === "published-asc") return [asc(effectivePublishedAt), asc(evidenceItems.id)];
	if (sort === "engagement-desc") return [desc(engagementScore), desc(effectivePublishedAt), desc(evidenceItems.id)];
	if (sort === "risk-desc") return [desc(riskScore), desc(effectivePublishedAt), desc(evidenceItems.id)];
	if (sort === "triage-updated-desc") return [desc(effectiveTriageUpdatedAt), desc(effectivePublishedAt), desc(evidenceItems.id)];
	return [desc(effectivePublishedAt), desc(evidenceItems.id)];
}

function timelineCursorCondition(sort: TimelineSort, cursor: TimelineCursor): SQL {
	const published = cursor.publishedAt;
	if (sort === "published-asc") {
		return or(gt(publishedMicros, published), and(eq(publishedMicros, published), gt(evidenceItems.id, cursor.id)))!;
	}
	if (sort === "published-desc") {
		return or(lt(publishedMicros, published), and(eq(publishedMicros, published), lt(evidenceItems.id, cursor.id)))!;
	}
	const primaryExpr = primarySortExpression(sort);
	const primary = cursor.primary;
	return or(
		lt(primaryExpr, primary),
		and(eq(primaryExpr, primary), lt(publishedMicros, published)),
		and(eq(primaryExpr, primary), eq(publishedMicros, published), lt(evidenceItems.id, cursor.id)),
	)!;
}

function primarySortExpression(sort: TimelineSort) {
	if (sort === "engagement-desc") return engagementScore;
	if (sort === "risk-desc") return riskScore;
	return triageUpdatedMicros;
}

function cursorFromRow(
	sort: TimelineSort,
	row: {
		engagementTotal: number;
		id: string;
		publishedMicros: number;
		riskScore: number;
		triageUpdatedMicros: number;
	},
): TimelineCursor {
	return {
		id: row.id,
		primary:
			sort === "engagement-desc"
				? Number(row.engagementTotal)
				: sort === "risk-desc"
					? Number(row.riskScore)
					: sort === "triage-updated-desc"
						? Number(row.triageUpdatedMicros)
						: Number(row.publishedMicros),
		publishedAt: Number(row.publishedMicros),
		sort,
	};
}

function encodeCursor(cursor: TimelineCursor) {
	return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeCursor(value: string): TimelineCursor {
	try {
		return cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
	} catch {
		throw new Error("Con trỏ dòng thời gian không hợp lệ.");
	}
}

function vietnamDateRange(filters: NormalizedTimelineFilters) {
	if (filters.dateFrom || filters.dateTo) {
		return {
			from: filters.dateFrom ? vietnamBoundary(filters.dateFrom) : null,
			to: filters.dateTo ? addVietnamDays(filters.dateTo, 1) : null,
		};
	}
	if (filters.timeRange === "all") return { from: null, to: null };
	const days = filters.timeRange === "7d" ? 7 : filters.timeRange === "30d" ? 30 : 90;
	return { from: new Date(Date.now() - days * 86_400_000), to: null };
}

function vietnamTodayRange() {
	const parts = new Intl.DateTimeFormat("en-CA", {
		day: "2-digit",
		month: "2-digit",
		timeZone: "Asia/Ho_Chi_Minh",
		year: "numeric",
	}).formatToParts(new Date());
	const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
	const day = `${read("year")}-${read("month")}-${read("day")}`;
	return { from: vietnamBoundary(day), to: addVietnamDays(day, 1) };
}

function vietnamBoundary(day: string) {
	return new Date(`${day}T00:00:00${VIETNAM_OFFSET}`);
}

function addVietnamDays(day: string, count: number) {
	const date = vietnamBoundary(day);
	date.setUTCDate(date.getUTCDate() + count);
	return date;
}

async function topicsForEvidence(ids: string[]) {
	const result = new Map<string, string[]>();
	if (!ids.length) return result;
	const rows = await adminDb
		.select({ evidenceItemId: evidenceTopics.evidenceItemId, slug: topics.slug })
		.from(evidenceTopics)
		.innerJoin(topics, eq(topics.id, evidenceTopics.topicId))
		.where(inArray(evidenceTopics.evidenceItemId, ids));
	for (const row of rows) result.set(row.evidenceItemId, [...(result.get(row.evidenceItemId) ?? []), row.slug]);
	return result;
}

function mapTimelinePost(
	row: Parameters<typeof cursorFromRow>[1] & {
		author: string | null;
		comments: number;
		createdAt: Date;
		facebookPageId: string | null;
		pageClassification: TimelinePost["pageClassification"];
		originalImageUrl: string | null;
		provider: TimelinePost["provider"];
		publishedAt: Date | null;
		quote: string;
		reactions: number;
		riskLevel: TimelinePost["riskLevel"];
		scanJobId: string;
		sentiment: string;
		shares: number;
		sourceLabel: string | null;
		sourceUrl: string | null;
		stance: string;
		summary: string;
		triageAssigneeDisplayName: string | null;
		triageAssigneeUserId: string | null;
		triageDueAt: Date | null;
		triageIsPinned: boolean | null;
		triageStatus: EvidenceTriageStatus;
		triageUpdatedAt: Date | null;
		triageUpdatedByDisplayName: string | null;
	},
	topicSlugs: string[],
): TimelinePost {
	return {
		author: row.author,
		createdAt: row.createdAt.toISOString(),
		engagement: {
			comments: Number(row.comments),
			reactions: Number(row.reactions),
			shares: Number(row.shares),
			total: Number(row.engagementTotal),
		},
		facebookPageId: row.facebookPageId,
		facebookUsername: facebookUsername(row.author, row.sourceUrl),
		href: `/evidence/${row.id}`,
		id: row.id,
		originalPostHref: row.sourceUrl,
		originalImageUrl: row.originalImageUrl,
		pageClassification: row.pageClassification,
		provider: row.provider,
		publishedAt: row.publishedAt?.toISOString() ?? null,
		quote: row.quote,
		riskLevel: row.riskLevel,
		scanHref: `/scans/${row.scanJobId}`,
		scanId: row.scanJobId,
		sentiment: row.sentiment,
		sourceLabel: row.sourceLabel,
		sourceUrl: row.sourceUrl,
		stance: row.stance,
		summary: row.summary,
		topicSlugs,
		triage: {
			assigneeDisplayName: row.triageAssigneeDisplayName,
			assigneeUserId: row.triageAssigneeUserId,
			dueAt: row.triageDueAt?.toISOString() ?? null,
			isPinned: row.triageIsPinned ?? false,
			status: row.triageStatus,
			updatedAt: row.triageUpdatedAt?.toISOString() ?? null,
			updatedByDisplayName: row.triageUpdatedByDisplayName,
		},
	};
}

function mapTriage(row: typeof evidenceTriage.$inferSelect): EvidenceTriageView {
	return {
		assigneeDisplayName: row.assigneeDisplayName,
		assigneeUserId: row.assigneeUserId,
		dueAt: row.dueAt?.toISOString() ?? null,
		isPinned: row.isPinned,
		status: row.status,
		updatedAt: row.updatedAt.toISOString(),
		updatedByDisplayName: row.updatedByDisplayName,
	};
}

function emptyTriage(): EvidenceTriageView {
	return {
		assigneeDisplayName: null,
		assigneeUserId: null,
		dueAt: null,
		isPinned: false,
		status: "new",
		updatedAt: null,
		updatedByDisplayName: null,
	};
}

function facebookUsername(author: string | null, url: string | null) {
	if (author?.trim()) return author.trim().replace(/^@/u, "");
	if (!url) return null;
	try {
		return new URL(url).pathname.split("/").filter(Boolean)[0] ?? null;
	} catch {
		return null;
	}
}

function maxDate(...values: Array<Date | null | undefined>) {
	return values.filter((value): value is Date => Boolean(value)).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
}

function normalizeLimit(limit: number) {
	return Number.isFinite(limit) ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit))) : DEFAULT_LIMIT;
}
