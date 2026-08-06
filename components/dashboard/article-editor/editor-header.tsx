"use client";

import {
	AlertTriangle,
	ArrowLeft,
	Bot,
	Check,
	ChevronRight,
	CircleDashed,
	ExternalLink,
	EyeOff,
	Info,
	LoaderCircle,
	PanelRightClose,
	PanelRightOpen,
	Save,
	RefreshCw,
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
	effectivePublicationStatus,
	publicationLabel,
	publicationTone,
	relativeTime,
	secondaryButton,
	StatusChip,
	successButton,
	zaloPublicArticleUrl,
} from "./shared";
import type {
	ArticleRow,
	EditorNotice,
	PublishStep,
	ZaloPublishTarget,
} from "./types";

const STEPS = ["Soạn nội dung", "Phê duyệt", "Xem trước trên Zalo", "Đăng lên Zalo OA"];

const PUBLISH_STEP_LABELS: Record<string, string> = {
	preparing: "Đang chuẩn bị bài viết…",
	publishing: "Đang hiển thị công khai…",
	syncing: "Đang đưa lên Zalo OA…",
};

export function EditorHeader({
	article,
	blockers,
	busy,
	dirty,
	oaId,
	onPublish,
	onPublishAction,
	onReview,
	onSave,
	onToggleRail,
	publishStep,
	publishTarget,
	railOpen,
	stage,
	synced,
	title,
	versionCount,
}: {
	article: ArticleRow;
	blockers: string[];
	busy: string;
	dirty: boolean;
	oaId: string | null;
	onPublish: () => void;
	onPublishAction: (action: "hide" | "publish" | "sync") => void;
	onReview: (status: string) => void;
	onSave: () => void;
	onToggleRail: () => void;
	publishStep: PublishStep;
	publishTarget: ZaloPublishTarget;
	railOpen: boolean;
	stage: number;
	/** The draft on the OA matches what is in the editor. */
	synced: boolean;
	title: string;
	versionCount: number;
}) {
	const publicationStatus = effectivePublicationStatus(
		article.publicationStatus,
		article.reviewStatus,
	);
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
							label={publicationLabel(publicationStatus)}
							tone={publicationTone(publicationStatus)}
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
						busy={busy}
						disabled={Boolean(busy)}
						live={article.publicationStatus === "published"}
						liveUrl={zaloPublicArticleUrl(article.remoteArticleId, oaId)}
						onPublish={onPublish}
						onPublishAction={onPublishAction}
						publishStep={publishStep}
						publishTarget={publishTarget}
						publishing={busy === "publish"}
						staged={publicationStatus === "hidden"}
						synced={synced}
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

/**
 * Publishing is a single idea for the operator — the article goes live on the Zalo
 * Official Account — so it is a single button that narrates its own progress.
 */
function PublishButton({
	blockers,
	busy,
	disabled,
	live,
	liveUrl,
	onPublish,
	onPublishAction,
	publishStep,
	publishTarget,
	publishing,
	staged,
	synced,
}: {
	blockers: string[];
	busy: string;
	disabled: boolean;
	/** Already visible to followers on the OA. */
	live: boolean;
	liveUrl: string | null;
	onPublish: () => void;
	onPublishAction: (action: "hide" | "publish" | "sync") => void;
	publishStep: PublishStep;
	publishTarget: ZaloPublishTarget;
	publishing: boolean;
	/** A hidden draft already exists on the OA. */
	staged: boolean;
	/** The draft on the OA matches what is in the editor. */
	synced: boolean;
}) {
	// Offering "publish" on something already published is an action with no
	// meaning. What an operator wants there is to see it, or to take it down.
	if (live) {
		return (
			<div className="flex items-center gap-2">
				{liveUrl ? (
					<DashboardTooltip content="Mở bài viết đang hiển thị trên Zalo OA, đúng như người theo dõi nhìn thấy.">
						<a
							className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]"
							href={liveUrl}
							rel="noopener noreferrer"
							target="_blank"
						>
							<ExternalLink size={15} /> Xem trên Zalo
						</a>
					</DashboardTooltip>
				) : null}
				<DashboardTooltip content="Gỡ bài khỏi hiển thị công khai. Nội dung vẫn được giữ để đăng lại.">
					<button
						className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--danger-border)] px-4 text-[12px] font-bold text-[var(--danger-strong)] transition hover:bg-[var(--danger-soft)] disabled:cursor-not-allowed disabled:opacity-50"
						disabled={disabled}
						onClick={() => onPublishAction("hide")}
						type="button"
					>
						{publishing ? (
							<LoaderCircle size={15} className="animate-spin" />
						) : (
							<EyeOff size={15} />
						)}
						Gỡ khỏi Zalo
					</button>
				</DashboardTooltip>
			</div>
		);
	}

	// A draft already on the OA cannot be "put on the OA" again. The step the
	// operator is actually on is making it public — which is what the stepper
	// above already says — so the primary button says the same thing rather than
	// offering an upload that would change nothing.
	if (staged) {
		return (
			<div className="flex items-center gap-2">
				{synced ? null : (
					<DashboardTooltip content="Bản ẩn trên Zalo cũ hơn nội dung đang soạn. Đồng bộ lại trước khi hiển thị công khai.">
						<button
							className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--warning-border)] px-3 text-[12px] font-bold text-[var(--warning-strong)] transition hover:bg-[var(--warning-soft)] disabled:cursor-not-allowed disabled:opacity-50"
							disabled={disabled}
							onClick={() => onPublishAction("sync")}
							type="button"
						>
							{busy === "sync" ? (
								<LoaderCircle size={15} className="animate-spin" />
							) : (
								<RefreshCw size={15} />
							)}
							Đồng bộ lại bản ẩn
						</button>
					</DashboardTooltip>
				)}
				<DashboardTooltip content="Bản ẩn đã có trên Zalo OA. Hiển thị công khai với người theo dõi.">
					<button
						className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--brand)] px-4 text-[12px] font-bold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-50"
						disabled={disabled}
						onClick={() => onPublishAction("publish")}
						type="button"
					>
						{busy === "publish" ? (
							<LoaderCircle size={15} className="animate-spin" />
						) : (
							<Send size={15} />
						)}
						Hiển thị công khai
					</button>
				</DashboardTooltip>
			</div>
		);
	}

	const blocked = blockers.length > 0;
	const label = publishing
		? (publishStep && PUBLISH_STEP_LABELS[publishStep]) || "Đang đăng…"
		: publishTarget === "public"
			? "Đăng lên Zalo OA"
			: "Đưa lên Zalo (ẩn)";

	return (
		<DashboardTooltip
			content={
				blocked ? (
					<div className="space-y-1">
						<p className="font-bold">Chưa thể đăng bài:</p>
						<ul className="list-disc space-y-1 pl-4">
							{blockers.map((blocker) => (
								<li key={blocker}>{blocker}</li>
							))}
						</ul>
					</div>
				) : publishTarget === "public" ? (
					"Đưa bài lên Zalo OA và hiển thị công khai với người theo dõi."
				) : (
					"Đưa bài lên Zalo OA ở trạng thái ẩn. Chọn trạng thái ở cột phải."
				)
			}
		>
			<button
				type="button"
				disabled={blocked || disabled}
				onClick={onPublish}
				className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--brand)] px-4 text-[12px] font-bold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-50"
			>
				{publishing ? (
					<LoaderCircle size={15} className="animate-spin" />
				) : (
					<Send size={15} />
				)}
				{label}
			</button>
		</DashboardTooltip>
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
	// `info` reports a choice recorded rather than work done, so it must not wear
	// the same green tick as "published" — that would claim something happened.
	const isInfo = !isError && notice?.tone === "info";
	return (
		<div
			role="status"
			className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[13px] font-semibold ${
				isError
					? "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger-strong)]"
					: isInfo
						? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
						: "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success-strong)]"
			}`}
		>
			{isError ? (
				<AlertTriangle size={16} className="mt-0.5 shrink-0" />
			) : isInfo ? (
				<Info size={16} className="mt-0.5 shrink-0" />
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
	if (article.publicationStatus === "published") return 4;
	if (article.remoteArticleId && synced) return 3;
	if (article.reviewStatus === "approved") return 2;
	return article.reviewStatus === "needs_review" ? 1 : 0;
}
