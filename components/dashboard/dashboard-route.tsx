import {
	dehydrate,
	HydrationBoundary,
} from "@tanstack/react-query";
import { io } from "next/cache";

import { CyberShieldDashboard } from "@/components/dashboard/cybershield-dashboard";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-skeleton";
import type {
	DashboardInitialData,
	DashboardPage,
	IntelligenceFilters,
	WorkspaceMembersResponse,
} from "@/components/dashboard/types";
import {
	intelligenceFiltersFromSearchParams,
	dashboardQueryKeys,
	dashboardQueryStaleTimeMs,
	type DashboardSearchParams,
	workspaceMembersQueryStaleTimeMs,
} from "@/lib/dashboard/query-keys";
import { dashboardSnapshotRequirements } from "@/lib/dashboard/route-requirements";
import { getDashboardInitialData } from "@/lib/dashboard/server-data";
import { getQueryClient } from "@/lib/query-client";
import { prefetchDashboardRouteData } from "@/lib/dashboard/server-prefetch";
import { emptyWorkspaceMembers } from "@/lib/workspace-members/server-data";
import { getWorkspaceMembersInitialData } from "@/lib/workspace-members/server-data";

type DashboardRouteProps = {
	draftId?: string;
	evidenceId?: string;
	intelligenceFilters?: IntelligenceFilters;
	page?: DashboardPage;
	scanId?: string;
	topicSlug?: string;
};

export async function DashboardRoute({
	draftId,
	evidenceId,
	intelligenceFilters,
	page = "overview",
	scanId,
	topicSlug,
}: DashboardRouteProps) {
	await io();
	const requirements = dashboardSnapshotRequirements(page);
	const queryClient = getQueryClient();
	const [initialData, initialWorkspaceMembers] = await Promise.all([
		requirements.includeScans
			? queryClient.fetchQuery({
					queryFn: () =>
						getDashboardInitialData(
							scanId,
							requirements.includeDetail,
							requirements.includeTrackedSources,
						),
					queryKey: dashboardQueryKeys.initial({ ...requirements, scanId }),
					staleTime: dashboardQueryStaleTimeMs,
				})
			: Promise.resolve(emptyDashboardInitialData(scanId)),
		page === "members"
			? queryClient.fetchQuery({
					queryFn: getWorkspaceMembersInitialData,
					queryKey: dashboardQueryKeys.workspaceMembers(),
					staleTime: workspaceMembersQueryStaleTimeMs,
				})
			: Promise.resolve<WorkspaceMembersResponse | undefined>(undefined),
		prefetchDashboardRouteData(queryClient, page, {
			filters: intelligenceFilters,
			topicSlug,
		}),
	]);

	if (initialData.detail && initialData.selectedScanId) {
		queryClient.setQueryData(
			dashboardQueryKeys.scanDetail(initialData.selectedScanId),
			initialData.detail,
		);
	}
	if (page === "members" && !initialWorkspaceMembers) {
		queryClient.setQueryData(
			dashboardQueryKeys.workspaceMembers(),
			emptyWorkspaceMembers,
		);
	}

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<CyberShieldDashboard
				key={[
					page,
					scanId ?? "",
					topicSlug ?? "",
					draftId ?? "",
					evidenceId ?? "",
					initialData.selectedScanId,
				].join(":")}
				draftId={draftId}
				evidenceId={evidenceId}
				page={page}
				scanId={scanId}
				topicSlug={topicSlug}
			/>
		</HydrationBoundary>
	);
}

export async function DashboardRouteFromSearchParams({
	page,
	searchParams,
}: {
	page: DashboardPage;
	searchParams: DashboardSearchParams;
}) {
	const intelligenceFilters = intelligenceFiltersFromSearchParams(
		await searchParams,
	);
	return (
		<DashboardRoute page={page} intelligenceFilters={intelligenceFilters} />
	);
}

export type { DashboardSearchParams };

export function DashboardRouteSkeleton() {
	return <DashboardPageSkeleton />;
}

function emptyDashboardInitialData(scanId?: string): DashboardInitialData {
	return {
		detail: null,
		scans: [],
		selectedScanId: scanId ?? "",
		trackedSources: [],
	};
}
