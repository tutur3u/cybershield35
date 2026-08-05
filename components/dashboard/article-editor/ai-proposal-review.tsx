"use client";

import { ArrowRight, Check, LoaderCircle, Sparkles } from "lucide-react";

import type { ArticleContent } from "@/lib/articles/schemas";
import {
	ZALO_EDITORIAL_DESCRIPTION_LIMIT,
	ZALO_EDITORIAL_TITLE_LIMIT,
} from "@/lib/zalo/article-content";

import { countWords, primaryButton, secondaryButton } from "./shared";
import type { AiProposal } from "./types";

/**
 * Side-by-side review of an AI suggestion. It leads with what actually changed —
 * title, excerpt, length — so an editor can judge the proposal without reading
 * both versions in full.
 */
export function AiProposalReview({
	current,
	onApply,
	onReject,
	pending,
	proposal,
}: {
	current: ArticleContent;
	onApply: () => void;
	onReject: () => void;
	pending: boolean;
	proposal: AiProposal;
}) {
	const currentWords = countWords(current);
	const proposalWords = countWords(proposal);
	const changes = [
		current.title.trim() !== proposal.title.trim() ? "Tiêu đề" : null,
		current.description.trim() !== proposal.description.trim() ? "Trích yếu" : null,
		current.blocks.length !== proposal.blocks.length
			? `Số khối ${current.blocks.length} → ${proposal.blocks.length}`
			: null,
		currentWords !== proposalWords
			? `Độ dài ${currentWords} → ${proposalWords} từ`
			: null,
	].filter((value): value is string => Boolean(value));

	return (
		<div className="mt-4 space-y-4">
			<div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2.5">
				<Sparkles size={16} className="shrink-0 text-[var(--accent-strong)]" />
				<p className="text-[12px] font-bold text-[var(--accent-strong)]">
					{changes.length ? "Thay đổi đề xuất:" : "Không có thay đổi đáng kể"}
				</p>
				{changes.map((change) => (
					<span
						key={change}
						className="rounded-md bg-[var(--surface)] px-2 py-1 text-[11px] font-bold text-[var(--muted-strong)]"
					>
						{change}
					</span>
				))}
			</div>

			<FieldDiff
				current={current.title}
				label="Tiêu đề"
				limit={ZALO_EDITORIAL_TITLE_LIMIT}
				proposal={proposal.title}
			/>
			<FieldDiff
				current={current.description}
				label="Trích yếu"
				limit={ZALO_EDITORIAL_DESCRIPTION_LIMIT}
				proposal={proposal.description}
			/>

			<div className="grid gap-3 lg:grid-cols-2">
				<BodyColumn body={bodyOf(current)} label="Hiện tại" words={currentWords} />
				<BodyColumn
					accent
					body={bodyOf(proposal)}
					label="Đề xuất"
					words={proposalWords}
				/>
			</div>

			{proposal.reviewNotes.length ? (
				<div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3">
					<p className="text-[11px] font-bold uppercase tracking-wide text-[var(--warning-strong)]">
						Cần kiểm tra trước khi duyệt
					</p>
					<ul className="mt-1.5 space-y-1 text-[12px] leading-5 text-[var(--muted-strong)]">
						{proposal.reviewNotes.map((note) => (
							<li key={note}>• {note}</li>
						))}
					</ul>
				</div>
			) : null}

			<div className="flex flex-wrap gap-2">
				<button type="button" onClick={onApply} disabled={pending} className={primaryButton}>
					{pending ? (
						<LoaderCircle size={14} className="animate-spin" />
					) : (
						<Check size={14} />
					)}
					Áp dụng đề xuất
				</button>
				<button
					type="button"
					onClick={onReject}
					disabled={pending}
					className={secondaryButton}
				>
					Giữ nguyên bài hiện tại
				</button>
			</div>
		</div>
	);
}

function FieldDiff({
	current,
	label,
	limit,
	proposal,
}: {
	current: string;
	label: string;
	limit: number;
	proposal: string;
}) {
	if (current.trim() === proposal.trim()) return null;
	return (
		<div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
			<p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
				{label}
			</p>
			<p className="mt-1.5 text-[12px] leading-5 text-[var(--muted)] line-through decoration-[var(--danger-strong)]/50">
				{current || "(trống)"}
			</p>
			<p className="mt-1.5 flex items-start gap-1.5 text-[13px] font-semibold leading-5 text-[var(--foreground)]">
				<ArrowRight size={14} className="mt-1 shrink-0 text-[var(--accent-strong)]" />
				<span>{proposal}</span>
			</p>
			<p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">
				{proposal.length}/{limit} ký tự
			</p>
		</div>
	);
}

function BodyColumn({
	accent = false,
	body,
	label,
	words,
}: {
	accent?: boolean;
	body: string;
	label: string;
	words: number;
}) {
	return (
		<div
			className={`rounded-lg border bg-[var(--surface)] p-3 ${
				accent ? "border-[var(--accent)]" : "border-[var(--border)]"
			}`}
		>
			<p
				className={`text-[11px] font-bold uppercase tracking-wide ${
					accent ? "text-[var(--accent-strong)]" : "text-[var(--muted)]"
				}`}
			>
				{label} · {words} từ
			</p>
			<p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap text-[12px] leading-5 text-[var(--muted-strong)]">
				{body || "(chưa có nội dung)"}
			</p>
		</div>
	);
}

function bodyOf(content: ArticleContent) {
	return content.blocks
		.filter((block) => block.type === "text")
		.map((block) => (block.type === "text" ? block.content : ""))
		.join("\n\n");
}
