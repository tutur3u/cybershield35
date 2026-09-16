import { Suspense } from "react";

import {
	DashboardRoute,
	DashboardRouteSkeleton,
} from "@/components/dashboard/dashboard-route";

export default function AnalysisPage() {
	return (
		<Suspense fallback={<DashboardRouteSkeleton page="analysis" />}>
			<DashboardRoute page="analysis" />
		</Suspense>
	);
}
