import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";

import { IntelligenceWorkspace, type IntelligenceView } from "@/components/dashboard/intelligence-workspace";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { QueryProvider } from "@/components/providers/query-provider";
import {
	prefetchDashboardRouteData,
	prefetchIntelligenceAnalytics,
} from "@/lib/dashboard/server-prefetch";
import { intelligenceFiltersFromSearchParams, type DashboardSearchParams } from "@/lib/dashboard/query-keys";
import { getQueryClient } from "@/lib/query-client";

export const metadata = { title: "Tình báo" };
export const instant = true;

export default function IntelligencePage({ searchParams }: { searchParams: DashboardSearchParams }) {
	return (
		<Suspense fallback={<DashboardPageSkeleton title="Tình báo" description="Đang tải tổng quan, chủ đề và cảnh báo." />}>
			<IntelligenceData searchParams={searchParams} />
		</Suspense>
	);
}

async function IntelligenceData({ searchParams }: { searchParams: DashboardSearchParams }) {
	const params = await searchParams;
	const requestedView = Array.isArray(params.view) ? params.view[0] : params.view;
	const view: IntelligenceView =
		requestedView === "topics" ||
		requestedView === "alerts" ||
		requestedView === "sources"
			? requestedView
			: "overview";
	const filters = intelligenceFiltersFromSearchParams(params);
	const queryClient = getQueryClient();
	await (view === "overview"
		? prefetchIntelligenceAnalytics(queryClient, filters)
		: prefetchDashboardRouteData(queryClient, view, { filters }));

	return (
		<QueryProvider>
			<HydrationBoundary state={dehydrate(queryClient)}>
				<IntelligenceWorkspace view={view} />
			</HydrationBoundary>
		</QueryProvider>
	);
}
