import { Suspense } from "react";

import {
	DashboardRoute,
	DashboardRouteSkeleton,
} from "@/components/dashboard/dashboard-route";

export const unstable_instant = {
	prefetch: "static",
	unstable_disableValidation: true,
};

export default function AlertsPage() {
	return (
		<Suspense fallback={<DashboardRouteSkeleton />}>
			<DashboardRoute page="alerts" />
		</Suspense>
	);
}
