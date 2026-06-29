import type { DashboardSnapshotRequirements } from "@/lib/dashboard/route-requirements";

export const dashboardQueryStaleTimeMs = 120_000;
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
	managedScheduler: () => ["workspace", "managed-scheduler"] as const,
	managedSchedulerExecutions: (jobKey = "all") =>
		["workspace", "managed-scheduler", "executions", jobKey] as const,
	workspaceMembers: () => ["workspace", "members"] as const,
};
