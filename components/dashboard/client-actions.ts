import type { Dispatch, SetStateAction } from "react";

import type { SourceTab } from "@/components/dashboard/dashboard-data";
import type {
	ChatMessage,
	DashboardScan,
	DraftShape,
	EvidenceView,
	ScanDetail,
	TrackedSourceView,
} from "@/components/dashboard/types";
import type { ProviderName, ScanStatus, SourceType } from "@/lib/db/schema";
import type { ScanProviderOverride } from "@/lib/domain/provider-override";
import { detectSource } from "@/lib/domain/source-detection";

export async function createScan(options: {
	inputMode: SourceTab;
	urlInput: string;
	manualText: string;
	selectedFile: File | null;
	providerOverride?: ScanProviderOverride;
	setIsCreating: (value: boolean) => void;
	setScans: Dispatch<SetStateAction<DashboardScan[]>>;
	setSelectedScanId: (id: string) => void;
	setNotice: (notice: string) => void;
	runMode?: "now" | "queue";
}) {
	options.setIsCreating(true);
	const clientRequestId = crypto.randomUUID();
	try {
		const controller = new AbortController();
		const timeout = window.setTimeout(() => controller.abort(), 45_000);
		let response: Response;
		try {
			response = await postScan(options, clientRequestId, controller.signal);
		} catch (error) {
			if (!(error instanceof DOMException && error.name === "AbortError")) {
				throw error;
			}
			const recovered = await pollScanByRequestId(clientRequestId);
			if (!recovered) {
				throw new Error(
					"Lượt quét vẫn đang được tạo. Mở lại danh sách scan sau ít phút để theo dõi.",
				);
			}
			const pending = recovered;
			options.setScans((current) => [
				pending,
				...current.filter((scan) => scan.id !== pending.id),
			]);
			options.setSelectedScanId(pending.id);
			options.setNotice("Đã tìm lại lượt quét đang xử lý mà không tạo trùng.");
			return true;
		} finally {
			window.clearTimeout(timeout);
		}
		const payload = await response.json();
		if (!response.ok) throw new Error(payload.error ?? "Không thể tạo scan");

		const pending = buildPendingScan(options, payload.scanId, payload.status);
		options.setScans((current) => [pending, ...current]);
		options.setSelectedScanId(pending.id);
		options.setNotice(
			options.runMode === "queue"
				? "Đã xếp scan vào hàng đợi."
				: "Đã tạo và xử lý scan. Mở chi tiết để theo dõi kết quả.",
		);
		return true;
	} catch (error) {
		options.setNotice(error instanceof Error ? error.message : "Không thể tạo scan");
		return false;
	} finally {
		options.setIsCreating(false);
	}
}

export async function scanTrackedSource(options: {
	trackedSource: TrackedSourceView;
	setIsCreating: (value: boolean) => void;
	setTrackedSources: Dispatch<SetStateAction<TrackedSourceView[]>>;
	setScans: Dispatch<SetStateAction<DashboardScan[]>>;
	setSelectedScanId: (id: string) => void;
	setNotice: (notice: string) => void;
}) {
	options.setIsCreating(true);
	try {
		const response = await fetch(
			`/api/tracked-sources/${options.trackedSource.id}/scan`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			},
		);
		const payload = await response.json();
		if (!response.ok) throw new Error(payload.error ?? "Không thể quét nguồn theo dõi");

		const nextTrackedSource =
			(payload.trackedSource as TrackedSourceView | undefined) ??
			options.trackedSource;
		options.setTrackedSources((current) =>
			current.map((source) =>
				source.id === nextTrackedSource.id ? nextTrackedSource : source,
			),
		);

		const pending = buildTrackedSourceScan(nextTrackedSource, payload.scan);
		options.setScans((current) => [pending, ...current]);
		options.setSelectedScanId(pending.id);
		options.setNotice("Đã đưa nguồn theo dõi vào hàng đợi worker.");
		return true;
	} catch (error) {
		options.setNotice(
			error instanceof Error ? error.message : "Không thể quét nguồn theo dõi",
		);
		return false;
	} finally {
		options.setIsCreating(false);
	}
}

