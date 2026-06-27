export const DASHBOARD_SCANS_TAG = "dashboard:scans";
export const DASHBOARD_TRACKED_SOURCES_TAG = "dashboard:tracked-sources";

export function dashboardScanDetailTag(scanId: string) {
	return `dashboard:scan:${scanId}`;
}
