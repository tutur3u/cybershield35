import { revalidateTag } from "next/cache";

import {
	DASHBOARD_SCANS_TAG,
	DASHBOARD_TRACKED_SOURCES_TAG,
	dashboardScanDetailTag,
} from "@/lib/dashboard/cache-tags";

const immediateExpire = { expire: 0 } as const;

export function revalidateDashboardScans() {
	revalidateTag(DASHBOARD_SCANS_TAG, immediateExpire);
}

export function revalidateDashboardScan(scanId: string) {
	revalidateTag(DASHBOARD_SCANS_TAG, immediateExpire);
	revalidateTag(dashboardScanDetailTag(scanId), immediateExpire);
}

export function revalidateDashboardTrackedSources() {
	revalidateTag(DASHBOARD_TRACKED_SOURCES_TAG, immediateExpire);
}
