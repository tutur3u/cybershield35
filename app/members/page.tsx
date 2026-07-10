import { Suspense } from "react";

import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { WorkspaceMembersPage } from "@/components/dashboard/workspace-members-page";
import { getWorkspaceMembersInitialData } from "@/lib/workspace-members/server-data";

export const instant = true;
export const prefetch = "allow-runtime";

export default function MembersPage() {
	return (
		<Suspense fallback={<DashboardPageSkeleton />}>
			<MembersData />
		</Suspense>
	);
}

async function MembersData() {
	const initialData = await getWorkspaceMembersInitialData();
	return <WorkspaceMembersPage initialData={initialData} />;
}
