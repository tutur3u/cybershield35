"use client";

import type { ReactNode } from "react";

import type { ArticleBlock, ArticleContent } from "@/lib/articles/schemas";

import type { StatusTone } from "./types";

export function Section({
	action,
	children,
	description,
	icon: Icon,
	title,
}: {
	action?: ReactNode;
	children: ReactNode;
	description?: string;
	icon: (props: { size?: number; className?: string }) => ReactNode;
	title: string;
}) {
	return (
		<section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
			<header className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
				<div className="flex min-w-0 items-start gap-2.5">
					<Icon size={16} className="mt-0.5 shrink-0 text-[var(--brand)]" />
					<div className="min-w-0">
						<h2 className="truncate text-[13px] font-bold text-[var(--foreground)]">
							{title}
						</h2>
						{description ? (
							<p className="mt-0.5 text-[11px] leading-4 text-[var(--muted)]">
								{description}
							</p>
						) : null}
					</div>
				</div>
				{action}
			</header>
			<div className="p-4">{children}</div>
		</section>
	);
}

export function Field({
	children,
	className = "",
	count,
	hint,
	label,
}: {
	children: ReactNode;
	className?: string;
	count?: string;
	hint?: string;
	label: string;
}) {
	return (
		<label className={`block min-w-0 ${className}`}>
			<span className="flex items-center justify-between gap-3">
				<span className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted-strong)]">
					{label}
				</span>
				{count ? (
					<span className="text-[11px] font-semibold text-[var(--muted)]">{count}</span>
				) : null}
			</span>
			{hint ? (
				<span className="mt-1 block text-[11px] leading-4 text-[var(--muted)]">
					{hint}
				</span>
			) : null}
			<span className="mt-2 block">{children}</span>
		</label>
	);
}

export function StatusChip({ label, tone }: { label: string; tone: StatusTone }) {
	const styles: Record<StatusTone, string> = {
		accent: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
		danger: "bg-[var(--danger-soft)] text-[var(--danger-strong)]",
		neutral: "bg-[var(--neutral-soft)] text-[var(--muted-strong)]",
		success: "bg-[var(--success-soft)] text-[var(--success-strong)]",
		warning: "bg-[var(--warning-soft)] text-[var(--warning-strong)]",
	};
	return (
		<span
			className={`inline-flex h-6 shrink-0 items-center rounded-md px-2 text-[11px] font-bold ${styles[tone]}`}
		>
			{label}
		</span>
	);
}

export function ToggleRow({
	checked,
	label,
	onChange,
}: {
	checked: boolean;
	label: string;
	onChange: (value: boolean) => void;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			onClick={() => onChange(!checked)}
			className="flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-[12px] font-bold text-[var(--foreground)] transition hover:border-[var(--border-strong)]"
		>
			{label}
			<span
				aria-hidden
				className={`relative inline-flex h-6 w-11 shrink-0 rounded-full p-0.5 transition ${
					checked ? "bg-[var(--brand)]" : "bg-[var(--border-strong)]"
				}`}
			>
				<span
					className={`size-5 rounded-full bg-white shadow-sm transition ${
						checked ? "translate-x-5" : "translate-x-0"
					}`}
				/>
			</span>
		</button>
	);
}

export async function fetchJson<T = unknown>(
	url: string,
	init?: RequestInit,
): Promise<T> {
	const response = await fetch(url, { cache: "no-store", ...init });
	const body = await response.json().catch(() => null);
	if (!response.ok) {
		const message =
			body && typeof body === "object" && "error" in body
				? typeof body.error === "string"
					? body.error
					: JSON.stringify(body.error)
				: "Thao tác không thành công.";
		throw new Error(message);
	}
	return body as T;
}

export function relativeTime(value: string) {
	const seconds = Math.max(1, Math.round((Date.now() - Date.parse(value)) / 1000));
	if (seconds < 60) return "vừa xong";
	if (seconds < 3_600) return `${Math.floor(seconds / 60)} phút trước`;
	if (seconds < 86_400) return `${Math.floor(seconds / 3_600)} giờ trước`;
	return `${Math.floor(seconds / 86_400)} ngày trước`;
}

export function wordCount(value: string) {
	return value.trim() ? value.trim().split(/\s+/u).length : 0;
}

export function countWords(content: ArticleContent) {
	return content.blocks.reduce(
		(total, block) => total + (block.type === "text" ? wordCount(block.content) : 0),
		0,
	);
}

export function moveBlock(blocks: ArticleBlock[], index: number, direction: -1 | 1) {
	const target = index + direction;
	if (target < 0 || target >= blocks.length) return blocks;
	const next = [...blocks];
	const [block] = next.splice(index, 1);
	if (block) next.splice(target, 0, block);
	return next;
}

export function insertBlock(
	blocks: ArticleBlock[],
	index: number,
	block: ArticleBlock,
) {
	const next = [...blocks];
	next.splice(index, 0, block);
	return next;
}

