import { Suspense } from "react";

import {
	DashboardRoute,
	DashboardRouteSkeleton,
} from "@/components/dashboard/dashboard-route";

export const unstable_instant = {
	prefetch: "runtime",
	unstable_disableValidation: true,
	samples: [
		{
			params: { id: "00000000-0000-0000-0000-000000000000" },
			searchParams: { scanId: "00000000-0000-0000-0000-000000000000" },
		},
	],
};

export default function EvidenceDetailPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ scanId?: string }>;
}) {
	return (
		<Suspense fallback={<DashboardRouteSkeleton />}>
			<EvidenceDetailRoute params={params} searchParams={searchParams} />
		</Suspense>
	);
}

async function EvidenceDetailRoute({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ scanId?: string }>;
}) {
	const [{ id }, { scanId }] = await Promise.all([params, searchParams]);

	return (
		<DashboardRoute evidenceId={id} page="evidence-detail" scanId={scanId} />
	);
}
