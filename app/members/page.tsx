import { io } from "next/cache";
import { Suspense } from "react";

import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { WorkspaceMembersPage } from "@/components/dashboard/workspace-members-page";
import { QueryProvider } from "@/components/providers/query-provider";
import { getLocalAccountsInitialData } from "@/lib/local-accounts/server-data";
import { getWorkspaceMembersInitialData } from "@/lib/workspace-members/server-data";

export const instant = true;

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
	const [initialData, initialLocalAccounts] = await Promise.all([
		getWorkspaceMembersInitialData(),
		getLocalAccountsInitialData(),
	]);
	return (
		<QueryProvider>
			<WorkspaceMembersPage
				initialData={initialData}
				initialLocalAccounts={initialLocalAccounts}
			/>
		</QueryProvider>
	);
}
