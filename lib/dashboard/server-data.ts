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
					getCachedDashboardScanDetail(scanId),
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
					? await getCachedDashboardScanDetail(selectedScanId)
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
	cacheLife({ stale: 30, revalidate: 30, expire: 300 });
	cacheTag(DASHBOARD_SCANS_TAG);
	return listScans();
}

async function getCachedTrackedSources() {
	"use cache";
	cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
	cacheTag(DASHBOARD_TRACKED_SOURCES_TAG);
	return listTrackedSources();
}

export async function getCachedDashboardScanDetail(scanId: string) {
	"use cache";
	const detail = await getScanDetail(scanId);
	const isActive =
		!detail ||
		detail.job.status === "queued" ||
		detail.job.status === "running" ||
		detail.job.status === "retrying";
	cacheLife(
		isActive
			? { stale: 30, revalidate: 15, expire: 60 }
			: { stale: 300, revalidate: 300, expire: 3600 },
	);
	cacheTag(dashboardScanDetailTag(scanId));
	return toClientScanDetail(detail);
}

function serializeForClient<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}
