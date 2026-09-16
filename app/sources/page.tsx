import { Suspense } from "react";

import {
	DashboardRouteFromSearchParams,
	DashboardRouteSkeleton,
	type DashboardSearchParams,
} from "@/components/dashboard/dashboard-route";

export default function SourcesPage({
	searchParams,
}: {
	searchParams: DashboardSearchParams;
}) {
	return (
		<Suspense fallback={<DashboardRouteSkeleton page="sources" />}>
			<DashboardRouteFromSearchParams
				page="sources"
				searchParams={searchParams}
			/>
		</Suspense>
	);
}
