import { afterEach, describe, expect, mock, test } from "bun:test";

import { runScanRecord } from "@/components/dashboard/client-actions";
import type { DashboardScan, ScanDetail } from "@/components/dashboard/types";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	mock.restore();
});

describe("dashboard scan actions", () => {
	test("manually runs a scan and refreshes the in-memory row/detail", async () => {
		const scan: DashboardScan = {
			createdAt: "2026-06-27T00:00:00.000Z",
			id: "367f0107-77e5-448e-9aec-97b442000001",
			progress: 0,
			provider: "local_text",
			riskLevel: "medium",
			sourceLabel: "Văn bản",
			sourceType: "text",
			status: "queued",
			title: "Manual scan",
		};
		const nextScan = { ...scan, progress: 100, status: "completed" as const };
		const nextDetail: ScanDetail = {
			evidence: [{ id: "evidence-1", quote: "A", summary: "B" }],
		};
		let scans = [scan];
		let detail: ScanDetail | null = null;
		let notice = "";
		const fetchMock = mock(() =>
			Promise.resolve(
				Response.json({
					detail: nextDetail,
					processed: true,
					scan: nextScan,
				}),
			),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const result = await runScanRecord({
			scan,
			setDetail: (updater) => {
				detail = typeof updater === "function" ? updater(detail) : updater;
			},
			setNotice: (value) => {
				notice = value;
			},
			setScans: (updater) => {
				scans = typeof updater === "function" ? updater(scans) : updater;
			},
		});

		expect(result).toBe(true);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/scans/367f0107-77e5-448e-9aec-97b442000001/run",
			{ method: "POST" },
		);
		expect(scans).toEqual([nextScan]);
		expect(detail).toEqual(nextDetail);
		expect(notice).toBe("Đã chạy scan thủ công.");
	});
});
