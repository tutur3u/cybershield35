import {
	dehydrate,
	HydrationBoundary,
} from "@tanstack/react-query";

import { CyberShieldDashboard } from "@/components/dashboard/cybershield-dashboard";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-skeleton";
import type {
	DashboardInitialData,
	DashboardPage,
	WorkspaceMembersResponse,
} from "@/components/dashboard/types";
import {
	dashboardQueryKeys,
	dashboardQueryStaleTimeMs,
	workspaceMembersQueryStaleTimeMs,
} from "@/lib/dashboard/query-keys";
import { dashboardSnapshotRequirements } from "@/lib/dashboard/route-requirements";
import { getDashboardInitialData } from "@/lib/dashboard/server-data";
import { getQueryClient } from "@/lib/query-client";
import { emptyWorkspaceMembers } from "@/lib/workspace-members/server-data";
import { getWorkspaceMembersInitialData } from "@/lib/workspace-members/server-data";

type DashboardRouteProps = {
	draftId?: string;
	evidenceId?: string;
	page?: DashboardPage;
	scanId?: string;
	topicSlug?: string;
};

export async function DashboardRoute({
	draftId,
	evidenceId,
	page = "overview",
	scanId,
	topicSlug,
}: DashboardRouteProps) {
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
				initialData={initialData}
				initialWorkspaceMembers={initialWorkspaceMembers}
				page={page}
				scanId={scanId}
				topicSlug={topicSlug}
			/>
		</HydrationBoundary>
	);
}

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
