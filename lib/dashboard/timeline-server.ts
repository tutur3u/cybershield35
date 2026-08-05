import "server-only";

import {
	and,
	asc,
	desc,
	eq,
	gt,
	gte,
	ilike,
	isNull,
	lt,
	or,
	sql,
	type SQL,
} from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";

import type {
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
	evidenceItems,
	evidenceTopics,
	evidenceTriage,
	evidenceTriageNotes,
	facebookPageProfiles,
	topics,
} from "@/lib/db/schema";
import { mapTimelinePost } from "@/lib/dashboard/timeline-mapping";
import {
	collectedMicros,
	effectivePinned,
	effectivePublishedAt,
	effectiveTriageStatus,
	effectiveTriageUpdatedAt,
	engagementScore,
	facebookPageProfileJoin,
	publishedMicros,
	riskScore,
	timelinePostSelection,
	topicsForEvidence,
	triageUpdatedMicros,
} from "@/lib/dashboard/timeline-shared";

export { TimelineNotFoundError } from "@/lib/dashboard/timeline-shared";
export {
	listRelatedEvidence,
} from "@/lib/dashboard/timeline-related";
export {
	addEvidenceTriageNote,
	getEvidenceTriageDetails,
	updateEvidenceTriage,
	type TimelineTriagePatch,
} from "@/lib/dashboard/timeline-triage";

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
			"collected-desc",
			"engagement-desc",
			"risk-desc",
			"triage-updated-desc",
		]),
	})
	.strict();

type TimelineCursor = z.infer<typeof cursorSchema>;
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
	since?: string | null,
): Promise<TimelineHead> {
	const parsedSince = since ? new Date(since) : null;
	return getCachedTimelineHead(
		normalizeFilters(filters),
		parsedSince && !Number.isNaN(parsedSince.getTime())
			? parsedSince.toISOString()
			: null,
	);
}

async function getCachedTimelineHead(
	filters: NormalizedTimelineFilters,
	since: string | null,
): Promise<TimelineHead> {
	"use cache";
	cacheLife({ stale: 30, revalidate: 30, expire: 300 });
	cacheTag(DASHBOARD_INTELLIGENCE_TAG, dashboardIntelligenceTag("timeline"));

	const conditions = timelineConditions(filters);
	const [newest, totalRows, triageVersion, noteVersion, collected] =
		await Promise.all([
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
			adminDb
				.select({
					newCount: since
						? sql<number>`count(*) filter (where ${evidenceItems.createdAt} > ${since}::timestamptz)::int`
						: sql<number>`0::int`,
					newestCollectedAt: sql<Date | null>`max(${evidenceItems.createdAt})`.mapWith(
						evidenceItems.createdAt,
					),
				})
				.from(evidenceItems)
				.leftJoin(evidenceTriage, eq(evidenceTriage.evidenceItemId, evidenceItems.id))
				.where(and(...conditions)),
		]);
	const latestTriage = maxDate(triageVersion[0]?.value, noteVersion[0]?.value);

	return {
		latestTriageUpdatedAt: latestTriage?.toISOString() ?? null,
		newSinceCount: Number(collected[0]?.newCount ?? 0),
		newestCollectedAt: collected[0]?.newestCollectedAt?.toISOString() ?? null,
		newestPostId: newest[0]?.id ?? null,
		newestPublishedAt: newest[0]?.publishedAt?.toISOString() ?? null,
		refreshedAt: new Date().toISOString(),
		total: totalRows[0]?.count ?? 0,
	};
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
	if (sort === "collected-desc") return [desc(evidenceItems.createdAt), desc(evidenceItems.id)];
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
	if (sort === "collected-desc") return collectedMicros;
	if (sort === "engagement-desc") return engagementScore;
	if (sort === "risk-desc") return riskScore;
	return triageUpdatedMicros;
}

function cursorFromRow(
	sort: TimelineSort,
	row: {
		collectedMicros: number;
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
			sort === "collected-desc"
				? Number(row.collectedMicros)
				: sort === "engagement-desc"
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






function maxDate(...values: Array<Date | null | undefined>) {
	return values.filter((value): value is Date => Boolean(value)).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
}

function normalizeLimit(limit: number) {
	return Number.isFinite(limit) ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit))) : DEFAULT_LIMIT;
}
