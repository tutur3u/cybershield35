"use client";

import {
	Bot,
	CalendarClock,
	Check,
	Clock3,
	ExternalLink,
	Eye,
	EyeOff,
	LoaderCircle,
	RefreshCw,
	Send,
	Trash2,
} from "lucide-react";

import type { ArticleContent } from "@/lib/articles/schemas";

import {
	dangerTextButton,
	Field,
	inputClass,
	jobStatusLabel,
	operationLabel,
	primaryButton,
	Section,
	secondaryButton,
} from "./shared";
import type { ArticleDetail, ReadinessItem, ZaloPublishTarget } from "./types";
import { ZaloDashboardHandoff, ZaloPreview } from "./zalo-preview";

export type PublishRailProps = {
	accounts:
		| {
				accounts: Array<{ displayName: string; id: string; oaId: string }>;
				enabled: boolean;
		  }
		| undefined;
	busy: string;
	detail: ArticleDetail;
	draft: ArticleContent;
	onCancelSchedule: () => void;
	onCoverUnavailable: () => void;
	onDelete: () => void;
	onPublishAction: (action: "sync" | "publish" | "live-update" | "hide") => void;
	onRefreshRemote: () => void;
	onRemoveRemote: () => void;
	onScheduleChange: (value: string) => void;
	onSchedulePublish: () => void;
	onPublishTargetChange: (value: ZaloPublishTarget) => void;
	onTargetOaChange: (value: string) => void;
	publishTarget: ZaloPublishTarget;
	readiness: ReadinessItem[];
	schedule: string;
	synced: boolean;
	targetOaConnectionId: string;
};

/**
 * What stays beside the editor while writing: the preview and what the pipeline
 * has been doing. Everything that ships the article lives in its own tab, so
 * publishing is a deliberate destination rather than a column the author scrolls
 * past while typing.
 */
export function PublishRail(props: PublishRailProps) {
	return (
		<aside className="min-w-0 space-y-4 xl:sticky xl:top-[8.5rem]">
			<Section
				description="Đúng những gì người theo dõi Zalo OA sẽ nhìn thấy."
				icon={Eye}
				title="Xem trước"
			>
				<ZaloPreview
					content={props.draft}
					onCoverUnavailable={props.onCoverUnavailable}
				/>
			</Section>

			<Section icon={Clock3} title="Hoạt động gần đây">
				{props.detail.jobs.length ? (
					<div className="space-y-2">
						{props.detail.jobs.slice(0, 6).map((job) => (
							<div key={job.id} className="rounded-lg border border-[var(--border)] p-2.5">
								<div className="flex items-center justify-between gap-2">
									<p className="text-[12px] font-bold text-[var(--foreground)]">
										{operationLabel(job.operation)}
									</p>
									<span className="text-[11px] font-bold text-[var(--muted)]">
										{jobStatusLabel(job.status)}
									</span>
								</div>
								{job.errorMessage ? (
									<p className="mt-1 text-[11px] leading-4 text-[var(--danger-strong)]">
										{job.errorMessage}
									</p>
								) : null}
							</div>
						))}
					</div>
				) : (
					<p className="text-[12px] text-[var(--muted)]">Chưa có thao tác nào.</p>
				)}
			</Section>

		</aside>
	);
}

/**
 * The Zalo Official Account controls: which OA, what visibility, scheduling and
 * the handoff into Zalo's own editor. Exported so the "Xuất bản" tab can render
 * them without the rail's preview and activity around them.
 */