export async function runManagedSchedulerJobNow(options: {
	jobKey:
		| "enqueue-tracked-sources"
		| "process-article-publications"
		| "process-queue";
	setNotice: (notice: string) => void;
}) {
	try {
		const response = await fetch(
			`/api/workspace/cron/jobs/${encodeURIComponent(options.jobKey)}/run-now`,
			{
				credentials: "same-origin",
				headers: { Accept: "application/json" },
				method: "POST",
			},
		);
		const payload = await response.json().catch(() => null);
		if (!response.ok) {
			const message =
				payload && typeof payload === "object" && "error" in payload
					? String(payload.error)
					: "Không thể chạy job tự động.";
			throw new Error(message);
		}

		const label =
			options.jobKey === "enqueue-tracked-sources"
				? "Đã xếp hàng các nguồn đến hạn."
				: options.jobKey === "process-article-publications"
					? "Đã xử lý hàng đợi xuất bản bài viết."
					: "Đã xử lý hàng đợi scan.";
		options.setNotice(label);
		return true;
	} catch (error) {
		options.setNotice(
			error instanceof Error ? error.message : "Không thể chạy job tự động.",
		);
		return false;
	}
}

export async function createTrackedSourceRecord(options: {
	displayName: string;
	setNotice: (notice: string) => void;
	setTrackedSources: Dispatch<SetStateAction<TrackedSourceView[]>>;
	url: string;
}) {
	try {
		const response = await fetch("/api/tracked-sources", {
			body: JSON.stringify({
				displayName: options.displayName.trim() || undefined,
				url: options.url.trim(),
			}),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});
		const payload = await response.json();
		if (!response.ok) {
			throw new Error(payload.error ?? "Không thể tạo nguồn theo dõi");
		}

		const trackedSource = payload.trackedSource as TrackedSourceView;
		options.setTrackedSources((current) => [
			trackedSource,
			...current.filter((source) => source.id !== trackedSource.id),
		]);
		options.setNotice("Đã lưu nguồn theo dõi.");
		return true;
	} catch (error) {
		options.setNotice(
			error instanceof Error ? error.message : "Không thể tạo nguồn theo dõi",
		);
		return false;
	}
}

export async function updateTrackedSourceRecord(options: {
	displayName?: string;
	isActive?: boolean;
	setNotice: (notice: string) => void;
	setTrackedSources: Dispatch<SetStateAction<TrackedSourceView[]>>;
	trackedSource: TrackedSourceView;
}) {
	try {
		const response = await fetch(
			`/api/tracked-sources/${options.trackedSource.id}`,
			{
				body: JSON.stringify({
					displayName: options.displayName,
					isActive: options.isActive,
				}),
				headers: { "Content-Type": "application/json" },
				method: "PATCH",
			},
		);
		const payload = await response.json();
		if (!response.ok) {
			throw new Error(payload.error ?? "Không thể cập nhật nguồn theo dõi");
		}

		const trackedSource = payload.trackedSource as TrackedSourceView;
		options.setTrackedSources((current) =>
			current.map((source) =>
				source.id === trackedSource.id ? trackedSource : source,
			),
		);
		options.setNotice("Đã cập nhật nguồn theo dõi.");
		return true;
	} catch (error) {
		options.setNotice(
			error instanceof Error
				? error.message
				: "Không thể cập nhật nguồn theo dõi",
		);
		return false;
	}
}

export async function deleteTrackedSourceRecord(options: {
	setNotice: (notice: string) => void;
	setTrackedSources: Dispatch<SetStateAction<TrackedSourceView[]>>;
	trackedSource: TrackedSourceView;
}) {
	try {
		const response = await fetch(
			`/api/tracked-sources/${options.trackedSource.id}`,
			{ method: "DELETE" },
		);
		const payload = await response.json();
		if (!response.ok) {
			throw new Error(payload.error ?? "Không thể xóa nguồn theo dõi");
		}

		options.setTrackedSources((current) =>
			current.filter((source) => source.id !== options.trackedSource.id),
		);
		options.setNotice("Đã xóa nguồn theo dõi.");
		return true;
	} catch (error) {
		options.setNotice(
			error instanceof Error ? error.message : "Không thể xóa nguồn theo dõi",
		);
		return false;
	}
}

