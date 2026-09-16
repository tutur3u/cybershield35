import { cachedData } from "@/lib/cache/data";
import "server-only";

import { cache } from "react";

import type { DashboardInitialData } from "@/components/dashboard/types";
import {
	DASHBOARD_SCANS_TAG,
	DASHBOARD_TRACKED_SOURCES_TAG,
	dashboardScanDetailTag,
} from "@/lib/dashboard/cache-tags";
import { toClientScanDetail } from "@/lib/dashboard/detail-projection";
import {
	getLatestScanId,
	getScanDetail,
	listScans,
} from "@/lib/workers/scans";
import { listTrackedSources } from "@/lib/workers/tracked-sources";

export const getDashboardInitialData = cache(
	async (
		scanId?: string | null,
		includeDetail = true,
		includeTrackedSources = false,
	): Promise<DashboardInitialData> => {
		try {
			const scansPromise = getCachedScans();
			const trackedSourcesPromise = includeTrackedSources
				? getCachedTrackedSources()
				: Promise.resolve([]);
			const selectedScanIdPromise = scanId
				? Promise.resolve(scanId)
				: includeDetail
					? getCachedLatestScanId()
					: Promise.resolve("");

			if (includeDetail) {
				const selectedScanId = await selectedScanIdPromise;
				const detailPromise = selectedScanId
					? getCachedDashboardScanDetail(selectedScanId)
					: Promise.resolve(null);
				const [detail, scans, trackedSources] = await Promise.all([
					detailPromise,
					scansPromise,
					trackedSourcesPromise,
				]);

				return serializeForClient({
					detail,
					scans,
					selectedScanId,
					trackedSources,
				});
			}

			const [scans, trackedSources] = await Promise.all([
				scansPromise,
				trackedSourcesPromise,
			]);
			const selectedScanId = scanId || scans[0]?.id || "";

			return serializeForClient({
				detail: null,
				scans,
				selectedScanId,
				trackedSources,
			});
		} catch (error) {
			return {
				detail: null,
				loadError:
					error instanceof Error
						? error.message
						: "Không thể tải dữ liệu bảng điều khiển.",
				scans: [],
				selectedScanId: scanId || "",
				trackedSources: [],
			};
		}
	},
);

async function getCachedScans() {
 return cachedData("lib/dashboard/server-data.ts:getCachedScans", [], {revalidate: 30, tags: [DASHBOARD_SCANS_TAG]}, async () => {
return listScans();
 });
}

async function getCachedLatestScanId() {
 return cachedData("lib/dashboard/server-data.ts:getCachedLatestScanId", [], {revalidate: 30, tags: [DASHBOARD_SCANS_TAG]}, async () => {
return getLatestScanId();
 });
}

async function getCachedTrackedSources() {
 return cachedData("lib/dashboard/server-data.ts:getCachedTrackedSources", [], {revalidate: 300, tags: [DASHBOARD_TRACKED_SOURCES_TAG]}, async () => {
return listTrackedSources();
 });
}

export async function getCachedDashboardScanDetail(scanId: string) {
 return cachedData("lib/dashboard/server-data.ts:getCachedDashboardScanDetail", [scanId], {revalidate: 15, tags: [dashboardScanDetailTag(scanId)]}, async () => {
const detail = await getScanDetail(scanId);
return toClientScanDetail(detail);
 });
}

function serializeForClient<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}
