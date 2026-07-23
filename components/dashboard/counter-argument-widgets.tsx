import {
	AlertTriangle,
	CheckCircle2,
	ExternalLink,
	FileText,
	Globe2,
	LoaderCircle,
	Pencil,
	Save,
	Sparkles,
	X,
} from "lucide-react";
import { useState } from "react";

import type {
	AnalysisView,
	DashboardScan,
	DraftShape,
	ScanDetail,
} from "@/components/dashboard/types";
import { IntentPrefetchLink } from "@/components/dashboard/intent-prefetch-link";
import {
	Panel,
	PanelHeader,
	RiskPill,
	SecondaryButton,
	StatusPill,
} from "@/components/dashboard/ui-primitives";

export function SourceDetail({
	analysis,
	detail,
	selectedScan,
}: {
	analysis: AnalysisView;
	detail: ScanDetail | null;
	selectedScan?: DashboardScan;
}) {
	const sourceUrl = detail?.source?.normalizedUrl ?? null;
	return (
		<Panel>
			<PanelHeader
				title="Thông tin nguồn"
				action={<StatusPill status={selectedScan?.status ?? "running"} />}
			/>
			<div className="space-y-4 p-4">
				<div className="grid gap-3 text-[13px] sm:grid-cols-[112px_minmax(0,1fr)]">
					<span className="font-semibold text-[var(--muted)]">Nguồn</span>
					<span className="truncate text-[var(--foreground)]">
						{selectedScan?.sourceLabel ?? detail?.source?.type ?? "Chưa chọn"}
					</span>
					<span className="font-semibold text-[var(--muted)]">Tiêu đề</span>
					<span className="truncate text-[var(--foreground)]">
						{selectedScan?.title ?? detail?.source?.title ?? "Nguồn chưa đặt tên"}
					</span>
					<span className="font-semibold text-[var(--muted)]">Thời gian</span>
					<span className="text-[var(--foreground)]">
						{formatTime(selectedScan?.createdAt)}
					</span>
					<span className="font-semibold text-[var(--muted)]">URL</span>
					<span className="truncate text-[var(--foreground)]">
						{sourceUrl ?? "Không có URL nguồn"}
					</span>
				</div>
				{sourceUrl ? (
					<a
						href={sourceUrl}
						target="_blank"
						rel="noreferrer"
						className="inline-flex h-10 max-w-full items-center gap-2 rounded-md border border-[var(--border)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition whitespace-nowrap hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
					>
						Xem nguồn gốc <ExternalLink size={14} />
					</a>
				) : null}
				<p className="rounded-lg bg-[var(--surface-soft)] p-3 text-[13px] leading-6 text-[var(--muted-strong)]">
					{analysis.summary}
				</p>
				<RiskPill risk={analysis.riskLevel} />
			</div>
		</Panel>
	);
}

