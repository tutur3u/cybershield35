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

export default function DraftDetailPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ scanId?: string }>;
}) {
	return (
		<Suspense fallback={<DashboardRouteSkeleton />}>
			<DraftDetailRoute params={params} searchParams={searchParams} />
		</Suspense>
	);
}

async function DraftDetailRoute({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ scanId?: string }>;
}) {
	const [{ id }, { scanId }] = await Promise.all([params, searchParams]);

	return <DashboardRoute draftId={id} page="draft-detail" scanId={scanId} />;
}
