import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

function read(path: string) {
	return readFileSync(path, "utf8");
}

describe("analysis revision workflow", () => {
	test("requires authenticated, cache-invalidating analysis-only revision", () => {
		const route = read("app/api/scans/[id]/analysis/revise/route.ts");
		expect(route).toContain("requireAdminSession");
		expect(route).toContain("reviseAnalysisForScan");
		expect(route).toContain("revalidateDashboardScan(scanId)");
		expect(route).toContain("toClientScanDetail(detail)");
		expect(route).not.toContain("runProvider");
	});

	test("reuses saved evidence and records proof-level audit metadata", () => {
		const worker = read("lib/workers/scans.ts");
		expect(worker).toContain("export async function reviseAnalysisForScan");
		expect(worker).toContain('eventType: "analysis_revision_started"');
		expect(worker).toContain('"analysis_revised"');
		expect(worker).toContain("item.proofs.length");
		expect(worker).toContain("persistAnalysis(scanId, analysis)");
		expect(worker).toContain("NoObjectGeneratedError.isInstance(error)");
	});

	test("exposes a clear operator action and proof explanations", () => {
		const page = read("components/dashboard/analysis-page.tsx");
		const widgets = read("components/dashboard/analysis-widgets.tsx");
		expect(page).toContain("Phân tích lại");
		expect(page).toContain("Xác nhận phân tích lại");
		expect(page).toContain("Đang kiểm chứng...");
		expect(page).toContain("Dùng bằng chứng đã lưu và thay thế kết quả hiện tại.");
		expect(page).toContain("grid min-w-0 items-stretch");
		expect(page).toContain("min-w-0 space-y-5");
		expect(widgets).toContain("Chứng minh:");
		expect(widgets).toContain("Giới hạn:");
		expect(widgets).toContain("Đã xác thực ${proofCount} trích đoạn nguồn");
	});
});
