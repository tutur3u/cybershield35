import { queryOptions } from "@tanstack/react-query";

import type {
	DashboardInitialData,
	ManagedSchedulerExecutionsView,
	ManagedSchedulerStatusView,
	ScanDetail,
	WorkspaceMembersResponse,
} from "@/components/dashboard/types";
import {
	dashboardQueryKeys,
	dashboardQueryStaleTimeMs,
	managedSchedulerQueryStaleTimeMs,
	normalizeDashboardInitialQueryParams,
	type DashboardInitialQueryParams,
	workspaceMembersQueryStaleTimeMs,
} from "@/lib/dashboard/query-keys";
import { parseManagedSchedulerStatusResponse } from "@/lib/managed-scheduler/client";

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

export function managedSchedulerQueryOptions() {
	return queryOptions({
		gcTime: 5 * 60_000,
		queryFn: fetchManagedSchedulerStatus,
		queryKey: dashboardQueryKeys.managedScheduler(),
		refetchInterval: 30_000,
		staleTime: managedSchedulerQueryStaleTimeMs,
	});
}

export function managedSchedulerExecutionsQueryOptions(jobKey?: string) {
	return queryOptions({
		gcTime: 5 * 60_000,
		queryFn: () => fetchManagedSchedulerExecutions(jobKey),
		queryKey: dashboardQueryKeys.managedSchedulerExecutions(jobKey ?? "all"),
		staleTime: 30_000,
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

export async function fetchManagedSchedulerStatus(): Promise<ManagedSchedulerStatusView> {
	const response = await fetch("/api/workspace/cron", {
		credentials: "same-origin",
		headers: { Accept: "application/json" },
	});

	return parseManagedSchedulerStatusResponse(
		response,
		"Không thể kiểm tra managed scheduler.",
	);
}

export async function fetchManagedSchedulerExecutions(
	jobKey?: string,
): Promise<ManagedSchedulerExecutionsView> {
	const searchParams = new URLSearchParams({
		page: "1",
		pageSize: "25",
	});
	const url = jobKey
		? `/api/workspace/cron/jobs/${encodeURIComponent(jobKey)}/executions?${searchParams.toString()}`
		: `/api/workspace/cron/executions?${searchParams.toString()}`;
	const payload = await fetchJson<ManagedSchedulerExecutionsView>(url);

	return {
		...payload,
		items: Array.isArray(payload.items) ? payload.items : [],
	};
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