export function PublishSections(props: PublishRailProps) {
	const { article } = props.detail;
	const live = article.publicationStatus === "published";

	return (
		<>
			<Section icon={Send} title="Đăng lên Zalo OA">
				{article.originDraftId ? (
					<div className="mb-3 flex items-start gap-2 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] p-3">
						<Bot size={15} className="mt-0.5 shrink-0 text-[var(--accent-strong)]" />
						<p className="text-[11px] leading-4 text-[var(--muted-strong)]">
							Bài được soạn tự động từ nội dung đã quét. Việc đăng công khai luôn cần
							người duyệt và xác nhận tại đây.
						</p>
					</div>
				) : null}

				{!props.accounts?.enabled ? (
					<div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3 text-[11px] leading-5 text-[var(--warning-strong)]">
						Kết nối Zalo OA đang tắt. Liên hệ quản trị viên workspace để bật tính năng
						đăng bài.
					</div>
				) : props.accounts.accounts.length === 0 ? (
					<a
						href="/api/integrations/zalo/authorize"
						className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0068ff] text-[12px] font-bold text-white"
					>
						<ExternalLink size={15} /> Kết nối Zalo OA
					</a>
				) : (
					<div className="space-y-3">
						{/*
							The destination is always shown, even with a single account.
							Publishing reaches a real audience, so "which OA is this going
							to" must be answerable at a glance rather than inferred from an
							absent control.
						*/}
						<Field label="Đăng lên tài khoản">
							{props.accounts.accounts.length === 1 ? (
								<div className="flex items-center gap-2.5 rounded-lg border border-[var(--accent)]/50 bg-[var(--accent-soft)] px-3 py-2.5">
									<Check
										size={15}
										className="shrink-0 text-[var(--accent-strong)]"
									/>
									<span className="min-w-0">
										<span className="block truncate text-[12px] font-bold text-[var(--foreground)]">
											{props.accounts.accounts[0]?.displayName}
										</span>
										<span className="block truncate text-[11px] font-semibold text-[var(--muted)]">
											OA {props.accounts.accounts[0]?.oaId}
										</span>
									</span>
								</div>
							) : (
								<div className="space-y-1.5">
									{props.accounts.accounts.map((account) => {
										const selected =
											props.targetOaConnectionId === account.id;
										return (
											<button
												key={account.id}
												type="button"
												aria-pressed={selected}
												onClick={() => props.onTargetOaChange(account.id)}
												className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition ${
													selected
														? "border-[var(--accent)] bg-[var(--accent-soft)]"
														: "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-soft)]"
												}`}
											>
												<span
													className={`grid size-4 shrink-0 place-items-center rounded-full border ${
														selected
															? "border-[var(--accent)] bg-[var(--accent)] text-white"
															: "border-[var(--border-strong)]"
													}`}
												>
													{selected ? <Check size={10} /> : null}
												</span>
												<span className="min-w-0">
													<span className="block truncate text-[12px] font-bold text-[var(--foreground)]">
														{account.displayName}
													</span>
													<span className="block truncate text-[11px] font-semibold text-[var(--muted)]">
														OA {account.oaId}
													</span>
												</span>
											</button>
										);
									})}
								</div>
							)}
						</Field>

						<ZaloDashboardHandoff
							oaDisplayName={props.detail.oaDisplayName}
							oaId={props.detail.oaId}
							publicationStatus={article.publicationStatus}
							remoteArticleId={article.remoteArticleId}
							synced={props.synced}
						/>

						{live ? null : (
							<Field
								hint="Tương ứng trạng thái bài viết trong Zalo OA."
								label="Trạng thái khi đăng"
							>
								<div className="grid grid-cols-2 gap-2">
									<TargetButton
										active={props.publishTarget === "public"}
										description="Người theo dõi nhìn thấy ngay"
										label="Hiển thị công khai"
										onClick={() => props.onPublishTargetChange("public")}
									/>
									<TargetButton
										active={props.publishTarget === "hidden"}
										description="Chỉ quản trị viên OA thấy"
										label="Ẩn trên Zalo"
										onClick={() => props.onPublishTargetChange("hidden")}
									/>
								</div>
							</Field>
						)}

						<ReadinessChecklist items={props.readiness} />

						{live ? (
							<>
								<button
									type="button"
									disabled={props.synced || Boolean(props.busy)}
									onClick={() => props.onPublishAction("live-update")}
									className={`${primaryButton} w-full`}
								>
									{props.busy === "live-update" ? (
										<LoaderCircle size={15} className="animate-spin" />
									) : (
										<RefreshCw size={15} />
									)}
									{props.synced
										? "Bài đang hiển thị là bản mới nhất"
										: "Cập nhật bài đang hiển thị"}
								</button>
								<button
									type="button"
									onClick={() => props.onPublishAction("hide")}
									disabled={Boolean(props.busy)}
									className={dangerTextButton}
								>
									<EyeOff size={14} /> Gỡ bài khỏi Zalo OA
								</button>
							</>
						) : null}

						<div className="border-t border-[var(--border)] pt-3">
							<Field
								hint="Theo giờ trên máy của bạn. Bài sẽ tự hiển thị vào thời điểm này."
								label="Hẹn giờ đăng"
							>
								<input
									type="datetime-local"
									value={props.schedule}
									onChange={(event) => props.onScheduleChange(event.target.value)}
									className={inputClass}
								/>
							</Field>
							<button
								type="button"
								disabled={
									!props.synced ||
									article.reviewStatus !== "approved" ||
									article.publicationStatus !== "hidden" ||
									Boolean(props.busy)
								}
								onClick={props.onSchedulePublish}
								className={`${secondaryButton} mt-2 w-full`}
							>
								<CalendarClock size={15} /> Xác nhận hẹn giờ
							</button>
							{article.publicationStatus === "scheduled" ? (
								<button
									type="button"
									onClick={props.onCancelSchedule}
									disabled={Boolean(props.busy)}
									className={`${dangerTextButton} mt-2`}
								>
									Hủy lịch hiện tại
								</button>
							) : null}
						</div>

						<div className="space-y-2 border-t border-[var(--border)] pt-3">
							{article.remoteArticleId ? (
								<>
									<button
										type="button"
										onClick={props.onRefreshRemote}
										disabled={Boolean(props.busy)}
										className={`${secondaryButton} w-full`}
									>
										<RefreshCw size={14} /> Làm mới trạng thái từ Zalo
									</button>
									<button
										type="button"
										onClick={props.onRemoveRemote}
										disabled={Boolean(props.busy)}
										className={dangerTextButton}
									>
										<Trash2 size={14} /> Xóa bản trên Zalo
									</button>
								</>
							) : (
								<button
									type="button"
									onClick={props.onDelete}
									disabled={Boolean(props.busy)}
									className={dangerTextButton}
								>
									<Trash2 size={14} /> Xóa bài viết
								</button>
							)}
						</div>
					</div>
				)}
			</Section>
		</>
	);
}

function TargetButton({
	active,
	description,
	label,
	onClick,
}: {
	active: boolean;
	description: string;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={active}
			onClick={onClick}
			className={`rounded-lg border p-2.5 text-left transition ${
				active
					? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--foreground)]"
					: "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
			}`}
		>
			<span className="block text-[12px] font-bold">{label}</span>
			<span className="mt-0.5 block text-[11px] leading-4 text-[var(--muted)]">
				{description}
			</span>
		</button>
	);
}

function ReadinessChecklist({ items }: { items: ReadinessItem[] }) {
	// Optional items are advice, so they never contribute to the count or hold
	// the article back — otherwise "còn 1 việc" would nag about something that is
	// not actually required.
	const remaining = items.filter((item) => !item.done && !item.optional);
	if (!remaining.length) {
		return (
			<p className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--success-soft)] px-3 py-2 text-[12px] font-bold text-[var(--success-strong)]">
				<Check size={14} /> Bài viết đã sẵn sàng đăng
			</p>
		);
	}

	return (
		<div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
			<p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted-strong)]">
				Còn {remaining.length} việc trước khi đăng
			</p>
			<ul className="mt-2 space-y-1.5">
				{items.map((item) => (
					<li
						key={item.label}
						className={`flex items-start gap-2 text-[12px] font-semibold ${
							item.done ? "text-[var(--success-strong)]" : "text-[var(--muted-strong)]"
						}`}
					>
						<span
							className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full ${
								item.done
									? "bg-[var(--success-soft)] text-[var(--success-strong)]"
									: "border border-[var(--border-strong)] bg-[var(--surface)]"
							}`}
						>
							{item.done ? <Check size={10} /> : null}
						</span>
						<span className="min-w-0">
							{item.label}
							{item.optional ? (
								<span className="ml-1.5 rounded bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--muted)]">
									Không bắt buộc
								</span>
							) : null}
							{item.done ? null : (
								<span className="block text-[11px] font-medium text-[var(--muted)]">
									{item.hint}
								</span>
							)}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}
