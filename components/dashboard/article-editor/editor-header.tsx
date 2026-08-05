"use client";

import {
	AlertTriangle,
	ArrowLeft,
	Bot,
	Check,
	ChevronRight,
	CircleDashed,
	LoaderCircle,
	PanelRightClose,
	PanelRightOpen,
	Save,
	Send,
	Undo2,
	X,
} from "lucide-react";
import Link from "next/link";

import {
	DashboardTooltip,
	ReviewBadge,
} from "@/components/dashboard/ui-primitives";

import {
	publicationLabel,
	publicationTone,
	relativeTime,
	secondaryButton,
	StatusChip,
	successButton,
} from "./shared";
import type { ArticleRow, EditorNotice } from "./types";

const STEPS = [
	"Soạn nội dung",
	"Phê duyệt",
	"Xuất bản nội bộ",
	"Đồng bộ bản ẩn",
	"Đăng công khai",
];

export function EditorHeader({
	article,
	blockers,
	busy,
	dirty,
	onPublish,
	onReview,
	onSave,
	onToggleRail,
	onToggleZalo,
	publishToZalo,
	railOpen,
	stage,
	title,
	versionCount,
}: {
	article: ArticleRow;
	blockers: string[];
	busy: string;
	dirty: boolean;
	onPublish: () => void;
	onReview: (status: string) => void;
	onSave: () => void;
	onToggleRail: () => void;
	onToggleZalo: (value: boolean) => void;
	publishToZalo: boolean;
	railOpen: boolean;
	stage: number;
	title: string;
	versionCount: number;
}) {
	return (
		<header className="sticky top-2 z-30 rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 shadow-[var(--shadow-soft)] backdrop-blur">
			<div className="flex flex-wrap items-center gap-3 px-3 py-3">
				<Link
					href="/articles"
					className="grid size-10 shrink-0 place-items-center rounded-lg border border-[var(--border)] text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]"
					aria-label="Quay lại danh sách bài viết"
				>
					<ArrowLeft size={17} />
				</Link>
				<div className="min-w-[12rem] flex-1">
					<div className="flex min-w-0 flex-wrap items-center gap-2">
						<p className="truncate text-[15px] font-bold text-[var(--foreground)]">
							{title || "Bài viết chưa đặt tên"}
						</p>
						<ReviewBadge status={article.reviewStatus} />
						<StatusChip
							label={publicationLabel(article.publicationStatus)}
							tone={publicationTone(article.publicationStatus)}
						/>
						{article.originDraftId ? (
							<DashboardTooltip content="Bài được chuẩn bị tự động từ nội dung đã quét và vẫn cần người duyệt trước khi xuất bản.">
								<span className="inline-flex h-6 items-center gap-1 rounded-md bg-[var(--accent-soft)] px-2 text-[11px] font-bold text-[var(--accent-strong)]">
									<Bot size={12} /> Soạn tự động
								</span>
							</DashboardTooltip>
						) : null}
					</div>
					<p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">
						{dirty ? (
							<span className="text-[var(--warning-strong)]">● Có thay đổi chưa lưu</span>
						) : (
							`Đã lưu ${relativeTime(article.updatedAt)}`
						)}
						{" · "}
						{versionCount} phiên bản
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<button
						type="button"
						onClick={onSave}
						disabled={!dirty || Boolean(busy)}
						className={secondaryButton}
					>
						{busy === "save" ? (
							<LoaderCircle className="animate-spin" size={15} />
						) : (
							<Save size={15} />
						)}
						Lưu
					</button>
					{article.reviewStatus === "approved" ? (
						<button
							type="button"
							onClick={() => onReview("needs_review")}
							disabled={Boolean(busy)}
							className={secondaryButton}
						>
							<Undo2 size={15} /> Gỡ duyệt
						</button>
					) : (
						<button
							type="button"
							onClick={() => onReview("approved")}
							disabled={Boolean(busy)}
							className={successButton}
						>
							{busy === "review" ? (
								<LoaderCircle className="animate-spin" size={15} />
							) : (
								<Check size={15} />
							)}
							Phê duyệt
						</button>
					)}
					<PublishButton
						blockers={blockers}
						busy={busy === "publish"}
						disabled={Boolean(busy)}
						onPublish={onPublish}
						onToggleZalo={onToggleZalo}
						publishToZalo={publishToZalo}
					/>
					<button
						type="button"
						onClick={onToggleRail}
						className="grid size-10 shrink-0 place-items-center rounded-lg border border-[var(--border)] text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]"
						aria-label={railOpen ? "Ẩn cột xem trước" : "Hiện cột xem trước"}
						aria-pressed={railOpen}
					>
						{railOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
					</button>
				</div>
			</div>
			<EditorStepper stage={stage} />
		</header>
	);
}

function PublishButton({
	blockers,
	busy,
	disabled,
	onPublish,
	onToggleZalo,
	publishToZalo,
}: {
	blockers: string[];
	busy: boolean;
	disabled: boolean;
	onPublish: () => void;
	onToggleZalo: (value: boolean) => void;
	publishToZalo: boolean;
}) {
	const blocked = blockers.length > 0;
	return (
		<div className="flex items-stretch overflow-hidden rounded-lg border border-[var(--brand)]">
			<DashboardTooltip
				content={
					blocked ? (
						<div className="space-y-1">
							<p className="font-bold">Chưa thể xuất bản:</p>
							<ul className="list-disc space-y-1 pl-4">
								{blockers.map((blocker) => (
									<li key={blocker}>{blocker}</li>
								))}
							</ul>
						</div>
					) : publishToZalo ? (
						"Xuất bản nội bộ rồi đồng bộ và đăng công khai lên Zalo OA."
					) : (
						"Xuất bản nội bộ trong CyberShield35. Chưa đăng lên Zalo OA."
					)
				}
			>
				<button
					type="button"
					disabled={blocked || disabled}
					onClick={onPublish}
					className="inline-flex h-10 items-center gap-2 bg-[var(--brand)] px-3.5 text-[12px] font-bold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-50"
				>
					{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}
					Xuất bản
				</button>
			</DashboardTooltip>
			<DashboardTooltip content="Bật để đồng thời đồng bộ và đăng công khai lên Zalo OA.">
				<label className="inline-flex h-10 cursor-pointer items-center gap-2 border-l border-white/25 bg-[var(--brand)]/90 px-3 text-[11px] font-bold text-white">
					<input
						type="checkbox"
						checked={publishToZalo}
						onChange={(event) => onToggleZalo(event.target.checked)}
						className="size-3.5 accent-white"
					/>
					Zalo OA
				</label>
			</DashboardTooltip>
		</div>
	);
}

function EditorStepper({ stage }: { stage: number }) {
	return (
		<ol className="flex min-w-0 items-center gap-1 overflow-x-auto border-t border-[var(--border)] px-3 py-2">
			{STEPS.map((label, index) => {
				const done = index < stage;
				const active = index === stage;
				return (
					<li key={label} className="flex shrink-0 items-center gap-1">
						<span
							className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-bold ${
								done
									? "bg-[var(--success-soft)] text-[var(--success-strong)]"
									: active
										? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
										: "text-[var(--muted)]"
							}`}
						>
							{done ? <Check size={12} /> : <CircleDashed size={12} />}
							{label}
						</span>
						{index < STEPS.length - 1 ? (
							<ChevronRight size={13} className="text-[var(--muted)]" />
						) : null}
					</li>
				);
			})}
		</ol>
	);
}

export function EditorNoticeBar({
	lastError,
	notice,
	onDismiss,
}: {
	lastError: string | null;
	notice: EditorNotice;
	onDismiss: () => void;
}) {
	if (!notice && !lastError) return null;
	const isError = Boolean(lastError) || notice?.tone === "error";
	return (
		<div
			role="status"
			className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[13px] font-semibold ${
				isError
					? "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger-strong)]"
					: "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success-strong)]"
			}`}
		>
			{isError ? (
				<AlertTriangle size={16} className="mt-0.5 shrink-0" />
			) : (
				<Check size={16} className="mt-0.5 shrink-0" />
			)}
			<span className="min-w-0 flex-1">{lastError ?? notice?.text}</span>
			{notice && !lastError ? (
				<button
					type="button"
					onClick={onDismiss}
					aria-label="Đóng thông báo"
					className="shrink-0 opacity-70 transition hover:opacity-100"
				>
					<X size={15} />
				</button>
			) : null}
		</div>
	);
}

export function editorStage(
	article: Pick<
		ArticleRow,
		"publicationStatus" | "remoteArticleId" | "reviewStatus" | "state"
	>,
	synced: boolean,
) {
	if (article.publicationStatus === "published") return 5;
	if (article.remoteArticleId && synced) return 4;
	if (article.state === "published") return 3;
	if (article.reviewStatus === "approved") return 2;
	return article.reviewStatus === "needs_review" ? 1 : 0;
}