export async function updateScanRecord(options: {
	scan: DashboardScan;
	setNotice: (notice: string) => void;
	setScans: Dispatch<SetStateAction<DashboardScan[]>>;
	status: DashboardScan["status"];
	title: string;
}) {
	try {
		const response = await fetch(`/api/scans/${options.scan.id}`, {
			body: JSON.stringify({
				status: options.status,
				title: options.title.trim(),
			}),
			headers: { "Content-Type": "application/json" },
			method: "PATCH",
		});
		const payload = await response.json();
		if (!response.ok) throw new Error(payload.error ?? "Không thể cập nhật scan");

		const scan = payload.scan as DashboardScan;
		options.setScans((current) =>
			current.map((item) => (item.id === scan.id ? scan : item)),
		);
		options.setNotice("Đã cập nhật scan.");
		return true;
	} catch (error) {
		options.setNotice(error instanceof Error ? error.message : "Không thể cập nhật scan");
		return false;
	}
}

export async function deleteScanRecord(options: {
	scan: DashboardScan;
	selectedScanId: string;
	setDetail: (detail: ScanDetail | null) => void;
	setDraft: (draft: DraftShape | null) => void;
	setNotice: (notice: string) => void;
	setScans: Dispatch<SetStateAction<DashboardScan[]>>;
	setSelectedScanId: (id: string) => void;
}) {
	try {
		const response = await fetch(`/api/scans/${options.scan.id}`, {
			method: "DELETE",
		});
		const payload = await response.json();
		if (!response.ok) throw new Error(payload.error ?? "Không thể xóa scan");

		options.setScans((current) => {
			const next = current.filter((scan) => scan.id !== options.scan.id);
			if (options.selectedScanId === options.scan.id) {
				options.setSelectedScanId(next[0]?.id ?? "");
				options.setDetail(null);
				options.setDraft(null);
			}
			return next;
		});
		options.setNotice("Đã xóa scan.");
		return true;
	} catch (error) {
		options.setNotice(error instanceof Error ? error.message : "Không thể xóa scan");
		return false;
	}
}

export async function runScanRecord(options: {
	scan: DashboardScan;
	setDetail: Dispatch<SetStateAction<ScanDetail | null>>;
	setNotice: (notice: string) => void;
	setScans: Dispatch<SetStateAction<DashboardScan[]>>;
}) {
	try {
		const isRescan = !["queued", "retrying"].includes(options.scan.status);
		const response = await fetch(
			isRescan
				? `/api/scans/${options.scan.id}/rescan`
				: `/api/scans/${options.scan.id}/run`,
			{
			method: "POST",
				...(isRescan
					? {
							body: JSON.stringify({ runMode: "now" }),
							headers: { "Content-Type": "application/json" },
						}
					: {}),
			},
		);
		const payload = await response.json();
		if (!response.ok) {
			throw new Error(payload.error ?? "Không thể chạy scan thủ công");
		}

		const scan = payload.scan as DashboardScan | null | undefined;
		if (scan) {
			options.setScans((current) =>
				current.map((item) => (item.id === scan.id ? scan : item)),
			);
		}
		if (payload.detail) {
			options.setDetail(payload.detail as ScanDetail);
		}

		options.setNotice(isRescan ? "Đã tạo và chạy lượt quét lại." : "Đã chạy scan thủ công.");
		return true;
	} catch (error) {
		options.setNotice(
			error instanceof Error ? error.message : "Không thể chạy scan thủ công",
		);
		return false;
	}
}

export type EvidenceMutationValues = {
	author: string;
	quote: string;
	riskLevel: "low" | "medium" | "high";
	sourceLabel: string;
	sourceUrl: string;
	summary: string;
};

export async function createEvidenceRecord(options: {
	scanId: string;
	setDetail: Dispatch<SetStateAction<ScanDetail | null>>;
	setNotice: (notice: string) => void;
	values: EvidenceMutationValues;
}) {
	try {
		const response = await fetch("/api/evidence", {
			body: JSON.stringify(toEvidencePayload(options.values, options.scanId)),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});
		const payload = await response.json();
		if (!response.ok) {
			throw new Error(payload.error ?? "Không thể tạo bằng chứng");
		}

		const evidence = payload.evidence as EvidenceView[number];
		options.setDetail((current) =>
			current
				? { ...current, evidence: [evidence, ...(current.evidence ?? [])] }
				: current,
		);
		options.setNotice("Đã thêm bằng chứng.");
		return true;
	} catch (error) {
		options.setNotice(
			error instanceof Error ? error.message : "Không thể tạo bằng chứng",
		);
		return false;
	}
}

