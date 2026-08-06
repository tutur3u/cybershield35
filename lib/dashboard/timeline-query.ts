import { z } from "zod";

import {
	EVIDENCE_SENTIMENTS,
	EVIDENCE_STANCES,
} from "@/lib/llm/risk-classification";

import type {
	TimelineDueFilter,
	TimelineFilters,
	TimelineSort,
} from "@/components/dashboard/types";

export const timelineSortValues = [
	"published-desc",
	"published-asc",
	"collected-desc",
	"engagement-desc",
	"risk-desc",
	"triage-updated-desc",
] as const satisfies readonly TimelineSort[];

export const timelineDueValues = [
	"all",
	"overdue",
	"today",
	"none",
] as const satisfies readonly TimelineDueFilter[];

export const timelineTriageStatusValues = [
	"new",
	"reviewing",
	"action_required",
	"resolved",
	"dismissed",
] as const;

const optionalDate = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/u)
	.refine((value) => {
		const parsed = new Date(`${value}T00:00:00Z`);
		return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
	}, "Ngày không hợp lệ.")
	.optional();

const timelineQuerySchema = z
	.object({
		assignee: z.union([z.literal("unassigned"), z.uuid()]).optional(),
		cursor: z.string().trim().max(1024).optional(),
		dateFrom: optionalDate,
		dateTo: optionalDate,
		due: z.enum(timelineDueValues).default("all"),
		facebookPage: z.string().trim().max(240).optional(),
		isPinned: z.enum(["true", "false"]).optional(),
		limit: z.coerce.number().int().min(1).max(50).default(30),
		provider: z
			.enum([
				"apify_facebook_posts",
				"apify_facebook_comments",
				"apify_facebook_groups",
				"firecrawl",
				"firecrawl_parse",
				"browser_use",
				"local_text",
			])
			.optional(),
		q: z.string().trim().max(240).optional(),
		risk: z.enum(["all", "low", "medium", "high"]).default("all"),
		// Taken from the shared vocabulary rather than repeated. This list still
		// said "opposed" after the classifier moved to "critical", so the request
		// was rejected with a 400 before it ever reached the query.
		sentiment: z.enum(EVIDENCE_SENTIMENTS).optional(),
		sort: z.enum(timelineSortValues).default("published-desc"),
		stance: z.enum(EVIDENCE_STANCES).optional(),
		timeRange: z.enum(["7d", "30d", "90d", "all"]).default("all"),
		topic: z.string().trim().max(160).optional(),
		triageStatus: z
			.enum(["all", ...timelineTriageStatusValues])
			.default("all"),
	})
	.strict()
	.refine(
		(value) =>
			!value.dateFrom ||
			!value.dateTo ||
			Date.parse(value.dateFrom) <= Date.parse(value.dateTo),
		{ message: "dateFrom must be before or equal to dateTo" },
	);

const timelineDataQueryKeys = new Set([
	"assignee",
	"cursor",
	"dateFrom",
	"dateTo",
	"due",
	"facebookPage",
	"isPinned",
	"limit",
	"provider",
	"q",
	"risk",
	"sentiment",
	"sort",
	"stance",
	"timeRange",
	"topic",
	"triageStatus",
]);

export type ParsedTimelineRequest = {
	cursor: string | null;
	filters: TimelineFilters;
	limit: number;
};

export function parseTimelineSearchParams(
	searchParams: URLSearchParams,
): ParsedTimelineRequest {
	const input = Object.fromEntries(searchParams.entries());
	const parsed = timelineQuerySchema.parse(input);
	return {
		cursor: parsed.cursor ?? null,
		filters: {
			assignee: cleanOptional(parsed.assignee),
			dateFrom: parsed.dateFrom,
			dateTo: parsed.dateTo,
			due: parsed.due,
			facebookPage: cleanOptional(parsed.facebookPage),
			isPinned:
				parsed.isPinned === undefined ? undefined : parsed.isPinned === "true",
			provider: cleanOptional(parsed.provider),
			query: cleanOptional(parsed.q),
			risk: parsed.risk,
			sentiment: cleanOptional(parsed.sentiment),
			sort: parsed.sort,
			stance: cleanOptional(parsed.stance),
			timeRange: parsed.timeRange,
			topic: cleanOptional(parsed.topic),
			triageStatus: parsed.triageStatus,
		},
		limit: parsed.limit,
	};
}

export function timelineFiltersFromRecord(
	searchParams: Record<string, string | string[] | undefined>,
): TimelineFilters {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(searchParams)) {
		// Renderer-only state such as `view` must never enter the data query key.
		if (!timelineDataQueryKeys.has(key)) continue;
		const first = Array.isArray(value) ? value[0] : value;
		if (first !== undefined) params.set(key, first);
	}
	return parseTimelineSearchParams(params).filters;
}

export function serializeTimelineFilters(
	filters: TimelineFilters,
): Record<string, string> {
	const params: Record<string, string> = {};
	if (filters.assignee) params.assignee = filters.assignee;
	if (filters.dateFrom) params.dateFrom = filters.dateFrom;
	if (filters.dateTo) params.dateTo = filters.dateTo;
	if (filters.due && filters.due !== "all") params.due = filters.due;
	if (filters.facebookPage) params.facebookPage = filters.facebookPage;
	if (filters.isPinned !== undefined) params.isPinned = String(filters.isPinned);
	if (filters.provider) params.provider = filters.provider;
	if (filters.query) params.q = filters.query;
	if (filters.risk && filters.risk !== "all") params.risk = filters.risk;
	if (filters.sentiment) params.sentiment = filters.sentiment;
	if (filters.sort && filters.sort !== "published-desc") params.sort = filters.sort;
	if (filters.stance) params.stance = filters.stance;
	if (filters.timeRange && filters.timeRange !== "all") {
		params.timeRange = filters.timeRange;
	}
	if (filters.topic) params.topic = filters.topic;
	if (filters.triageStatus && filters.triageStatus !== "all") {
		params.triageStatus = filters.triageStatus;
	}
	return params;
}

function cleanOptional(value?: string) {
	const cleaned = value?.trim();
	return cleaned || undefined;
}
