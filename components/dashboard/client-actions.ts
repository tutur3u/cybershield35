import type { Dispatch, SetStateAction } from "react";

import type { SourceTab } from "@/components/dashboard/dashboard-data";
import type {
	AdminSessionView,
	AuthViewState,
	DraftShape,
} from "@/components/dashboard/types";
import type { ScanStatus } from "@/lib/db/schema";
import type { DashboardScan } from "@/lib/domain/fixtures";
import type { ClientRuntime } from "@/lib/runtime/client-runtime";

export function onSessionVerified(
	session: AdminSessionView,
	setAuth: (auth: AuthViewState) => void,
	setNotice: (notice: string) => void,
) {
	setAuth({ authenticated: true, configured: true, session });
	setNotice("Đã xác thực bằng Tuturuuu external app login.");
}

export async function refreshSession(
	setAuth: (auth: AuthViewState) => void,
	setNotice: (notice: string) => void,
) {
	const response = await fetch("/api/auth/session/refresh", { method: "POST" });
	const payload = await response.json();
	if (response.ok && payload.session) {
		setAuth({ authenticated: true, configured: true, session: payload.session });
		setNotice("Phiên Tuturuuu đã được làm mới.");
		return;
	}
	setAuth({
		authenticated: false,
		configured: payload.configured,
		error: payload.error ?? "Không thể làm mới phiên.",
	});
	setNotice(payload.error ?? "Không thể làm mới phiên Tuturuuu.");
}

export async function logout(
	setAuth: (auth: AuthViewState) => void,
	setNotice: (notice: string) => void,
) {
	await fetch("/api/auth/logout", { method: "POST" });
	setAuth({ authenticated: false, configured: true });
	setNotice("Đã đăng xuất khỏi phiên Tuturuuu.");
}

export async function createScan(options: {
	inputMode: SourceTab;
	urlInput: string;
	manualText: string;
	selectedFile: File | null;
	clientRuntime?: ClientRuntime;
	setIsCreating: (value: boolean) => void;
	setScans: Dispatch<SetStateAction<DashboardScan[]>>;
	setSelectedScanId: (id: string) => void;
	setNotice: (notice: string) => void;
}) {
	options.setIsCreating(true);
	try {
		const response = await postScan(options);
		const payload = await response.json();
		if (!response.ok) throw new Error(payload.error ?? "Không thể tạo scan");

		const pending = buildPendingScan(options, payload.scanId, payload.status);
		options.setScans((current) => [pending, ...current]);
		options.setSelectedScanId(pending.id);
		options.setNotice(
			payload.mode === "inline"
				? "Đã tạo scan và xử lý ngay bằng khóa kiểm thử trong session."
				: "Đã tạo scan mới. Worker sẽ xử lý theo lịch mỗi phút.",
		);
		return true;
	} catch (error) {
		options.setNotice(error instanceof Error ? error.message : "Không thể tạo scan");
		return false;
	} finally {
		options.setIsCreating(false);
	}
}

export async function generateDraft(options: {
	selectedScanId: string;
	tone: string;
	audience: string;
	language: string;
	length: string;
	operatorNotes: string;
	clientRuntime?: ClientRuntime;
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
					audience: options.audience,
					language: options.language,
					length: options.length,
					operatorNotes: options.operatorNotes,
					clientRuntime: options.clientRuntime,
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
	const response = await fetch(`/api/drafts/${options.draft.id}/review`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ status: options.status }),
	});
	const payload = await response.json();
	options.setDraft(payload.draft ?? { ...options.draft, status: options.status });
	options.setNotice(
		options.status === "approved"
			? "Đã ghi nhận phê duyệt của người vận hành."
			: "Đã cập nhật trạng thái duyệt.",
	);
}

async function postScan(options: {
	inputMode: SourceTab;
	urlInput: string;
	manualText: string;
	selectedFile: File | null;
	clientRuntime?: ClientRuntime;
}) {
	if (options.inputMode === "file" && options.selectedFile) {
		const form = new FormData();
		form.set("file", options.selectedFile);
		form.set("title", options.selectedFile.name);
		if (options.clientRuntime) {
			form.set("clientRuntime", JSON.stringify(options.clientRuntime));
		}
		return fetch("/api/scans", { method: "POST", body: form });
	}

	const input = options.inputMode === "text" ? options.manualText : options.urlInput;
	return fetch("/api/scans", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			input,
			title: options.inputMode === "text" ? "Văn bản nhập thủ công" : undefined,
			clientRuntime: options.clientRuntime,
		}),
	});
}

function buildPendingScan(
	options: { inputMode: SourceTab; urlInput: string; selectedFile: File | null },
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
		sourceType:
			options.inputMode === "file"
				? "file"
				: options.inputMode === "text"
					? "text"
					: "url",
		provider: "demo",
		title,
		sourceLabel:
			options.inputMode === "url"
				? "URL"
				: options.inputMode === "file"
					? "Tệp"
					: "Văn bản",
		riskLevel: "medium",
		progress: 0,
		createdAt: new Date().toISOString(),
	};
}
