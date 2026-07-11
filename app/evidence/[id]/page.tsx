import { Suspense } from "react";

import {
	DashboardRoute,
	DashboardRouteSkeleton,
} from "@/components/dashboard/dashboard-route";

export const instant = true;
export const prefetch = "allow-runtime";

export default function EvidenceDetailPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ scanId?: string }>;
}) {
	return (
		<Suspense fallback={<DashboardRouteSkeleton page="evidence-detail" />}>
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