export function DraftReview({
	draft,
	onReview,
	onRewrite,
	onSave,
	scanId,
}: {
	draft: DraftShape | null;
	onReview: (
		draft: DraftShape,
		status: "needs_review" | "approved" | "rejected",
	) => Promise<boolean>;
	onRewrite: (
		draft: DraftShape,
		instruction: string,
	) => Promise<DraftShape | null>;
	onSave: (draft: DraftShape, body: string) => Promise<DraftShape | null>;
	scanId?: string;
}) {
	const [pendingStatus, setPendingStatus] = useState<
		"needs_review" | "approved" | "rejected" | null
	>(null);
	const [editMode, setEditMode] = useState<"ai" | "manual" | null>(null);
	const [editedBody, setEditedBody] = useState("");
	const [instruction, setInstruction] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [feedback, setFeedback] = useState("");

	async function submitReview(status: "needs_review" | "approved" | "rejected") {
		if (!draft || pendingStatus) return;
		setPendingStatus(status);
		setFeedback("");
		const success = await onReview(draft, status);
		setFeedback(
			success
				? status === "approved"
					? "Đã phê duyệt và lưu người duyệt."
					: status === "rejected"
						? "Đã từ chối bản nháp."
						: "Đã chuyển về hàng đợi cần duyệt."
				: "Không thể cập nhật. Vui lòng thử lại.",
		);
		setPendingStatus(null);
	}

	async function saveManualEdit() {
		const body = editedBody.trim();
		if (!draft || isSaving || !body) return;
		setIsSaving(true);
		setFeedback("");
		const updated = await onSave(draft, body);
		if (updated) {
			setEditedBody(updated.body);
			setEditMode(null);
			setFeedback("Đã lưu nội dung. Bản nháp cần được duyệt lại.");
		} else {
			setFeedback("Không thể lưu bản nháp. Vui lòng thử lại.");
		}
		setIsSaving(false);
	}

	async function applyAiEdit() {
		const prompt = instruction.trim();
		if (!draft || isSaving || prompt.length < 3) return;
		setIsSaving(true);
		setFeedback("");
		const updated = await onRewrite(draft, prompt);
		if (updated) {
			setEditedBody(updated.body);
			setInstruction("");
			setEditMode(null);
			setFeedback("AI đã cập nhật nội dung. Hãy kiểm tra và duyệt lại bản nháp.");
		} else {
			setFeedback("Không thể chỉnh sửa bằng AI. Vui lòng thử lại.");
		}
		setIsSaving(false);
	}

	function cancelEdit() {
		setEditedBody(draft?.body ?? "");
		setInstruction("");
		setEditMode(null);
		setFeedback("");
	}

	return (
		<Panel>
			<PanelHeader
				title="Bản nháp đang duyệt"
				action={
					<span className="inline-flex h-6 min-w-[92px] shrink-0 items-center justify-center rounded-md bg-[var(--warning-soft)] px-2.5 text-center text-[11px] font-bold leading-none text-[var(--warning-strong)] whitespace-nowrap">
						{draft ? draftStatusLabel(draft.status) : "No draft"}
					</span>
				}
			/>
			<div className="space-y-4 p-4">
				{draft ? (
					<>
						{editMode === "manual" ? (
							<div className="space-y-3 rounded-lg border border-[var(--brand)] bg-[var(--surface-soft)] p-3">
								<label
									htmlFor={`draft-body-${draft.id}`}
									className="text-[11px] font-bold text-[var(--muted-strong)]"
								>
									Nội dung bản nháp
								</label>
								<textarea
									id={`draft-body-${draft.id}`}
									value={editedBody}
									onChange={(event) => setEditedBody(event.target.value)}
									maxLength={20_000}
									rows={12}
									autoFocus
									className="w-full resize-y rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-[13px] leading-6 text-[var(--foreground)] outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/15"
								/>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<span className="text-[10px] font-semibold text-[var(--muted)]">
										{editedBody.length.toLocaleString("vi-VN")} / 20.000 ký tự
									</span>
									<div className="flex flex-wrap gap-2">
										<SecondaryButton disabled={isSaving} onClick={cancelEdit}>
											<X size={14} /> Hủy
										</SecondaryButton>
										<button
											type="button"
											disabled={
												isSaving ||
												!editedBody.trim() ||
												editedBody.trim() === draft.body.trim()
											}
											onClick={() => void saveManualEdit()}
											className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--brand)] px-3 text-[12px] font-bold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-55"
										>
											{isSaving ? (
												<LoaderCircle className="animate-spin" size={14} />
											) : (
												<Save size={14} />
											)}{" "}
											Lưu thay đổi
										</button>
									</div>
								</div>
							</div>
						) : (
							<p className="rounded-lg bg-[var(--surface-soft)] p-3 text-[13px] leading-6 whitespace-pre-wrap text-[var(--muted-strong)]">
								{draft.body}
							</p>
						)}
						{editMode === "ai" ? (
							<div className="space-y-3 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] p-3">
								<label
									htmlFor={`draft-ai-instruction-${draft.id}`}
									className="text-[11px] font-bold text-[var(--accent-strong)]"
								>
									Yêu cầu chỉnh sửa bằng AI
								</label>
								<textarea
									id={`draft-ai-instruction-${draft.id}`}
									value={instruction}
									onChange={(event) => setInstruction(event.target.value)}
									maxLength={2_000}
									rows={4}
									autoFocus
									placeholder="Ví dụ: Viết ngắn gọn hơn, giữ giọng điềm tĩnh và làm rõ các luận điểm có bằng chứng."
									className="w-full resize-y rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-[13px] leading-6 text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
								/>
								<p className="text-[10px] font-semibold leading-4 text-[var(--muted-strong)]">
									AI chỉ được dùng bằng chứng của scan này. Nội dung sau khi sửa sẽ
									quay lại trạng thái cần duyệt.
								</p>
								<div className="flex flex-wrap justify-end gap-2">
									<SecondaryButton disabled={isSaving} onClick={cancelEdit}>
										<X size={14} /> Hủy
									</SecondaryButton>
									<button
										type="button"
										disabled={isSaving || instruction.trim().length < 3}
										onClick={() => void applyAiEdit()}
										className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-3 text-[12px] font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
									>
										{isSaving ? (
											<LoaderCircle className="animate-spin" size={14} />
										) : (
											<Sparkles size={14} />
										)}{" "}
										Áp dụng bằng AI
									</button>
								</div>
							</div>
						) : null}
						<div className="flex flex-wrap gap-2">
							<IntentPrefetchLink
								href={`/drafts/${draft.id}${scanId ? `?scanId=${scanId}` : ""}`}
								className="inline-flex h-10 max-w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition whitespace-nowrap hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
							>
								<FileText size={14} /> Chi tiết
							</IntentPrefetchLink>
							<SecondaryButton
								disabled={isSaving || editMode !== null}
								onClick={() => {
									setFeedback("");
									setEditedBody(draft.body);
									setEditMode("manual");
								}}
							>
								<Pencil size={14} /> Chỉnh sửa
							</SecondaryButton>
							<SecondaryButton
								disabled={isSaving || editMode !== null}
								onClick={() => {
									setFeedback("");
									setEditMode("ai");
								}}
							>
								<Sparkles size={14} /> Sửa bằng AI
							</SecondaryButton>
							<SecondaryButton disabled={isSaving || pendingStatus !== null || draft.status === "needs_review"} onClick={() => submitReview("needs_review")}>
								{pendingStatus === "needs_review" ? <LoaderCircle className="animate-spin" size={14} /> : <FileText size={14} />} Cần duyệt
							</SecondaryButton>
							<SecondaryButton disabled={isSaving || pendingStatus !== null || draft.status === "rejected"} onClick={() => submitReview("rejected")}>
								{pendingStatus === "rejected" ? <LoaderCircle className="animate-spin" size={14} /> : <AlertTriangle size={14} />} Từ chối
							</SecondaryButton>
							<button
								type="button"
								disabled={isSaving || pendingStatus !== null || draft.status === "approved"}
								onClick={() => void submitReview("approved")}
								className="inline-flex h-10 max-w-full items-center justify-center gap-2 rounded-md bg-[var(--brand)] px-3 text-[12px] font-bold text-white transition whitespace-nowrap hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-55"
							>
								{pendingStatus === "approved" ? <LoaderCircle className="animate-spin" size={14} /> : <CheckCircle2 size={14} />} Phê duyệt
							</button>
						</div>
						{feedback ? <p aria-live="polite" className={`rounded-md px-3 py-2 text-[11px] font-bold ${feedback.startsWith("Không") ? "bg-[var(--danger-soft)] text-[var(--danger-strong)]" : "bg-[var(--success-soft)] text-[var(--success-strong)]"}`}>{feedback}</p> : null}
					</>
				) : (
					<p className="rounded-lg bg-[var(--surface-soft)] p-3 text-[13px] leading-6 text-[var(--muted-strong)]">
						Chưa có bản nháp live. Tạo bản nháp sau khi scan có bằng chứng.
					</p>
				)}
				<p className="flex items-center gap-2 text-[11px] font-semibold text-[var(--muted)]">
					<Globe2 size={13} />
					Không tự động đăng tải hoặc nhắm mục tiêu nhân khẩu học.
				</p>
			</div>
		</Panel>
	);
}

function draftStatusLabel(status?: string) {
	if (status === "approved") return "Đã duyệt";
	if (status === "rejected") return "Đã từ chối";
	if (status === "needs_review") return "Cần duyệt";
	return "Bản nháp";
}

function formatTime(value?: string | Date) {
	if (!value) return "Chưa có thời gian";
	return new Intl.DateTimeFormat("vi-VN", {
		hour: "2-digit",
		minute: "2-digit",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(new Date(value));
}
