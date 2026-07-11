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
			"audit",
			"chat",
			"guide-policies",
			"guide-process",
			"guide-user",
			"members",
			"operations",
			"settings",
			"topic-detail",
		].includes(page)
	) {
		return {
			includeDetail: false,
			includeScans: false,
			includeTrackedSources: false,
		};
	}

	return {
		includeDetail: ![
			"alerts",
			"audit",
			"evidence",
			"overview",
			"sources",
			"topics",
			"topic-detail",
		].includes(page),
		includeScans: true,
		includeTrackedSources: page === "sources",
	};
}
