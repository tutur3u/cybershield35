import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";

import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { TopicsWorkspace } from "@/components/dashboard/topics-workspace";
import { QueryProvider } from "@/components/providers/query-provider";
import { prefetchDashboardRouteData } from "@/lib/dashboard/server-prefetch";
import {
	intelligenceFiltersFromSearchParams,
	type DashboardSearchParams,
} from "@/lib/dashboard/query-keys";
import { getQueryClient } from "@/lib/query-client";

export const metadata = {
	title: "Chủ đề",
};

export const instant = true;

export default function TopicsRoute({
	searchParams,
}: {
	searchParams: DashboardSearchParams;
}) {
	return (
		<Suspense
			fallback={
				<DashboardPageSkeleton
					description="Cụm nội dung, mức chú ý, xu hướng và bằng chứng mẫu."
					title="Chủ đề"
				/>
			}
		>
			<TopicsData searchParams={searchParams} />
		</Suspense>
	);
}

async function TopicsData({
	searchParams,
}: {
	searchParams: DashboardSearchParams;
}) {
	const queryClient = getQueryClient();
	const filters = intelligenceFiltersFromSearchParams(await searchParams);
	await prefetchDashboardRouteData(queryClient, "topics", { filters });

	return (
		<QueryProvider>
			<HydrationBoundary state={dehydrate(queryClient)}>
				<TopicsWorkspace />
			</HydrationBoundary>
		</QueryProvider>
	);
}
