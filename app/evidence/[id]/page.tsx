import { Suspense } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";

import {
	DashboardRoute,
	DashboardRouteSkeleton,
} from "@/components/dashboard/dashboard-route";
import { getTimelinePostById } from "@/lib/dashboard/timeline-server";

export const instant = true;

export default function EvidenceDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	return (
		<Suspense fallback={<DashboardRouteSkeleton page="evidence-detail" />}>
			<EvidenceDetailRoute params={params} />
		</Suspense>
	);
}

async function EvidenceDetailRoute({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	if (!z.uuid().safeParse(id).success) notFound();
	const evidence = await getTimelinePostById(id);
	if (!evidence) notFound();

	return (
		<DashboardRoute evidenceDetail={evidence} evidenceId={id} page="evidence-detail" />
	);
}
