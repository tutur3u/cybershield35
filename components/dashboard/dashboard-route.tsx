import {
	dehydrate,
	HydrationBoundary,
} from "@tanstack/react-query";
import { io } from "next/cache";

import { CyberShieldDashboard } from "@/components/dashboard/cybershield-dashboard";
import {
	AnalysisPageSkeleton,
	DashboardPageSkeleton,
} from "@/components/dashboard/dashboard-skeleton";
import { QueryProvider } from "@/components/providers/query-provider";
import type {
	DashboardInitialData,
	DashboardPage,
	IntelligenceFilters,
	TimelinePost,
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
	evidenceDetail?: TimelinePost;
	intelligenceFilters?: IntelligenceFilters;
	page?: DashboardPage;
	scanId?: string;
	topicSlug?: string;
};

export async function DashboardRoute({
	draftId,
	evidenceId,
	evidenceDetail,
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
	if (evidenceDetail) {
		queryClient.setQueryData(
			dashboardQueryKeys.evidenceDetail(evidenceDetail.id),
			evidenceDetail,
		);
	}
	if (page === "members" && !initialWorkspaceMembers) {
		queryClient.setQueryData(
			dashboardQueryKeys.workspaceMembers(),
			emptyWorkspaceMembers,
		);
	}

	return (
		<QueryProvider>
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
		</QueryProvider>
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

export function DashboardRouteSkeleton({
	page = "overview",
}: {
	page?: DashboardPage;
}) {
	if (page === "analysis") return <AnalysisPageSkeleton />;
	return <DashboardPageSkeleton {...(dashboardSkeletonCopy[page] ?? {})} />;
}

const dashboardSkeletonCopy: Partial<
	Record<DashboardPage, { description: string; title: string }>
> = {
	analysis: {
		description: "Chủ đề, lập trường, cảm xúc, rủi ro và bằng chứng chuẩn hóa.",
		title: "Phân tích thảo luận",
	},
	"counter-arguments": {
		description: "Soạn bản nháp có trích dẫn bằng chứng, chờ người vận hành duyệt.",
		title: "Lập luận phản hồi",
	},
	"draft-detail": {
		description: "Nội dung phản hồi, citation và trạng thái duyệt.",
		title: "Chi tiết bản nháp",
	},
	"evidence-detail": {
		description: "Nguồn, trích dẫn và ngữ cảnh của bằng chứng đã lưu.",
		title: "Chi tiết bằng chứng",
	},
	overview: {
		description:
			"Tư thế rủi ro, động lượng chủ đề, độ mạnh bằng chứng, sức khỏe nguồn và độ sẵn sàng báo cáo.",
		title: "Tổng quan tình báo điều hành",
	},
	reports: {
		description: "Các chế độ xuất báo cáo phục vụ trao đổi nội bộ và điều phối.",
		title: "Báo cáo",
	},
	"scan-detail": {
		description: "Phân tích, bằng chứng và tiến trình của scan đang chọn.",
		title: "Chi tiết scan",
	},
	sources: {
		description:
			"Quản lý fanpage, quét nội dung mới và theo dõi kết quả trong một nơi.",
		title: "Nguồn & Quét",
	},
};

function emptyDashboardInitialData(scanId?: string): DashboardInitialData {
	return {
		detail: null,
		scans: [],
		selectedScanId: scanId ?? "",
		trackedSources: [],
	};
}
