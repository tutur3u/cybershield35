import { Suspense } from "react";

import {
	DashboardRouteFromSearchParams,
	DashboardRouteSkeleton,
	type DashboardSearchParams,
} from "@/components/dashboard/dashboard-route";

export const instant = true;
export const prefetch = "allow-runtime";

export default function ReportsPage({
	searchParams,
}: {
	searchParams: DashboardSearchParams;
}) {
	return (
		<Suspense fallback={<DashboardRouteSkeleton page="reports" />}>
			<DashboardRouteFromSearchParams
				page="reports"
				searchParams={searchParams}
			/>
		</Suspense>
	);
}
