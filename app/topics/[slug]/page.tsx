import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";

import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { TopicDetailsPage as TopicDetailsContent } from "@/components/dashboard/topic-details-page";
import { QueryProvider } from "@/components/providers/query-provider";
import { prefetchDashboardRouteData } from "@/lib/dashboard/server-prefetch";
import { getQueryClient } from "@/lib/query-client";

export const metadata = {
	title: "Chi tiết chủ đề",
};

export const instant = true;
export const prefetch = "allow-runtime";

export default function TopicDetailPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	return (
		<Suspense
			fallback={
				<DashboardPageSkeleton
					description="Các bài viết và bằng chứng đã được gắn với chủ đề này."
					title="Chi tiết chủ đề"
				/>
			}
		>
			<TopicDetailRoute params={params} />
		</Suspense>
	);
}

async function TopicDetailRoute({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const queryClient = getQueryClient();
	await prefetchDashboardRouteData(queryClient, "topic-detail", { topicSlug: slug });

	return (
		<QueryProvider>
			<HydrationBoundary state={dehydrate(queryClient)}>
				<TopicDetailsContent topicSlug={slug} />
			</HydrationBoundary>
		</QueryProvider>
	);
}
