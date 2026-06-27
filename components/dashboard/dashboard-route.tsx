import { CyberShieldDashboard } from "@/components/dashboard/cybershield-dashboard";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-skeleton";
import type {
	DashboardInitialData,
	DashboardPage,
	WorkspaceMembersResponse,
} from "@/components/dashboard/types";
import { getDashboardInitialData } from "@/lib/dashboard/server-data";
import { getWorkspaceMembersInitialData } from "@/lib/workspace-members/server-data";

type DashboardRouteProps = {
	draftId?: string;
	evidenceId?: string;
	page?: DashboardPage;
	scanId?: string;
};

export async function DashboardRoute({
	draftId,
	evidenceId,
	page = "overview",
	scanId,
}: DashboardRouteProps) {
	const [initialData, initialWorkspaceMembers] = await Promise.all([
		needsScanSnapshot(page)
			? getDashboardInitialData(scanId)
			: Promise.resolve(emptyDashboardInitialData(scanId)),
		page === "members"
			? getWorkspaceMembersInitialData()
			: Promise.resolve<WorkspaceMembersResponse | undefined>(undefined),
	]);

	return (
		<CyberShieldDashboard
			key={[
				page,
				scanId ?? "",
				draftId ?? "",
				evidenceId ?? "",
				initialData.selectedScanId,
			].join(":")}
			draftId={draftId}
			evidenceId={evidenceId}
			initialData={initialData}
			initialWorkspaceMembers={initialWorkspaceMembers}
			page={page}
			scanId={scanId}
		/>
	);
}

export function DashboardRouteSkeleton() {
	return <DashboardPageSkeleton />;
}

function emptyDashboardInitialData(scanId?: string): DashboardInitialData {
	return {
		detail: null,
		scans: [],
		selectedScanId: scanId ?? "",
		trackedSources: [],
	};
}

function needsScanSnapshot(page: DashboardPage) {
	return ![
		"chat",
		"guide-policies",
		"guide-process",
		"guide-user",
		"members",
		"settings",
	].includes(page);
}
