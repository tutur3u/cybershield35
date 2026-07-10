import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";

import { AlertsPage as AlertsContent } from "@/components/dashboard/alerts-page";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { prefetchDashboardRouteData } from "@/lib/dashboard/server-prefetch";
import {
	intelligenceFiltersFromSearchParams,
	type DashboardSearchParams,
} from "@/lib/dashboard/query-keys";
import { getQueryClient } from "@/lib/query-client";

export const instant = true;
export const prefetch = "allow-runtime";

export default function AlertsPage({
	searchParams,
}: {
	searchParams: DashboardSearchParams;
}) {
	return (
		<Suspense fallback={<DashboardPageSkeleton />}>
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
		<HydrationBoundary state={dehydrate(queryClient)}>
			<AlertsContent />
		</HydrationBoundary>
	);
}