export function duplicateBlock(block: ArticleBlock): ArticleBlock {
	return { ...block, id: crypto.randomUUID() };
}

export function articlePlainText(content: ArticleContent) {
	return [
		content.description,
		...content.blocks.map((block) =>
			block.type === "text"
				? block.content
				: block.caption
					? `[Ảnh] ${block.caption}`
					: "[Ảnh]",
		),
	]
		.filter(Boolean)
		.join("\n\n");
}

export function operationLabel(operation: string) {
	return (
		{
			hide: "Ẩn bài",
			publish: "Xuất bản",
			sync_hidden: "Đồng bộ bản nháp ẩn",
			update_visible: "Cập nhật bài đã đăng",
		}[operation] ?? operation
	);
}

export function jobStatusLabel(status: string) {
	return (
		{
			completed: "Hoàn tất",
			failed: "Lỗi",
			queued: "Đang chờ",
			running: "Đang chạy",
		}[status] ?? status
	);
}

export function riskLabel(value: string) {
	return { high: "Rủi ro cao", low: "Rủi ro thấp", medium: "Rủi ro TB" }[value] ?? value;
}

export function reviewLabel(status: string) {
	return (
		{
			approved: "Đã duyệt",
			draft: "Bản nháp",
			needs_review: "Cần duyệt",
			rejected: "Đã từ chối",
		}[status] ?? status
	);
}

export function reviewTone(status: string): StatusTone {
	return (
		({
			approved: "success",
			needs_review: "warning",
			rejected: "danger",
		}[status] as StatusTone | undefined) ?? "neutral"
	);
}

/**
 * Collapses a Zalo state that approval makes meaningless.
 *
 * A queued sync the rules reject leaves "failed"/"syncing" on an article nobody
 * approved. Reporting that verbatim tells the operator a publish went wrong when
 * no publish was ever attempted — so an unapproved article only reports what is
 * genuinely on the OA, and otherwise reads as not yet sent.
 */
export function effectivePublicationStatus(
	status: string,
	reviewStatus: string,
) {
	if (reviewStatus === "approved") return status;
	return status === "published" || status === "hidden" ? status : "not_synced";
}

export function publicationLabel(status: string) {
	return (
		{
			failed: "Đăng thất bại",
			hidden: "Đang ẩn trên Zalo",
			not_synced: "Chưa đưa lên Zalo",
			published: "Đang hiển thị trên Zalo",
			publishing: "Đang đăng lên Zalo…",
			scheduled: "Đã hẹn giờ đăng",
			syncing: "Đang đưa lên Zalo…",
		}[status] ?? "Chưa đưa lên Zalo"
	);
}

export function publicationTone(status: string): StatusTone {
	return (
		({
			failed: "danger",
			hidden: "warning",
			published: "success",
			publishing: "accent",
			scheduled: "accent",
			syncing: "accent",
		}[status] as StatusTone | undefined) ?? "neutral"
	);
}

export function modelLabel(value: string) {
	return value.replace(/^google\//u, "").replaceAll("-", " ");
}

export const inputClass =
	"h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-[13px] font-medium text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15";
export const textareaClass =
	"w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[13px] leading-6 text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15";
export const primaryButton =
	"inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--accent-fill)] px-3.5 text-[12px] font-bold text-white transition hover:bg-[var(--accent-fill-hover)] disabled:cursor-not-allowed disabled:opacity-50";
export const successButton =
	"inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-3.5 text-[12px] font-bold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryButton =
	"inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 text-[12px] font-bold text-[var(--muted-strong)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-50";
export const smallButton =
	"inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)] disabled:opacity-50";
export const dangerTextButton =
	"inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-[12px] font-bold text-[var(--danger-strong)] transition hover:bg-[var(--danger-soft)] disabled:opacity-50";
export const ZALO_OA_MANAGER_URL = "https://oa.zalo.me/manage/content/article/";

/**
 * Opens the article straight in Zalo's own editor. Landing on the list and
 * hunting for the right row is the slow path when someone wants to check or
 * tweak exactly this article.
 */
/**
 * The public post as a follower sees it.
 *
 * Once something is live, "open it on Zalo" means the published article, not the
 * editor — an operator checking a live post wants what the audience got.
 */
export function zaloPublicArticleUrl(
	remoteArticleId: string | null,
	oaId: string | null,
) {
	const id = remoteArticleId?.trim();
	const page = oaId?.trim();
	if (!id || !page) return null;
	return `https://officialaccount.me/d?id=${encodeURIComponent(id)}&pageId=${encodeURIComponent(page)}`;
}

export function zaloArticleEditorUrl(remoteArticleId: string | null) {
	const id = remoteArticleId?.trim();
	if (!id) return null;
	return `https://oa.zalo.me/manage/content/article/edit?id=${encodeURIComponent(id)}`;
}
