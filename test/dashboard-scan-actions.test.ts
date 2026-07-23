import { afterEach, describe, expect, mock, test } from "bun:test";

import {
	generateDraft,
	reviewDraft,
	rewriteDraftWithAi,
	runScanRecord,
	updateDraftBody,
} from "@/components/dashboard/client-actions";
import type { DashboardScan, ScanDetail } from "@/components/dashboard/types";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	mock.restore();
});

describe("dashboard scan actions", () => {
	test("persists draft approval and returns visible success state", async () => {
		const draft = {
			body: "Bản nháp kiểm thử",
			id: "9f829684-0182-4824-aa8f-446448076d97",
			scanJobId: "367f0107-77e5-448e-9aec-97b442000001",
			status: "needs_review" as const,
		};
		let updatedStatus: string | undefined = draft.status;
		let notice = "";
		const fetchMock = mock(() =>
			Promise.resolve(Response.json({ draft: { ...draft, status: "approved" } })),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const result = await reviewDraft({
			draft,
			setDraft: (value) => {
				updatedStatus = value.status;
			},
			setNotice: (value) => {
				notice = value;
			},
			status: "approved",
		});

		expect(result).toBe(true);
		expect(updatedStatus).toBe("approved");
		expect(notice).toContain("phê duyệt");
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/drafts/9f829684-0182-4824-aa8f-446448076d97/review",
			expect.objectContaining({ method: "POST" }),
		);
	});

	test("saves a manual draft edit and updates the visible draft", async () => {
		const draft = {
			body: "Nội dung ban đầu",
			id: "9f829684-0182-4824-aa8f-446448076d97",
			scanJobId: "367f0107-77e5-448e-9aec-97b442000001",
			status: "approved" as const,
		};
		let updatedBody = draft.body;
		let notice = "";
		const fetchMock = mock(() =>
			Promise.resolve(
				Response.json({
					draft: {
						...draft,
						body: "Nội dung đã sửa",
						status: "needs_review",
					},
				}),
			),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const result = await updateDraftBody({
			body: "Nội dung đã sửa",
			draft,
			setDraft: (value) => {
				updatedBody = value.body;
			},
			setNotice: (value) => {
				notice = value;
			},
		});

		expect(result?.status).toBe("needs_review");
		expect(updatedBody).toBe("Nội dung đã sửa");
		expect(notice).toContain("cần duyệt");
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/drafts/9f829684-0182-4824-aa8f-446448076d97",
			expect.objectContaining({
				body: JSON.stringify({ body: "Nội dung đã sửa" }),
				method: "PATCH",
			}),
		);
	});

	test("applies an AI draft edit through the dedicated rewrite endpoint", async () => {
		const draft = {
			body: "Nội dung ban đầu",
			id: "9f829684-0182-4824-aa8f-446448076d97",
			scanJobId: "367f0107-77e5-448e-9aec-97b442000001",
			status: "needs_review" as const,
		};
		let updatedBody = draft.body;
		const fetchMock = mock(() =>
			Promise.resolve(
				Response.json({
					draft: { ...draft, body: "Nội dung ngắn gọn hơn" },
				}),
			),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const result = await rewriteDraftWithAi({
			draft,
			instruction: "Viết ngắn gọn hơn",
			tone: "Giải thích thân thiện",
			voice: "Tự nhiên, gần gũi",
			setDraft: (value) => {
				updatedBody = value.body;
			},
			setNotice: () => {},
		});

		expect(result?.body).toBe("Nội dung ngắn gọn hơn");
		expect(updatedBody).toBe("Nội dung ngắn gọn hơn");
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/drafts/9f829684-0182-4824-aa8f-446448076d97/rewrite",
			expect.objectContaining({
				body: JSON.stringify({
					instruction: "Viết ngắn gọn hơn",
					tone: "Giải thích thân thiện",
					voice: "Tự nhiên, gần gũi",
				}),
				method: "POST",
			}),
		);
	});

	test("sends the selected tone and voice when generating a draft", async () => {
		let savedDraft = "";
		const fetchMock = mock(() =>
			Promise.resolve(
				Response.json({
					draft: {
						body: "Bản nháp tự nhiên",
						id: "9f829684-0182-4824-aa8f-446448076d97",
					},
				}),
			),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const result = await generateDraft({
			audience: "Công chúng chung",
			language: "Tiếng Việt",
			length: "Trung bình",
			operatorNotes: "",
			selectedScanId: "367f0107-77e5-448e-9aec-97b442000001",
			setDraft: (value) => {
				savedDraft = value.body;
			},
			setIsDrafting: () => {},
			setNotice: () => {},
			tone: "Thuyết phục, tôn trọng",
			voice: "Đối thoại, giàu tính thuyết phục",
		});

		expect(result).toBe(true);
		expect(savedDraft).toBe("Bản nháp tự nhiên");
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/scans/367f0107-77e5-448e-9aec-97b442000001/counter-arguments",
			expect.objectContaining({
				body: JSON.stringify({
					tone: "Thuyết phục, tôn trọng",
					voice: "Đối thoại, giàu tính thuyết phục",
					audience: "Công chúng chung",
					language: "Tiếng Việt",
					length: "Trung bình",
					operatorNotes: "",
				}),
				method: "POST",
			}),
		);
	});

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
