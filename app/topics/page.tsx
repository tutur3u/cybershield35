import { Suspense } from "react";

import {
	DashboardRouteFromSearchParams,
	DashboardRouteSkeleton,
	type DashboardSearchParams,
} from "@/components/dashboard/dashboard-route";

export const metadata = {
	title: "Chủ đề",
};

export const instant = true;
export const prefetch = "allow-runtime";

export default function TopicsRoute({
	searchParams,
}: {
	searchParams: DashboardSearchParams;
}) {
	return (
		<Suspense fallback={<DashboardRouteSkeleton />}>
			<DashboardRouteFromSearchParams
				page="topics"
				searchParams={searchParams}
			/>
		</Suspense>
	);
}