export async function updateEvidenceRecord(options: {
	evidence: EvidenceView[number];
	setDetail: Dispatch<SetStateAction<ScanDetail | null>>;
	setNotice: (notice: string) => void;
	values: EvidenceMutationValues;
}) {
	try {
		const response = await fetch(`/api/evidence/${options.evidence.id}`, {
			body: JSON.stringify(toEvidencePayload(options.values)),
			headers: { "Content-Type": "application/json" },
			method: "PATCH",
		});
		const payload = await response.json();
		if (!response.ok) {
			throw new Error(payload.error ?? "Không thể cập nhật bằng chứng");
		}

		const evidence = payload.evidence as EvidenceView[number];
		options.setDetail((current) =>
			current
				? {
						...current,
						evidence: (current.evidence ?? []).map((item) =>
							item.id === evidence.id ? evidence : item,
						),
					}
				: current,
		);
		options.setNotice("Đã cập nhật bằng chứng.");
		return true;
	} catch (error) {
		options.setNotice(
			error instanceof Error ? error.message : "Không thể cập nhật bằng chứng",
		);
		return false;
	}
}

export async function deleteEvidenceRecord(options: {
	evidence: EvidenceView[number];
	setDetail: Dispatch<SetStateAction<ScanDetail | null>>;
	setNotice: (notice: string) => void;
}) {
	try {
		const response = await fetch(`/api/evidence/${options.evidence.id}`, {
			method: "DELETE",
		});
		const payload = await response.json();
		if (!response.ok) {
			throw new Error(payload.error ?? "Không thể xóa bằng chứng");
		}

		options.setDetail((current) =>
			current
				? {
						...current,
						evidence: (current.evidence ?? []).filter(
							(item) => item.id !== options.evidence.id,
						),
					}
				: current,
		);
		options.setNotice("Đã xóa bằng chứng.");
		return true;
	} catch (error) {
		options.setNotice(
			error instanceof Error ? error.message : "Không thể xóa bằng chứng",
		);
		return false;
	}
}

export async function generateDraft(options: {
	selectedScanId: string;
	tone: string;
	voice: string;
	audience: string;
	language: string;
	length: string;
	operatorNotes: string;
	setIsDrafting: (value: boolean) => void;
	setDraft: (draft: DraftShape) => void;
	setNotice: (notice: string) => void;
}) {
	options.setIsDrafting(true);
	try {
		const response = await fetch(
			`/api/scans/${options.selectedScanId}/counter-arguments`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					tone: options.tone,
					voice: options.voice,
					audience: options.audience,
					language: options.language,
					length: options.length,
					operatorNotes: options.operatorNotes,
				}),
			},
		);
		const payload = await response.json();
		if (!response.ok) throw new Error(payload.error ?? "Không thể tạo bản nháp");
		options.setDraft(payload.draft);
		options.setNotice("Đã tạo bản nháp phản hồi và chuyển sang trạng thái cần duyệt.");
		return true;
	} catch (error) {
		options.setNotice(error instanceof Error ? error.message : "Không thể tạo bản nháp");
		return false;
	} finally {
		options.setIsDrafting(false);
	}
}

export async function reviewDraft(options: {
	draft: DraftShape;
	status: "needs_review" | "approved" | "rejected";
	setDraft: (draft: DraftShape) => void;
	setNotice: (notice: string) => void;
}) {
	try {
		const response = await fetch(`/api/drafts/${options.draft.id}/review`, {
			method: "POST",
			cache: "no-store",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status: options.status }),
		});
		const payload = await response.json().catch(() => null);
		if (!response.ok) {
			throw new Error(
				payload?.error ??
					`Không thể cập nhật trạng thái duyệt (${response.status})`,
			);
		}
		options.setDraft(payload?.draft ?? { ...options.draft, status: options.status });
		options.setNotice(
			options.status === "approved"
				? "Đã ghi nhận phê duyệt của người vận hành."
				: "Đã cập nhật trạng thái duyệt.",
		);
		return true;
	} catch (error) {
		options.setNotice(
			error instanceof Error
				? error.message
				: "Không thể cập nhật trạng thái duyệt",
		);
		return false;
	}
}

