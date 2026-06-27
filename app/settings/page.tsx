import { Suspense } from "react";

import {
	DashboardRoute,
	DashboardRouteSkeleton,
} from "@/components/dashboard/dashboard-route";

export const unstable_instant = {
	prefetch: "static",
	unstable_disableValidation: true,
};

export default function SettingsPage() {
	return (
		<Suspense fallback={<DashboardRouteSkeleton />}>
			<DashboardRoute page="settings" />
		</Suspense>
	);
}
