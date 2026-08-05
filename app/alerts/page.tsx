import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";

import { AlertsPage as AlertsContent } from "@/components/dashboard/alerts-page";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { QueryProvider } from "@/components/providers/query-provider";
import { prefetchDashboardRouteData } from "@/lib/dashboard/server-prefetch";
import {
	intelligenceFiltersFromSearchParams,
	type DashboardSearchParams,
} from "@/lib/dashboard/query-keys";
import { getQueryClient } from "@/lib/query-client";

export const instant = true;

export default function AlertsPage({
	searchParams,
}: {
	searchParams: DashboardSearchParams;
}) {
	return (
		<Suspense
			fallback={
				<DashboardPageSkeleton
					description="Đồ thị claim, bằng chứng hỗ trợ và luồng xử lý rủi ro."
					title="Cảnh báo & Rủi ro"
				/>
			}
		>
			<AlertsData searchParams={searchParams} />
		</Suspense>
	);
}

async function AlertsData({
	searchParams,
}: {
	searchParams: DashboardSearchParams;
}) {
	const queryClient = getQueryClient();
	const filters = intelligenceFiltersFromSearchParams(await searchParams);
	await prefetchDashboardRouteData(queryClient, "alerts", { filters });

	return (
		<QueryProvider>
			<HydrationBoundary state={dehydrate(queryClient)}>
				<AlertsContent />
			</HydrationBoundary>
		</QueryProvider>
	);
}
