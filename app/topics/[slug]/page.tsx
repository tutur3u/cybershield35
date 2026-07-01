import { Suspense } from "react";

import {
	DashboardRoute,
	DashboardRouteSkeleton,
} from "@/components/dashboard/dashboard-route";

export const metadata = {
	title: "Chi tiết chủ đề",
};

export default async function TopicDetailRoute({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;

	return (
		<Suspense fallback={<DashboardRouteSkeleton />}>
			<DashboardRoute page="topic-detail" topicSlug={slug} />
		</Suspense>
	);
}
