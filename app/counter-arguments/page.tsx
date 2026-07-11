import { Suspense } from "react";

import {
	DashboardRoute,
	DashboardRouteSkeleton,
} from "@/components/dashboard/dashboard-route";

export const instant = true;
export const prefetch = "allow-runtime";

export default function CounterArgumentsPage() {
	return (
		<Suspense fallback={<DashboardRouteSkeleton page="counter-arguments" />}>
			<DashboardRoute page="counter-arguments" />
		</Suspense>
	);
}
