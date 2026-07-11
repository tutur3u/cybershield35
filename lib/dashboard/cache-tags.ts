export const DASHBOARD_SCANS_TAG = "dashboard:scans:list";
export const DASHBOARD_INTELLIGENCE_TAG = "dashboard:intelligence:all";
export const DASHBOARD_TRACKED_SOURCES_TAG = "dashboard:tracked-sources";
export const DASHBOARD_TOPICS_TAG = "dashboard:topics:list";
export const DASHBOARD_HEALTH_TAG = "dashboard:health";
export const DASHBOARD_OPERATIONS_TAG = "dashboard:operations";

export type DashboardIntelligenceCacheKind =
	| "activity"
	| "all"
	| "claims"
	| "evidence"
	| "facebook-pages"
	| "overview"
	| "sources"
	| "timeline"
	| "topics";

export function dashboardScanDetailTag(scanId: string) {
	return `dashboard:scan:${scanId}`;
}

export function dashboardTopicTag(slug: string) {
	return `dashboard:topic:${slug}`;
}

export function dashboardIntelligenceTag(
	kind: DashboardIntelligenceCacheKind,
) {
	return `dashboard:intelligence:${kind}`;
}
