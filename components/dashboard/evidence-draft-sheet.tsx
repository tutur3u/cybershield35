"use client";

import { FileText, LoaderCircle, Scale, ShieldAlert, ShieldCheck, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { DraftStylePicker } from "@/components/dashboard/draft-style-picker";
import type { TimelinePost } from "@/components/dashboard/types";
import {
	DEFAULT_DRAFT_TONE,
	DEFAULT_DRAFT_VOICE,
	DRAFT_TONE_OPTIONS,
	DRAFT_VOICE_OPTIONS,
} from "@/lib/domain/draft-style";
import {
	DRAFT_KIND_LABELS,
	type DraftKind,
	draftIntentGuidance,
} from "@/lib/domain/draft-intent";

const kinds = [
	[
		"response",
		DRAFT_KIND_LABELS.response,
		"Đồng tình với luận điểm có căn cứ và giải thích vì sao đáng ủng hộ.",
	],
	[
		"counter_argument",
		DRAFT_KIND_LABELS.counter_argument,
		"Chỉ ra điểm sai, thiếu hoặc gây hiểu lầm rồi phản bác bằng bằng chứng.",
	],
] as const;

export function EvidenceDraftSheet({
	onOpenChange,
	open,
	post,
}: {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	post: TimelinePost;
}) {
	const router = useRouter();
	const closeRef = useRef<HTMLButtonElement | null>(null);
	const [draftKind, setDraftKind] = useState<DraftKind>("response");
	const [includeRelatedEvidence, setIncludeRelatedEvidence] = useState(false);
	const [operatorNotes, setOperatorNotes] = useState("");
	const [tone, setTone] = useState<string>(DEFAULT_DRAFT_TONE);
	const [voice, setVoice] = useState<string>(DEFAULT_DRAFT_VOICE);
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!open) return;
		closeRef.current?.focus();
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !isGenerating) onOpenChange(false);
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isGenerating, onOpenChange, open]);

	useEffect(() => {
		if (!open) return;
		setDraftKind(
			post.pageClassification === "at_risk" ? "counter_argument" : "response",
		);
	}, [open, post.id, post.pageClassification]);

	async function generateDraft() {
		setIsGenerating(true);
		setError("");
		try {
			const response = await fetch(`/api/evidence/${post.id}/drafts`, {
				body: JSON.stringify({
					draftKind,
					includeRelatedEvidence,
					operatorNotes: operatorNotes || undefined,
					tone,
					voice,
				}),
				cache: "no-store",
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});
			const body = await response.json().catch(() => null);
			if (!response.ok) throw new Error(body?.error ?? "Không thể tạo bản nháp.");
			router.push(body.href);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "Không thể tạo bản nháp.");
		} finally {
			setIsGenerating(false);
		}
	}

	if (!open) return null;
	return (
		<div className="fixed inset-0 z-[80] flex items-end justify-end bg-slate-950/55 backdrop-blur-[2px] sm:items-stretch" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !isGenerating) onOpenChange(false); }}>
			<section aria-labelledby="draft-sheet-title" aria-modal="true" className="flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl sm:max-h-none sm:max-w-[520px] sm:rounded-none sm:border-y-0 sm:border-r-0" role="dialog">
				<header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
					<div><span className="grid size-9 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Sparkles size={17} /></span><h2 id="draft-sheet-title" className="mt-3 text-base font-extrabold text-[var(--foreground)]">Soạn phản hồi từ bằng chứng</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Lưu vào Bản nháp để con người duyệt. Không tự động đăng tải.</p></div>
					<button ref={closeRef} type="button" disabled={isGenerating} onClick={() => onOpenChange(false)} className="grid size-9 place-items-center rounded-md border border-[var(--border)] text-[var(--muted-strong)]" aria-label="Đóng"><X size={16} /></button>
				</header>
				<div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
					<div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3"><p className="line-clamp-4 text-xs font-semibold leading-5 text-[var(--foreground)]">{post.quote}</p><p className="mt-2 font-mono text-[9px] text-[var(--muted)]">{post.id}</p></div>
					<PageClassificationGuidance classification={post.pageClassification} />
					<fieldset>
						<legend className={labelClass}>Mục đích bài viết</legend>
						<div className="mt-2 grid gap-2">
							{kinds.map(([value, label, description]) => (
								<button
									key={value}
									type="button"
									aria-pressed={draftKind === value}
									onClick={() => setDraftKind(value)}
									className={`rounded-lg border p-3 text-left transition ${draftKind === value ? "border-[var(--brand)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "border-[var(--border)] text-[var(--muted-strong)] hover:bg-[var(--surface-soft)]"}`}
								>
									<span className="block text-xs font-extrabold">{label}</span>
									<span className="mt-1 block text-[10px] font-semibold leading-4">
										{description}
									</span>
								</button>
							))}
						</div>
					</fieldset>
					<div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
						<p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
							AI bắt buộc phải làm rõ
						</p>
						<p className="mt-2 text-xs font-bold leading-5 text-[var(--foreground)]">
							{draftIntentGuidance(draftKind).goal}
						</p>
						<ul className="mt-2 list-disc space-y-1 pl-4 text-[10px] font-semibold leading-4 text-[var(--muted-strong)]">
							{draftIntentGuidance(draftKind).requirements.map((requirement) => (
								<li key={requirement}>{requirement}</li>
							))}
						</ul>
					</div>
					<div className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
						<div className="flex items-start gap-2.5">
							<Sparkles className="mt-0.5 shrink-0 text-[var(--accent-strong)]" size={15} />
							<p className="text-[10px] font-semibold leading-4 text-[var(--muted-strong)]">
								Mặc định viết thành các đoạn ngắn, đi thẳng vào vấn đề và tránh
								giọng dịch máy. Chọn phong cách khác nếu nội dung cần sắc thái riêng.
							</p>
						</div>
						<DraftStylePicker
							defaultValue={DEFAULT_DRAFT_TONE}
							helper="Cách thể hiện"
							label="Giọng điệu"
							name="evidence-draft-tone"
							onChange={setTone}
							options={DRAFT_TONE_OPTIONS}
							value={tone}
						/>
						<DraftStylePicker
							defaultValue={DEFAULT_DRAFT_VOICE}
							helper="Cảm giác khi đọc"
							label="Giọng văn"
							name="evidence-draft-voice"
							onChange={setVoice}
							options={DRAFT_VOICE_OPTIONS}
							value={voice}
						/>
					</div>
					<label className="flex items-start gap-3 rounded-lg border border-[var(--border)] p-3"><input type="checkbox" checked={includeRelatedEvidence} onChange={(event) => setIncludeRelatedEvidence(event.target.checked)} className="mt-0.5" /><span><span className="block text-xs font-bold text-[var(--foreground)]">Kèm bằng chứng liên quan trong scan</span><span className="mt-1 block text-[10px] leading-4 text-[var(--muted)]">Mặc định chỉ dùng đúng bài viết hiện tại để giảm nhiễu.</span></span></label>
					<label><span className={labelClass}>Ghi chú cho AI</span><textarea value={operatorNotes} onChange={(event) => setOperatorNotes(event.target.value)} maxLength={2000} rows={5} placeholder="Mục tiêu, đối tượng, điểm cần tránh…" className="mt-2 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-xs text-[var(--foreground)] outline-none focus:border-[var(--brand)]" /></label>
					{error ? <p role="alert" className="rounded-lg bg-[var(--danger-soft)] p-3 text-xs font-semibold text-[var(--danger-strong)]">{error}</p> : null}
				</div>
				<footer className="sticky bottom-0 z-20 border-t border-[var(--border)] bg-[var(--surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_28px_rgb(0_0_0/0.12)] sm:p-5"><button type="button" disabled={isGenerating} onClick={() => void generateDraft()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent-fill)] px-4 text-xs font-extrabold text-white transition hover:bg-[var(--accent-fill-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:cursor-wait disabled:opacity-60">{isGenerating ? <LoaderCircle className="animate-spin" size={16} /> : <FileText size={16} />}{isGenerating ? "Đang tạo và lưu bản nháp…" : "Tạo bản nháp cần duyệt"}</button><p className="mt-2 text-center text-[10px] font-semibold text-[var(--muted)]">Chỉ lưu nội bộ · không tự động đăng lên Facebook</p></footer>
			</section>
		</div>
	);
}

