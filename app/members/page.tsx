import { io } from "next/cache";
import { Suspense } from "react";

import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { WorkspaceMembersPage } from "@/components/dashboard/workspace-members-page";
import { QueryProvider } from "@/components/providers/query-provider";
import { getWorkspaceMembersInitialData } from "@/lib/workspace-members/server-data";

export const instant = true;
export const prefetch = "allow-runtime";

export default function MembersPage() {
	return (
		<Suspense
			fallback={
				<DashboardPageSkeleton
					description="Mời người vận hành, thu hồi quyền truy cập và phân quyền admin."
					title="Thành viên"
				/>
			}
		>
			<MembersData />
		</Suspense>
	);
}

async function MembersData() {
	await io();
	const initialData = await getWorkspaceMembersInitialData();
	return (
		<QueryProvider>
			<WorkspaceMembersPage initialData={initialData} />
		</QueryProvider>
	);
}
