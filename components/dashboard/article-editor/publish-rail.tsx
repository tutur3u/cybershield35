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
	Radio,
	RefreshCw,
	Send,
	Trash2,
} from "lucide-react";

import { ExportActions } from "@/components/dashboard/export-actions";
import type { ArticleContent } from "@/lib/articles/schemas";

import {
	articlePlainText,
	dangerTextButton,
	Field,
	inputClass,
	jobStatusLabel,
	operationLabel,
	primaryButton,
	Section,
	secondaryButton,
} from "./shared";
import type { ArticleDetail, ReadinessItem } from "./types";
import { ZaloDashboardHandoff, ZaloPreview } from "./zalo-preview";

export type PublishRailProps = {
	accounts:
		| { accounts: Array<{ displayName: string; id: string; oaId: string }>; enabled: boolean }
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
	onTargetOaChange: (value: string) => void;
	readiness: ReadinessItem[];
	schedule: string;
	synced: boolean;
	targetOaConnectionId: string;
};

export function PublishRail(props: PublishRailProps) {
	const { article } = props.detail;
	const canSync = props.readiness.every((item) => item.done);

	return (
		<aside className="min-w-0 space-y-4 xl:sticky xl:top-[8.5rem]">
			<Section icon={Eye} title="Xem trước Zalo">
				<ZaloPreview
					content={props.draft}
					onCoverUnavailable={props.onCoverUnavailable}
				/>
			</Section>

			<Section icon={Radio} title="Đồng bộ & xuất bản">
				{article.originDraftId ? (
					<div className="mb-3 flex items-start gap-2 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] p-3">
						<Bot size={15} className="mt-0.5 shrink-0 text-[var(--accent-strong)]" />
						<p className="text-[11px] leading-4 text-[var(--muted-strong)]">
							Bài được chuẩn bị tự động từ nội dung đã quét. Hệ thống chỉ đồng bộ ở trạng
							thái ẩn; xuất bản công khai luôn cần phê duyệt và xác nhận tại đây.
						</p>
					</div>
				) : null}

				{article.remoteArticleId ? (
					<ZaloDashboardHandoff
						oaDisplayName={props.detail.oaDisplayName}
						oaId={props.detail.oaId}
						publicationStatus={article.publicationStatus}
						remoteArticleId={article.remoteArticleId}
						synced={props.synced}
					/>
				) : null}

				{!props.accounts?.enabled ? (
					<div
						className={`${
							article.remoteArticleId ? "mt-3 " : ""
						}rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3 text-[11px] leading-5 text-[var(--warning-strong)]`}
					>
						Kết nối Zalo OA đang tắt. Liên hệ quản trị viên workspace để bật tính năng
						xuất bản.
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
						{props.accounts.accounts.length > 1 ? (
							<Field label="Tài khoản OA đích">
								<select
									value={props.targetOaConnectionId}
									onChange={(event) => props.onTargetOaChange(event.target.value)}
									className={inputClass}
								>
									<option value="">Chưa chọn</option>
									{props.accounts.accounts.map((account) => (
										<option key={account.id} value={account.id}>
											{account.displayName} · OA {account.oaId}
										</option>
									))}
								</select>
							</Field>
						) : null}

						<ReadinessChecklist items={props.readiness} />

						<button
							type="button"
							disabled={!canSync || Boolean(props.busy)}
							onClick={() => props.onPublishAction("sync")}
							className={`${primaryButton} w-full`}
						>
							{props.busy === "sync" ? (
								<LoaderCircle size={15} className="animate-spin" />
							) : (
								<RefreshCw size={15} />
							)}
							{article.remoteArticleId
								? "Cập nhật bản ẩn trên Zalo"
								: "Tạo bản ẩn trên Zalo"}
						</button>
						<p className="text-[11px] leading-4 text-[var(--muted)]">
							Bước này chỉ tạo hoặc cập nhật bản ẩn. Bài chưa hiển thị công khai.
						</p>

						{article.remoteArticleId ? null : (
							<ZaloDashboardHandoff
								oaDisplayName={props.detail.oaDisplayName}
								oaId={props.detail.oaId}
								publicationStatus={article.publicationStatus}
								remoteArticleId={article.remoteArticleId}
								synced={props.synced}
							/>
						)}

						{article.publicationStatus === "published" && !props.synced ? (
							<button
								type="button"
								disabled={Boolean(props.busy)}
								onClick={() => props.onPublishAction("live-update")}
								className={`${primaryButton} w-full`}
							>
								<Send size={15} /> Cập nhật bài đang hiển thị
							</button>
						) : (
							<button
								type="button"
								disabled={
									!props.synced ||
									article.reviewStatus !== "approved" ||
									!["hidden", "scheduled"].includes(article.publicationStatus) ||
									Boolean(props.busy)
								}
								onClick={() => props.onPublishAction("publish")}
								className={`${primaryButton} w-full`}
							>
								<Send size={15} /> Xuất bản công khai
							</button>
						)}

						<div className="border-t border-[var(--border)] pt-3">
							<Field hint="Theo giờ trên máy của bạn." label="Lên lịch xuất bản">
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
								<CalendarClock size={15} /> Xác nhận lịch xuất bản
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
							{article.publicationStatus === "published" ? (
								<button
									type="button"
									onClick={() => props.onPublishAction("hide")}
									disabled={Boolean(props.busy)}
									className={`${dangerTextButton} mt-2`}
								>
									<EyeOff size={14} /> Ẩn bài khỏi Zalo
								</button>
							) : null}
							{article.remoteArticleId ? (
								<div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
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
								</div>
							) : (
								<button
									type="button"
									onClick={props.onDelete}
									disabled={Boolean(props.busy)}
									className={`${dangerTextButton} mt-3`}
								>
									<Trash2 size={14} /> Xóa bài viết
								</button>
							)}
						</div>
					</div>
				)}
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
					<p className="text-[12px] text-[var(--muted)]">Chưa có thao tác đồng bộ nào.</p>
				)}
			</Section>

			<Section icon={ExternalLink} title="Xuất & tải xuống">
				<ExportActions
					compact
					content={articlePlainText(props.draft)}
					fileName={props.draft.title || "bai-viet-cybershield35"}
					title={props.draft.title || "Bài viết CyberShield35"}
				/>
			</Section>
		</aside>
	);
}

function ReadinessChecklist({ items }: { items: ReadinessItem[] }) {
	const remaining = items.filter((item) => !item.done).length;
	return (
		<div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
			<p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted-strong)]">
				{remaining ? `Còn ${remaining} việc trước khi đồng bộ` : "Đã đủ điều kiện đồng bộ"}
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
