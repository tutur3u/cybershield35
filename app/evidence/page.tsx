import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";

import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { EvidenceWorkspace } from "@/components/dashboard/evidence-workspace";
import { QueryProvider } from "@/components/providers/query-provider";
import { prefetchDashboardRouteData } from "@/lib/dashboard/server-prefetch";
import {
	intelligenceFiltersFromSearchParams,
	type DashboardSearchParams,
} from "@/lib/dashboard/query-keys";
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
					description="Các trích dẫn đã chuẩn hóa dùng cho phân tích và phản hồi nội bộ."
					title="Kho bằng chứng"
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
	const filters = intelligenceFiltersFromSearchParams(await searchParams);
	await prefetchDashboardRouteData(queryClient, "evidence", { filters });

	return (
		<QueryProvider>
			<HydrationBoundary state={dehydrate(queryClient)}>
				<EvidenceWorkspace />
			</HydrationBoundary>
		</QueryProvider>
	);
}