export async function updateDraftBody(options: {
	body: string;
	draft: DraftShape;
	setDraft: (draft: DraftShape) => void;
	setNotice: (notice: string) => void;
}) {
	try {
		const response = await fetch(`/api/drafts/${options.draft.id}`, {
			method: "PATCH",
			cache: "no-store",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ body: options.body }),
		});
		const payload = await response.json().catch(() => null);
		if (!response.ok) {
			throw new Error(
				payload?.error ?? `Không thể lưu bản nháp (${response.status})`,
			);
		}
		const updated = payload?.draft as DraftShape | undefined;
		if (!updated) throw new Error("Phản hồi lưu bản nháp không hợp lệ.");
		options.setDraft(updated);
		options.setNotice("Đã lưu nội dung và chuyển bản nháp về trạng thái cần duyệt.");
		return updated;
	} catch (error) {
		options.setNotice(
			error instanceof Error ? error.message : "Không thể lưu bản nháp",
		);
		return null;
	}
}

export async function rewriteDraftWithAi(options: {
	draft: DraftShape;
	instruction: string;
	tone: string;
	voice: string;
	setDraft: (draft: DraftShape) => void;
	setNotice: (notice: string) => void;
}) {
	try {
		const response = await fetch(`/api/drafts/${options.draft.id}/rewrite`, {
			method: "POST",
			cache: "no-store",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				instruction: options.instruction,
				tone: options.tone,
				voice: options.voice,
			}),
		});
		const payload = await response.json().catch(() => null);
		if (!response.ok) {
			throw new Error(
				payload?.error ??
					`Không thể chỉnh sửa bản nháp bằng AI (${response.status})`,
			);
		}
		const updated = payload?.draft as DraftShape | undefined;
		if (!updated) throw new Error("Phản hồi chỉnh sửa bằng AI không hợp lệ.");
		options.setDraft(updated);
		options.setNotice(
			"AI đã cập nhật nội dung. Bản nháp cần được người vận hành duyệt lại.",
		);
		return updated;
	} catch (error) {
		options.setNotice(
			error instanceof Error
				? error.message
				: "Không thể chỉnh sửa bản nháp bằng AI",
		);
		return null;
	}
}

export async function sendChatMessage(options: {
	messages: ChatMessage[];
	content: string;
	setIsChatting: (value: boolean) => void;
	setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
	setNotice: (notice: string) => void;
}) {
	const content = options.content.trim();
	if (!content) return false;

	const userMessage: ChatMessage = {
		id: `chat-user-${Date.now()}`,
		role: "user",
		content,
		createdAt: new Date().toISOString(),
	};
	const requestMessages = [...options.messages, userMessage];

	options.setMessages((current) => [...current, userMessage]);
	options.setIsChatting(true);
	try {
		const response = await fetch("/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				messages: requestMessages.map((message) => ({
					role: message.role,
					content: message.content,
				})),
			}),
		});
		const payload = await response.json();
		if (!response.ok) throw new Error(payload.error ?? "Không thể chat với LLM");

		const assistantMessage: ChatMessage = {
			id: `chat-assistant-${Date.now()}`,
			role: "assistant",
			content: payload.reply.content,
			createdAt: new Date().toISOString(),
			mode: "live",
		};

		options.setMessages((current) => [...current, assistantMessage]);
		options.setNotice("LLM đã phản hồi bằng provider đang cấu hình.");
		return true;
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Không thể gửi tin nhắn chat.";
		options.setNotice(message);
		return true;
	} finally {
		options.setIsChatting(false);
	}
}

