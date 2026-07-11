import { Suspense } from "react";

import {
	DashboardRoute,
	DashboardRouteSkeleton,
} from "@/components/dashboard/dashboard-route";

export const instant = true;
export const prefetch = "allow-runtime";

export default function AnalysisPage() {
	return (
		<Suspense fallback={<DashboardRouteSkeleton page="analysis" />}>
			<DashboardRoute page="analysis" />
		</Suspense>
	);
}
