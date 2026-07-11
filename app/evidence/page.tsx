import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";

import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { EvidenceWorkspace } from "@/components/dashboard/evidence-workspace";
import { QueryProvider } from "@/components/providers/query-provider";
import { prefetchTimeline } from "@/lib/dashboard/server-prefetch";
import { type DashboardSearchParams } from "@/lib/dashboard/query-keys";
import { timelineFiltersFromRecord } from "@/lib/dashboard/timeline-query";
import { getQueryClient } from "@/lib/query-client";

export const instant = true;

export default function EvidencePage({
	searchParams,
}: {
	searchParams: DashboardSearchParams;
}) {
	return (
		<Suspense
			fallback={
				<DashboardPageSkeleton
					description="Theo dõi mọi bài viết đã chuẩn hóa và phối hợp xử lý nội bộ."
					title="Dòng thời gian"
				/>
			}
		>
			<EvidenceData searchParams={searchParams} />
		</Suspense>
	);
}

async function EvidenceData({
	searchParams,
}: {
	searchParams: DashboardSearchParams;
}) {
	const queryClient = getQueryClient();
	const filters = timelineFiltersFromRecord(await searchParams);
	await prefetchTimeline(queryClient, filters);

	return (
		<QueryProvider>
			<HydrationBoundary state={dehydrate(queryClient)}>
				<EvidenceWorkspace />
			</HydrationBoundary>
		</QueryProvider>
	);
}
