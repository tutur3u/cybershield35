import { Suspense } from "react";

import {
	DashboardRoute,
	DashboardRouteSkeleton,
} from "@/components/dashboard/dashboard-route";

export const unstable_instant = {
	prefetch: "static",
	unstable_disableValidation: true,
};

export default function ReportsPage() {
	return (
		<Suspense fallback={<DashboardRouteSkeleton />}>
			<DashboardRoute page="reports" />
		</Suspense>
	);
}
