import type { IntelligenceFilters, TimelineFilters } from "@/components/dashboard/types";
import { serializeTimelineFilters } from "@/lib/dashboard/timeline-query";
import type { DashboardSnapshotRequirements } from "@/lib/dashboard/route-requirements";

export const dashboardQueryGcTimeMs = 30 * 60_000;
export const dashboardQueryStaleTimeMs = 5 * 60_000;
export const intelligenceQueryStaleTimeMs = 5 * 60_000;
export const timelineQueryStaleTimeMs = 30_000;
export const workspaceMembersQueryStaleTimeMs = 5 * 60_000;
export const managedSchedulerQueryStaleTimeMs = 60_000;

export const defaultIntelligenceFilters = {
	risk: "all",
	timeRange: "30d",
} as const satisfies IntelligenceFilters;

export type DashboardSearchParams = Promise<
	Record<string, string | string[] | undefined>
>;

export function intelligenceFiltersFromSearchParams(
	searchParams: Awaited<DashboardSearchParams>,
): IntelligenceFilters {
	return {
		facebookPage: firstSearchParam(searchParams.facebookPage),
		provider: firstSearchParam(searchParams.provider),
		query: firstSearchParam(searchParams.q),
		risk:
			(firstSearchParam(searchParams.risk) as IntelligenceFilters["risk"]) ??
			defaultIntelligenceFilters.risk,
		source: firstSearchParam(searchParams.source),
		status: firstSearchParam(searchParams.status),
		timeRange:
			(firstSearchParam(
				searchParams.timeRange,
			) as IntelligenceFilters["timeRange"]) ??
			defaultIntelligenceFilters.timeRange,
		topic: firstSearchParam(searchParams.topic),
	};
}

export function serializeIntelligenceFilters(
	filters: IntelligenceFilters = {},
): Record<string, string> {
	const params: Record<string, string> = {};
	if (filters.facebookPage) params.facebookPage = filters.facebookPage;
	if (filters.provider) params.provider = filters.provider;
	if (filters.query) params.q = filters.query;
	if (filters.risk && filters.risk !== "all") params.risk = filters.risk;
	if (filters.source) params.source = filters.source;
	if (filters.status) params.status = filters.status;
	if (filters.timeRange) params.timeRange = filters.timeRange;
	if (filters.topic) params.topic = filters.topic;
	return params;
}

function firstSearchParam(value: string | string[] | undefined) {
	return Array.isArray(value) ? value[0] : value;
}

export type DashboardInitialQueryParams = DashboardSnapshotRequirements & {
	scanId?: string | null;
};

export function normalizeDashboardInitialQueryParams(
	params: DashboardInitialQueryParams,
) {
	return {
		includeDetail: params.includeDetail,
		includeScans: params.includeScans,
		includeTrackedSources: params.includeTrackedSources,
		scanId: params.scanId ?? "",
	};
}

export const dashboardQueryKeys = {
	all: ["dashboard"] as const,
	initial: (params: DashboardInitialQueryParams) =>
		[
			"dashboard",
			"initial",
			normalizeDashboardInitialQueryParams(params),
		] as const,
	scanDetail: (scanId: string) => ["dashboard", "scan-detail", scanId] as const,
	scansInfinite: (limit: number) =>
		["dashboard", "scans", "infinite", limit] as const,
	scanEvidenceInfinite: (scanId: string, limit: number) =>
		["dashboard", "scan-evidence", "infinite", scanId, limit] as const,
	topicsInfinite: (limit: number) =>
		["dashboard", "topics", "infinite", limit] as const,
	topicDetailInfinite: (slug: string, limit: number) =>
		["dashboard", "topic-detail", "infinite", slug, limit] as const,
	intelligenceOverview: (params: Record<string, string>) =>
		["dashboard", "intelligence", "overview", params] as const,
	intelligenceEvidenceInfinite: (
		params: Record<string, string>,
		limit: number,
	) => ["dashboard", "intelligence", "evidence", "infinite", params, limit] as const,
	intelligenceTopicsInfinite: (params: Record<string, string>, limit: number) =>
		["dashboard", "intelligence", "topics", "infinite", params, limit] as const,
	intelligenceClaimsInfinite: (params: Record<string, string>, limit: number) =>
		["dashboard", "intelligence", "claims", "infinite", params, limit] as const,
	intelligenceSourcesInfinite: (params: Record<string, string>, limit: number) =>
		["dashboard", "intelligence", "sources", "infinite", params, limit] as const,
	intelligenceActivityInfinite: (params: Record<string, string>, limit: number) =>
		["dashboard", "intelligence", "activity", "infinite", params, limit] as const,
	intelligenceFacebookPages: () =>
		["dashboard", "intelligence", "facebook-pages"] as const,
	timelineInfinite: (filters: TimelineFilters, limit: number) =>
		["dashboard", "timeline", "infinite", serializeTimelineFilters(filters), limit] as const,
	timelineHead: (filters: TimelineFilters) =>
		["dashboard", "timeline", "head", serializeTimelineFilters(filters)] as const,
	timelineTriage: (evidenceId: string) =>
		["dashboard", "timeline", "triage", evidenceId] as const,
	managedScheduler: () => ["workspace", "managed-scheduler"] as const,
	managedSchedulerExecutions: (jobKey = "all") =>
		["workspace", "managed-scheduler", "executions", jobKey] as const,
	workspaceMembers: () => ["workspace", "members"] as const,
};
