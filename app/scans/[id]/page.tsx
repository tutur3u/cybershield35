import { Suspense } from "react";

import {
	DashboardRoute,
	DashboardRouteSkeleton,
} from "@/components/dashboard/dashboard-route";

export const instant = true;
export const prefetch = "allow-runtime";

export default function ScanDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	return (
		<Suspense fallback={<DashboardRouteSkeleton />}>
			<ScanDetailRoute params={params} />
		</Suspense>
	);
}

async function ScanDetailRoute({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	return <DashboardRoute page="scan-detail" scanId={id} />;
}
