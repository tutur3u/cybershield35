import { Suspense } from "react";

import {
	DashboardRoute,
	DashboardRouteSkeleton,
} from "@/components/dashboard/dashboard-route";

export const metadata = {
	title: "Chủ đề",
};

export default function TopicsRoute() {
	return (
		<Suspense fallback={<DashboardRouteSkeleton />}>
			<DashboardRoute page="topics" />
		</Suspense>
	);
}
