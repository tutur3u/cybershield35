"use client";

import { FileText, LoaderCircle, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { TimelinePost } from "@/components/dashboard/types";

const kinds = [
	["response", "Phản hồi"],
	["comment", "Bình luận"],
	["counter_argument", "Phản biện"],
	["internal_brief", "Tóm tắt nội bộ"],
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
	const [draftKind, setDraftKind] = useState<(typeof kinds)[number][0]>("response");
	const [includeRelatedEvidence, setIncludeRelatedEvidence] = useState(false);
	const [operatorNotes, setOperatorNotes] = useState("");
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

	async function generateDraft() {
		setIsGenerating(true);
		setError("");
		try {
			const response = await fetch(`/api/evidence/${post.id}/drafts`, {
				body: JSON.stringify({
					draftKind,
					includeRelatedEvidence,
					operatorNotes: operatorNotes || undefined,
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
		<div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-950/55 backdrop-blur-[2px] sm:items-stretch" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !isGenerating) onOpenChange(false); }}>
			<section aria-labelledby="draft-sheet-title" aria-modal="true" className="flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl sm:max-h-none sm:max-w-[520px] sm:rounded-none sm:border-y-0 sm:border-r-0" role="dialog">
				<header className="flex items-start justify-between gap-3 border-b border-[var(--border)] p-4 sm:p-5">
					<div><span className="grid size-9 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Sparkles size={17} /></span><h2 id="draft-sheet-title" className="mt-3 text-base font-extrabold text-[var(--foreground)]">Soạn phản hồi từ bằng chứng</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Lưu vào Bản nháp để con người duyệt. Không tự động đăng tải.</p></div>
					<button ref={closeRef} type="button" disabled={isGenerating} onClick={() => onOpenChange(false)} className="grid size-9 place-items-center rounded-md border border-[var(--border)] text-[var(--muted-strong)]" aria-label="Đóng"><X size={16} /></button>
				</header>
				<div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
					<div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3"><p className="line-clamp-4 text-xs font-semibold leading-5 text-[var(--foreground)]">{post.quote}</p><p className="mt-2 font-mono text-[9px] text-[var(--muted)]">{post.id}</p></div>
					<fieldset><legend className={labelClass}>Loại bản nháp</legend><div className="mt-2 grid grid-cols-2 gap-2">{kinds.map(([value, label]) => <button key={value} type="button" onClick={() => setDraftKind(value)} className={`min-h-10 rounded-md border px-3 text-xs font-bold ${draftKind === value ? "border-[var(--brand)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "border-[var(--border)] text-[var(--muted-strong)]"}`}>{label}</button>)}</div></fieldset>
					<label className="flex items-start gap-3 rounded-lg border border-[var(--border)] p-3"><input type="checkbox" checked={includeRelatedEvidence} onChange={(event) => setIncludeRelatedEvidence(event.target.checked)} className="mt-0.5" /><span><span className="block text-xs font-bold text-[var(--foreground)]">Kèm bằng chứng liên quan trong scan</span><span className="mt-1 block text-[10px] leading-4 text-[var(--muted)]">Mặc định chỉ dùng đúng bài viết hiện tại để giảm nhiễu.</span></span></label>
					<label><span className={labelClass}>Ghi chú cho AI</span><textarea value={operatorNotes} onChange={(event) => setOperatorNotes(event.target.value)} maxLength={2000} rows={5} placeholder="Mục tiêu, đối tượng, điểm cần tránh…" className="mt-2 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-xs text-[var(--foreground)] outline-none focus:border-[var(--brand)]" /></label>
					{error ? <p role="alert" className="rounded-lg bg-[var(--danger-soft)] p-3 text-xs font-semibold text-[var(--danger-strong)]">{error}</p> : null}
				</div>
				<footer className="border-t border-[var(--border)] p-4 sm:p-5"><button type="button" disabled={isGenerating} onClick={() => void generateDraft()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-4 text-xs font-extrabold text-white disabled:opacity-60">{isGenerating ? <LoaderCircle className="animate-spin" size={16} /> : <FileText size={16} />}{isGenerating ? "Đang tạo và lưu bản nháp…" : "Tạo bản nháp cần duyệt"}</button></footer>
			</section>
		</div>
	);
}

const labelClass = "text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]";

export default EvidenceDraftSheet;
