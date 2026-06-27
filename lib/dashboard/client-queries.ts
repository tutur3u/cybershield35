import { queryOptions } from "@tanstack/react-query";

import type {
	DashboardInitialData,
	ScanDetail,
	WorkspaceMembersResponse,
} from "@/components/dashboard/types";
import {
	dashboardQueryKeys,
	dashboardQueryStaleTimeMs,
	normalizeDashboardInitialQueryParams,
	type DashboardInitialQueryParams,
	workspaceMembersQueryStaleTimeMs,
} from "@/lib/dashboard/query-keys";

export function dashboardInitialDataQueryOptions(
	params: DashboardInitialQueryParams,
) {
	const normalized = normalizeDashboardInitialQueryParams(params);

	return queryOptions({
		gcTime: 5 * 60_000,
		queryFn: () => fetchDashboardInitialData(normalized),
		queryKey: dashboardQueryKeys.initial(normalized),
		staleTime: dashboardQueryStaleTimeMs,
	});
}

export function scanDetailQueryOptions(scanId: string) {
	return queryOptions({
		gcTime: 5 * 60_000,
		queryFn: () => fetchScanDetail(scanId),
		queryKey: dashboardQueryKeys.scanDetail(scanId),
		staleTime: dashboardQueryStaleTimeMs,
	});
}

export function workspaceMembersQueryOptions() {
	return queryOptions({
		gcTime: 5 * 60_000,
		queryFn: fetchWorkspaceMembers,
		queryKey: dashboardQueryKeys.workspaceMembers(),
		staleTime: workspaceMembersQueryStaleTimeMs,
	});
}

async function fetchDashboardInitialData(
	params: ReturnType<typeof normalizeDashboardInitialQueryParams>,
): Promise<DashboardInitialData> {
	const searchParams = new URLSearchParams({
		includeDetail: String(params.includeDetail),
		includeScans: String(params.includeScans),
		includeTrackedSources: String(params.includeTrackedSources),
	});
	if (params.scanId) searchParams.set("scanId", params.scanId);

	return fetchJson(`/api/dashboard/initial?${searchParams.toString()}`);
}

async function fetchScanDetail(scanId: string): Promise<ScanDetail | null> {
	if (!scanId) return null;
	const payload = await fetchJson<{ detail?: ScanDetail | null }>(
		`/api/scans/${encodeURIComponent(scanId)}`,
	);
	return payload.detail ?? null;
}

async function fetchWorkspaceMembers(): Promise<WorkspaceMembersResponse> {
	return fetchJson("/api/workspace/members");
}

async function fetchJson<T>(url: string): Promise<T> {
	const response = await fetch(url, {
		credentials: "same-origin",
		headers: { Accept: "application/json" },
	});
	const payload = await response.json().catch(() => null);

	if (!response.ok) {
		const message =
			payload && typeof payload === "object" && "error" in payload
				? String(payload.error)
				: "Không thể tải dữ liệu.";
		throw new Error(message);
	}

	return payload as T;
}
