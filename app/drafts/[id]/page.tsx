import { Suspense } from "react";

import {
	DashboardRoute,
	DashboardRouteSkeleton,
} from "@/components/dashboard/dashboard-route";

export const instant = true;
export const prefetch = "allow-runtime";

export default function DraftDetailPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ scanId?: string }>;
}) {
	return (
		<Suspense fallback={<DashboardRouteSkeleton page="draft-detail" />}>
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
