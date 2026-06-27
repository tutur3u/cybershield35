import "server-only";

import { cache } from "react";

import type { DashboardInitialData } from "@/components/dashboard/types";
import { getScanDetail, listScans } from "@/lib/workers/scans";
import { listTrackedSources } from "@/lib/workers/tracked-sources";

export const getDashboardInitialData = cache(
	async (scanId?: string | null): Promise<DashboardInitialData> => {
		try {
			const [scans, trackedSources] = await Promise.all([
				listScans(),
				listTrackedSources(),
			]);
			const selectedScanId = scanId || scans[0]?.id || "";
			const detail = selectedScanId ? await getScanDetail(selectedScanId) : null;

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

function serializeForClient<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}
