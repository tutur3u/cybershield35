import type { DashboardPage } from "@/components/dashboard/types";

export type DashboardSnapshotRequirements = {
	includeDetail: boolean;
	includeScans: boolean;
	includeTrackedSources: boolean;
};

export function dashboardSnapshotRequirements(
	page: DashboardPage,
): DashboardSnapshotRequirements {
	if (
		[
			"chat",
			"guide-policies",
			"guide-process",
			"guide-user",
			"members",
			"settings",
		].includes(page)
	) {
		return {
			includeDetail: false,
			includeScans: false,
			includeTrackedSources: false,
		};
	}

	return {
		includeDetail: page !== "sources",
		includeScans: true,
		includeTrackedSources: page === "sources",
	};
}
