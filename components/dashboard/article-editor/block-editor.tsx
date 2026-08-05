"use client";

import {
	ArrowDown,
	ArrowUp,
	Copy,
	GripVertical,
	ImageIcon,
	Trash2,
	Type,
} from "lucide-react";
import type { DragEvent, ReactNode } from "react";

import { DashboardTooltip } from "@/components/dashboard/ui-primitives";
import type { ArticleBlock } from "@/lib/articles/schemas";

import { MediaField } from "./media-fields";
import { inputClass, textareaClass, wordCount } from "./shared";

export function BlockEditor({
	articleId,
	block,
	count,
	dragging = false,
	dropTarget = false,
	index,
	onChange,
	onDragEnd,
	onDragOver,
	onDragStart,
	onDrop,
	onDuplicate,
	onImageUnavailable,
	onMove,
	onRemove,
}: {
	articleId: string;
	block: ArticleBlock;
	count: number;
	dragging?: boolean;
	dropTarget?: boolean;
	index: number;
	onChange: (block: ArticleBlock) => void;
	onDragEnd?: () => void;
	onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
	onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
	onDrop?: (event: DragEvent<HTMLDivElement>) => void;
	onDuplicate: () => void;
	onImageUnavailable: () => void;
	onMove: (direction: -1 | 1) => void;
	onRemove: () => void;
}) {
	return (
		<div
			draggable={Boolean(onDragStart)}
			onDragEnd={onDragEnd}
			onDragOver={onDragOver}
			onDragStart={onDragStart}
			onDrop={onDrop}
			className={`group rounded-xl border bg-[var(--surface-soft)] transition focus-within:border-[var(--accent)] ${
				dragging
					? "border-[var(--accent)] opacity-60"
					: dropTarget
						? "border-[var(--accent)] ring-2 ring-[var(--accent)]/25"
						: "border-[var(--border)]"
			}`}
		>
			<div className="flex items-center justify-between gap-3 border-b border-[var(--divider)] px-3 py-2">
				<p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--muted-strong)]">
					<span
						aria-hidden
						title="Kéo để đổi vị trí"
						className="cursor-grab text-[var(--muted)] active:cursor-grabbing"
					>
						<GripVertical size={14} />
					</span>
					{block.type === "text" ? <Type size={13} /> : <ImageIcon size={13} />}
					Khối {index + 1} · {block.type === "text" ? "Văn bản" : "Ảnh"}
				</p>
				<div className="flex gap-1 opacity-70 transition group-focus-within:opacity-100 group-hover:opacity-100">
					<IconAction
						disabled={index === 0}
						label="Di chuyển lên"
						onClick={() => onMove(-1)}
					>
						<ArrowUp size={13} />
					</IconAction>
					<IconAction
						disabled={index === count - 1}
						label="Di chuyển xuống"
						onClick={() => onMove(1)}
					>
						<ArrowDown size={13} />
					</IconAction>
					<IconAction label="Nhân bản khối" onClick={onDuplicate}>
						<Copy size={13} />
					</IconAction>
					<IconAction danger label="Xóa khối" onClick={onRemove}>
						<Trash2 size={13} />
					</IconAction>
				</div>
			</div>
			<div className="p-3">
				{block.type === "text" ? (
					<>
						<textarea
							value={block.content}
							onChange={(event) => onChange({ ...block, content: event.target.value })}
							rows={Math.min(20, Math.max(6, block.content.split("\n").length + 2))}
							className={`${textareaClass} text-[14px] leading-6`}
							placeholder="Viết nội dung tự nhiên, rõ ràng và có căn cứ…"
						/>
						<p className="mt-1.5 text-right text-[11px] font-semibold text-[var(--muted)]">
							{wordCount(block.content)} từ
						</p>
					</>
				) : (
					<div className="space-y-2">
						<MediaField
							articleId={articleId}
							compact
							onChange={(url) => onChange({ ...block, url: url ?? "" })}
							onUnavailable={onImageUnavailable}
							url={block.url || null}
						/>
						<input
							value={block.caption ?? ""}
							onChange={(event) =>
								onChange({ ...block, caption: event.target.value || undefined })
							}
							className={inputClass}
							placeholder="Chú thích ảnh (không bắt buộc)"
						/>
					</div>
				)}
			</div>
		</div>
	);
}

function IconAction({
	children,
	danger = false,
	disabled = false,
	label,
	onClick,
}: {
	children: ReactNode;
	danger?: boolean;
	disabled?: boolean;
	label: string;
	onClick: () => void;
}) {
	return (
		<DashboardTooltip content={label}>
			<button
				type="button"
				aria-label={label}
				disabled={disabled}
				onClick={onClick}
				className={`grid size-7 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface)] transition hover:border-[var(--border-strong)] disabled:opacity-35 ${
					danger ? "text-[var(--danger-strong)]" : "text-[var(--muted-strong)]"
				}`}
			>
				{children}
			</button>
		</DashboardTooltip>
	);
}
