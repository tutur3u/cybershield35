import { revalidateTag } from "next/cache";

import {
	DASHBOARD_HEALTH_TAG,
	DASHBOARD_INTELLIGENCE_TAG,
	DASHBOARD_OPERATIONS_TAG,
	DASHBOARD_SCANS_TAG,
	DASHBOARD_TOPICS_TAG,
	DASHBOARD_TRACKED_SOURCES_TAG,
	dashboardIntelligenceTag,
	dashboardScanDetailTag,
	dashboardTopicTag,
	type DashboardIntelligenceCacheKind,
} from "@/lib/dashboard/cache-tags";

const immediateExpire = { expire: 0 } as const;

export function revalidateDashboardScans() {
	revalidateTag(DASHBOARD_SCANS_TAG, immediateExpire);
	revalidateDashboardIntelligence();
}

export function revalidateDashboardScan(scanId: string) {
	revalidateTag(DASHBOARD_SCANS_TAG, immediateExpire);
	revalidateTag(dashboardScanDetailTag(scanId), immediateExpire);
	revalidateTag(DASHBOARD_TOPICS_TAG, immediateExpire);
	revalidateDashboardIntelligence();
}

export function revalidateDashboardTrackedSources() {
	revalidateTag(DASHBOARD_TRACKED_SOURCES_TAG, immediateExpire);
	revalidateDashboardIntelligence();
}

export function revalidateDashboardTopics(slug?: string) {
	revalidateTag(DASHBOARD_TOPICS_TAG, immediateExpire);
	if (slug) revalidateTag(dashboardTopicTag(slug), immediateExpire);
	revalidateDashboardIntelligence("topics");
}

export function revalidateDashboardIntelligence(
	kind: DashboardIntelligenceCacheKind = "all",
) {
	revalidateTag(DASHBOARD_INTELLIGENCE_TAG, immediateExpire);
	if (kind !== "all") {
		revalidateTag(dashboardIntelligenceTag(kind), immediateExpire);
	}
}

export function revalidateDashboardHealth() {
	revalidateTag(DASHBOARD_HEALTH_TAG, immediateExpire);
	revalidateTag(DASHBOARD_OPERATIONS_TAG, immediateExpire);
}
