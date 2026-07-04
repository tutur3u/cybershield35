import type { DashboardSnapshotRequirements } from "@/lib/dashboard/route-requirements";

export const dashboardQueryStaleTimeMs = 120_000;
export const intelligenceQueryStaleTimeMs = 60_000;
export const workspaceMembersQueryStaleTimeMs = 120_000;
export const managedSchedulerQueryStaleTimeMs = 120_000;

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
	managedScheduler: () => ["workspace", "managed-scheduler"] as const,
	managedSchedulerExecutions: (jobKey = "all") =>
		["workspace", "managed-scheduler", "executions", jobKey] as const,
	workspaceMembers: () => ["workspace", "members"] as const,
};
