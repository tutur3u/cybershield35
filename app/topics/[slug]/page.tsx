import { Suspense } from "react";

import {
	DashboardRoute,
	DashboardRouteSkeleton,
} from "@/components/dashboard/dashboard-route";

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
		<Suspense fallback={<DashboardRouteSkeleton />}>
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
	return <DashboardRoute page="topic-detail" topicSlug={slug} />;
}