const labelClass = "text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]";

function PageClassificationGuidance({
	classification,
}: {
	classification: TimelinePost["pageClassification"];
}) {
	if (classification === "uncategorized") return null;
	const neutral = classification === "neutral";
	const trusted = classification === "trusted";
	const Icon = trusted ? ShieldCheck : neutral ? Scale : ShieldAlert;
	const colorClass = trusted
		? "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success-strong)]"
		: neutral
			? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
			: "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger-strong)]";
	return (
		<div className={`flex items-start gap-3 rounded-lg border p-3 ${colorClass}`}>
			<Icon className="mt-0.5 shrink-0" size={17} />
			<div>
				<p className="text-xs font-extrabold">
					{trusted
						? "Gợi ý: bài chia sẻ tích cực"
						: neutral
							? "Gợi ý: bài viết trung lập"
							: "Gợi ý: phản biện có căn cứ"}
				</p>
				<p className="mt-1 text-[10px] font-semibold leading-4 text-[var(--muted-strong)]">
					{trusted
						? "Trang được đánh dấu đáng tin cậy. Hệ thống ưu tiên tóm lược giá trị thông tin và không thêm tuyên bố mới."
						: neutral
							? "Trang được đánh dấu trung lập. Hệ thống trình bày bằng chứng cân bằng, không mặc định ủng hộ hoặc phản bác."
							: "Trang được đánh dấu có rủi ro. Bản nháp phải kiểm tra từng tuyên bố và vẫn cần con người duyệt."}
				</p>
			</div>
		</div>
	);
}

export default EvidenceDraftSheet;
