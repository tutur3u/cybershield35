import "server-only";

import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";

import type { DashboardInitialData } from "@/components/dashboard/types";
import {
	DASHBOARD_SCANS_TAG,
	DASHBOARD_TRACKED_SOURCES_TAG,
	dashboardScanDetailTag,
} from "@/lib/dashboard/cache-tags";
import { toClientScanDetail } from "@/lib/dashboard/detail-projection";
import { getScanDetail, listScans } from "@/lib/workers/scans";
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

			if (scanId && includeDetail) {
				const [detail, scans, trackedSources] = await Promise.all([
					getCachedScanDetail(scanId),
					scansPromise,
					trackedSourcesPromise,
				]);

				return serializeForClient({
					detail,
					scans,
					selectedScanId: scanId,
					trackedSources,
				});
			}

			const [scans, trackedSources] = await Promise.all([
				scansPromise,
				trackedSourcesPromise,
			]);
			const selectedScanId = scanId || scans[0]?.id || "";
			const detail =
				includeDetail && selectedScanId
					? await getCachedScanDetail(selectedScanId)
					: null;

			return serializeForClient({
				detail,
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
	"use cache";
	cacheLife({ stale: 15, revalidate: 5, expire: 60 });
	cacheTag(DASHBOARD_SCANS_TAG);
	return listScans();
}

async function getCachedTrackedSources() {
	"use cache";
	cacheLife({ stale: 30, revalidate: 10, expire: 120 });
	cacheTag(DASHBOARD_TRACKED_SOURCES_TAG);
	return listTrackedSources();
}

async function getCachedScanDetail(scanId: string) {
	"use cache";
	cacheLife({ stale: 15, revalidate: 5, expire: 60 });
	cacheTag(DASHBOARD_SCANS_TAG, dashboardScanDetailTag(scanId));
	const detail = await getScanDetail(scanId);
	return toClientScanDetail(detail);
}

function serializeForClient<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}
