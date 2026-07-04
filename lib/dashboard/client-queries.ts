import { queryOptions } from "@tanstack/react-query";

import type {
	DashboardInitialData,
	DashboardScansPage,
	EvidenceItemsPage,
	EvidenceView,
	IntelligenceActivityRow,
	IntelligenceClaimRow,
	IntelligenceEvidenceRow,
	IntelligenceFacebookPageOption,
	IntelligenceFilters,
	IntelligenceOverviewView,
	IntelligencePage,
	IntelligenceSourceRow,
	IntelligenceTopicRow,
	ManagedSchedulerExecutionsView,
	ManagedSchedulerStatusView,
	ScanDetail,
	TopicDetailView,
	TopicsPage,
	WorkspaceMembersResponse,
} from "@/components/dashboard/types";
import {
	dashboardQueryKeys,
	dashboardQueryStaleTimeMs,
	intelligenceQueryStaleTimeMs,
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

export function dashboardScansInfiniteQueryOptions(limit = 8) {
	return {
		gcTime: 5 * 60_000,
		getNextPageParam: (lastPage: DashboardScansPage) =>
			lastPage.hasNextPage ? lastPage.nextCursor : undefined,
		initialPageParam: null as string | null,
		queryFn: ({ pageParam }: { pageParam: string | null }) =>
			fetchDashboardScansPage({ cursor: pageParam, limit }),
		queryKey: dashboardQueryKeys.scansInfinite(limit),
		staleTime: dashboardQueryStaleTimeMs,
	};
}

export function scanEvidenceInfiniteQueryOptions(scanId: string, limit = 8) {
	return {
		enabled: Boolean(scanId),
		gcTime: 5 * 60_000,
		getNextPageParam: (lastPage: EvidenceItemsPage) =>
			lastPage.hasNextPage ? lastPage.nextCursor : undefined,
		initialPageParam: null as string | null,
		queryFn: ({ pageParam }: { pageParam: string | null }) =>
			fetchScanEvidencePage({ cursor: pageParam, limit, scanId }),
		queryKey: dashboardQueryKeys.scanEvidenceInfinite(scanId, limit),
		staleTime: dashboardQueryStaleTimeMs,
	};
}

export function topicsInfiniteQueryOptions(limit = 12) {
	return {
		gcTime: 5 * 60_000,
		getNextPageParam: (lastPage: TopicsPage) =>
			lastPage.hasNextPage ? lastPage.nextCursor : undefined,
		initialPageParam: null as string | null,
		queryFn: ({ pageParam }: { pageParam: string | null }) =>
			fetchTopicsPage({ cursor: pageParam, limit }),
		queryKey: dashboardQueryKeys.topicsInfinite(limit),
		staleTime: dashboardQueryStaleTimeMs,
	};
}

export function topicDetailInfiniteQueryOptions(slug: string, limit = 12) {
	return {
		enabled: Boolean(slug),
		gcTime: 5 * 60_000,
		getNextPageParam: (lastPage: TopicDetailView) =>
			lastPage.hasNextPage ? lastPage.nextCursor : undefined,
		initialPageParam: null as string | null,
		queryFn: ({ pageParam }: { pageParam: string | null }) =>
			fetchTopicDetailPage({ cursor: pageParam, limit, slug }),
		queryKey: dashboardQueryKeys.topicDetailInfinite(slug, limit),
		staleTime: dashboardQueryStaleTimeMs,
	};
}

export function intelligenceOverviewQueryOptions(
	filters: IntelligenceFilters = {},
) {
	const params = serializeIntelligenceFilters(filters);
	return queryOptions({
		gcTime: 5 * 60_000,
		queryFn: () => fetchIntelligenceOverview(params),
		queryKey: dashboardQueryKeys.intelligenceOverview(params),
		staleTime: intelligenceQueryStaleTimeMs,
	});
}

export function intelligenceEvidenceInfiniteQueryOptions(
	filters: IntelligenceFilters = {},
	limit = 30,
) {
	const params = serializeIntelligenceFilters(filters);
	return {
		gcTime: 5 * 60_000,
		getNextPageParam: (lastPage: IntelligencePage<IntelligenceEvidenceRow>) =>
			lastPage.hasNextPage ? lastPage.nextCursor : undefined,
		initialPageParam: null as string | null,
		queryFn: ({ pageParam }: { pageParam: string | null }) =>
			fetchIntelligencePage<IntelligenceEvidenceRow>("evidence", {
				cursor: pageParam,
				limit,
				params,
			}),
		queryKey: dashboardQueryKeys.intelligenceEvidenceInfinite(params, limit),
		staleTime: intelligenceQueryStaleTimeMs,
	};
}

export function intelligenceTopicsInfiniteQueryOptions(
	filters: IntelligenceFilters = {},
	limit = 24,
) {
	const params = serializeIntelligenceFilters(filters);
	return {
		gcTime: 5 * 60_000,
		getNextPageParam: (lastPage: IntelligencePage<IntelligenceTopicRow>) =>
			lastPage.hasNextPage ? lastPage.nextCursor : undefined,
		initialPageParam: null as string | null,
		queryFn: ({ pageParam }: { pageParam: string | null }) =>
			fetchIntelligencePage<IntelligenceTopicRow>("topics", {
				cursor: pageParam,
				limit,
				params,
			}),
		queryKey: dashboardQueryKeys.intelligenceTopicsInfinite(params, limit),
		staleTime: intelligenceQueryStaleTimeMs,
	};
}

export function intelligenceClaimsInfiniteQueryOptions(
	filters: IntelligenceFilters = {},
	limit = 24,
) {
	const params = serializeIntelligenceFilters(filters);
	return {
		gcTime: 5 * 60_000,
		getNextPageParam: (lastPage: IntelligencePage<IntelligenceClaimRow>) =>
			lastPage.hasNextPage ? lastPage.nextCursor : undefined,
		initialPageParam: null as string | null,
		queryFn: ({ pageParam }: { pageParam: string | null }) =>
			fetchIntelligencePage<IntelligenceClaimRow>("claims", {
				cursor: pageParam,
				limit,
				params,
			}),
		queryKey: dashboardQueryKeys.intelligenceClaimsInfinite(params, limit),
		staleTime: intelligenceQueryStaleTimeMs,
	};
}

export function intelligenceSourcesInfiniteQueryOptions(
	filters: IntelligenceFilters = {},
	limit = 24,
) {
	const params = serializeIntelligenceFilters(filters);
	return {
		gcTime: 5 * 60_000,
		getNextPageParam: (lastPage: IntelligencePage<IntelligenceSourceRow>) =>
			lastPage.hasNextPage ? lastPage.nextCursor : undefined,
		initialPageParam: null as string | null,
		queryFn: ({ pageParam }: { pageParam: string | null }) =>
			fetchIntelligencePage<IntelligenceSourceRow>("sources", {
				cursor: pageParam,
				limit,
				params,
			}),
		queryKey: dashboardQueryKeys.intelligenceSourcesInfinite(params, limit),
		staleTime: intelligenceQueryStaleTimeMs,
	};
}

export function intelligenceActivityInfiniteQueryOptions(
	filters: IntelligenceFilters = {},
	limit = 30,
) {
	const params = serializeIntelligenceFilters(filters);
	return {
		gcTime: 5 * 60_000,
		getNextPageParam: (lastPage: IntelligencePage<IntelligenceActivityRow>) =>
			lastPage.hasNextPage ? lastPage.nextCursor : undefined,
		initialPageParam: null as string | null,
		queryFn: ({ pageParam }: { pageParam: string | null }) =>
			fetchIntelligencePage<IntelligenceActivityRow>("activity", {
				cursor: pageParam,
				limit,
				params,
			}),
		queryKey: dashboardQueryKeys.intelligenceActivityInfinite(params, limit),
		staleTime: intelligenceQueryStaleTimeMs,
	};
}

export function intelligenceFacebookPagesQueryOptions() {
	return queryOptions({
		gcTime: 5 * 60_000,
		queryFn: fetchIntelligenceFacebookPages,
		queryKey: dashboardQueryKeys.intelligenceFacebookPages(),
		staleTime: intelligenceQueryStaleTimeMs,
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

export async function fetchDashboardScansPage({
	cursor,
	limit = 8,
}: {
	cursor?: string | null;
	limit?: number;
} = {}): Promise<DashboardScansPage> {
	const searchParams = new URLSearchParams({
		limit: String(limit),
	});
	if (cursor) searchParams.set("cursor", cursor);
	const payload = await fetchJson<Partial<DashboardScansPage> & { scans?: unknown }>(
		`/api/scans?${searchParams.toString()}`,
	);
	const fallbackItems = Array.isArray(payload.scans)
		? (payload.scans as DashboardScansPage["items"])
		: [];

	return {
		hasNextPage: Boolean(payload.hasNextPage),
		items: Array.isArray(payload.items) ? payload.items : fallbackItems,
		limit: payload.limit ?? limit,
		nextCursor: payload.nextCursor ?? null,
	};
}

export async function fetchScanEvidencePage({
	cursor,
	limit = 8,
	scanId,
}: {
	cursor?: string | null;
	limit?: number;
	scanId: string;
}): Promise<EvidenceItemsPage> {
	if (!scanId) {
		return { hasNextPage: false, items: [], limit, nextCursor: null, scanId };
	}
	const searchParams = new URLSearchParams({
		limit: String(limit),
	});
	if (cursor) searchParams.set("cursor", cursor);

	const payload = await fetchJson<Partial<EvidenceItemsPage>>(
		`/api/scans/${encodeURIComponent(scanId)}/evidence?${searchParams.toString()}`,
	);

	return {
		hasNextPage: Boolean(payload.hasNextPage),
		items: Array.isArray(payload.items) ? (payload.items as EvidenceView) : [],
		limit: payload.limit ?? limit,
		nextCursor: payload.nextCursor ?? null,
		scanId: payload.scanId ?? scanId,
	};
}

export async function fetchTopicsPage({
	cursor,
	limit = 12,
}: {
	cursor?: string | null;
	limit?: number;
} = {}): Promise<TopicsPage> {
	const searchParams = new URLSearchParams({
		limit: String(limit),
	});
	if (cursor) searchParams.set("cursor", cursor);
	const payload = await fetchJson<Partial<TopicsPage>>(
		`/api/topics?${searchParams.toString()}`,
	);

	return {
		hasNextPage: Boolean(payload.hasNextPage),
		items: Array.isArray(payload.items) ? payload.items : [],
		limit: payload.limit ?? limit,
		nextCursor: payload.nextCursor ?? null,
	};
}

export async function fetchTopicDetailPage({
	cursor,
	limit = 12,
	slug,
}: {
	cursor?: string | null;
	limit?: number;
	slug: string;
}): Promise<TopicDetailView> {
	const searchParams = new URLSearchParams({
		limit: String(limit),
	});
	if (cursor) searchParams.set("cursor", cursor);
	const payload = await fetchJson<{ topic?: TopicDetailView }>(
		`/api/topics/${encodeURIComponent(slug)}?${searchParams.toString()}`,
	);

	if (!payload.topic) throw new Error("Không tìm thấy chủ đề.");

	return {
		...payload.topic,
		evidence: Array.isArray(payload.topic.evidence)
			? payload.topic.evidence
			: [],
		hasNextPage: Boolean(payload.topic.hasNextPage),
		limit: payload.topic.limit ?? limit,
		nextCursor: payload.topic.nextCursor ?? null,
	};
}

async function fetchWorkspaceMembers(): Promise<WorkspaceMembersResponse> {
	return fetchJson("/api/workspace/members");
}

async function fetchIntelligenceOverview(
	params: Record<string, string>,
): Promise<IntelligenceOverviewView> {
	const searchParams = new URLSearchParams(params);
	const payload = await fetchJson<{ overview?: IntelligenceOverviewView }>(
		`/api/intelligence/overview?${searchParams.toString()}`,
	);
	if (!payload.overview) throw new Error("Không thể tải tổng quan intelligence.");
	return payload.overview;
}

async function fetchIntelligenceFacebookPages(): Promise<
	IntelligenceFacebookPageOption[]
> {
	const payload = await fetchJson<{
		pages?: IntelligenceFacebookPageOption[];
	}>("/api/intelligence/facebook-pages");
	return Array.isArray(payload.pages) ? payload.pages : [];
}

async function fetchIntelligencePage<T>(
	kind: "activity" | "claims" | "evidence" | "sources" | "topics",
	{
		cursor,
		limit,
		params,
	}: {
		cursor?: string | null;
		limit: number;
		params: Record<string, string>;
	},
): Promise<IntelligencePage<T>> {
	const searchParams = new URLSearchParams({
		...params,
		limit: String(limit),
	});
	if (cursor) searchParams.set("cursor", cursor);
	const payload = await fetchJson<Partial<IntelligencePage<T>>>(
		`/api/intelligence/${kind}?${searchParams.toString()}`,
	);

	return {
		hasNextPage: Boolean(payload.hasNextPage),
		items: Array.isArray(payload.items) ? payload.items : [],
		limit: payload.limit ?? limit,
		nextCursor: payload.nextCursor ?? null,
	};
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

function serializeIntelligenceFilters(
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
