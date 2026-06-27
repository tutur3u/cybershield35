import { Suspense } from "react";

import {
	DashboardRoute,
	DashboardRouteSkeleton,
} from "@/components/dashboard/dashboard-route";

export const unstable_instant = {
	prefetch: "runtime",
	unstable_disableValidation: true,
	samples: [{ params: { id: "00000000-0000-0000-0000-000000000000" } }],
};

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