async function postScan(options: {
	inputMode: SourceTab;
	urlInput: string;
	manualText: string;
	selectedFile: File | null;
	providerOverride?: ScanProviderOverride;
	runMode?: "now" | "queue";
}, clientRequestId: string, signal: AbortSignal) {
	if (options.inputMode === "file" && options.selectedFile) {
		const form = new FormData();
		form.set("file", options.selectedFile);
		form.set("title", options.selectedFile.name);
		form.set("runMode", options.runMode ?? "now");
		form.set("clientRequestId", clientRequestId);
		return fetch("/api/scans", { method: "POST", body: form, signal });
	}

	const input = options.inputMode === "text" ? options.manualText : options.urlInput;
	return fetch("/api/scans", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			input,
			clientRequestId,
			title: options.inputMode === "text" ? "Văn bản nhập thủ công" : undefined,
			providerOverride:
				options.inputMode === "url" ? options.providerOverride : undefined,
			runMode: options.runMode ?? "now",
		}),
		signal,
	});
}

async function pollScanByRequestId(clientRequestId: string) {
	for (let attempt = 0; attempt < 12; attempt += 1) {
		try {
			const response = await fetch(
				`/api/scans?requestId=${encodeURIComponent(clientRequestId)}`,
				{ cache: "no-store" },
			);
			const body = await response.json().catch(() => null);
			if (response.ok && body?.scan) return body.scan as DashboardScan;
		} catch {
			// The browser may still be reconnecting; retry within the bounded window.
		}
		await new Promise((resolve) => window.setTimeout(resolve, 1_000));
	}
	return null;
}

function buildPendingScan(
	options: {
		inputMode: SourceTab;
		urlInput: string;
		selectedFile: File | null;
		providerOverride?: ScanProviderOverride;
	},
	scanId: string,
	status: ScanStatus,
): DashboardScan {
	const title =
		options.inputMode === "file"
			? (options.selectedFile?.name ?? "Tệp tải lên")
			: options.inputMode === "text"
				? "Văn bản nhập thủ công"
				: options.urlInput;

	return {
		id: scanId,
		status,
		sourceType: sourceTypeForPendingScan(options),
		provider: providerForPendingScan(options),
		title,
		sourceLabel: sourceLabelForType(sourceTypeForPendingScan(options)),
		riskLevel: "medium",
		progress: 0,
		createdAt: new Date().toISOString(),
	};
}

function buildTrackedSourceScan(
	source: TrackedSourceView,
	scan: { scanId?: string; status?: ScanStatus } | undefined,
): DashboardScan {
	return {
		id: scan?.scanId ?? source.lastScanJobId ?? `tracked-${Date.now()}`,
		status: scan?.status ?? source.lastScanStatus ?? "queued",
		sourceType: source.type,
		provider: source.provider,
		title: source.displayName,
		sourceLabel: sourceLabelForType(source.type),
		riskLevel: "medium",
		progress: scan?.status === "completed" ? 100 : 0,
		createdAt: new Date().toISOString(),
	};
}

function toEvidencePayload(values: EvidenceMutationValues, scanId?: string) {
	return {
		author: nullWhenEmpty(values.author),
		quote: values.quote.trim(),
		riskLevel: values.riskLevel,
		scanJobId: scanId,
		sourceLabel: nullWhenEmpty(values.sourceLabel),
		sourceUrl: nullWhenEmpty(values.sourceUrl),
		summary: values.summary.trim(),
	};
}

function nullWhenEmpty(value: string) {
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

function sourceTypeForPendingScan(options: {
	inputMode: SourceTab;
	urlInput: string;
	selectedFile: File | null;
}): SourceType {
	if (options.inputMode === "file") return "file";
	if (options.inputMode === "text") return "text";
	return detectSource(options.urlInput).type;
}

function providerForPendingScan(options: {
	inputMode: SourceTab;
	urlInput: string;
	selectedFile: File | null;
	providerOverride?: ScanProviderOverride;
}): ProviderName {
	if (options.inputMode === "file") return "local_text";
	if (options.inputMode === "text") return "local_text";
	if (options.providerOverride) return options.providerOverride;
	return detectSource(options.urlInput).provider;
}

function sourceLabelForType(type: SourceType) {
	switch (type) {
		case "facebook_group":
			return "Facebook group";
		case "facebook_page":
			return "Facebook page";
		case "facebook_post":
			return "Facebook post";
		case "file":
			return "Tệp";
		case "text":
			return "Văn bản";
		case "social":
			return "Mạng xã hội";
		default:
			return "Website";
	}
}
