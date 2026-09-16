import { Suspense } from "react";

import {
	DashboardRouteFromSearchParams,
	DashboardRouteSkeleton,
	type DashboardSearchParams,
} from "@/components/dashboard/dashboard-route";

export default function Home({
	searchParams,
}: {
	searchParams: DashboardSearchParams;
}) {
	return (
		<Suspense fallback={<DashboardRouteSkeleton page="overview" />}>
			<DashboardRouteFromSearchParams
				page="overview"
				searchParams={searchParams}
			/>
		</Suspense>
	);
}
