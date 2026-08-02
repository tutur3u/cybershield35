"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowLeft,
	BrainCircuit,
	CalendarClock,
	Database,
	ExternalLink,
	FileSearch,
	Gauge,
	MessageSquareText,
	Radar,
	RefreshCw,
	Scale,
	ShieldAlert,
	ShieldCheck,
	Sparkles,
	UserRound,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import { IntentPrefetchLink } from "@/components/dashboard/intent-prefetch-link";
import {
	intelligenceProviderLabel,
} from "@/components/dashboard/intelligence-workspace-shared";
import { PageHeader } from "@/components/dashboard/page-header";
import type {
	EvidenceSemanticRebuildResult,
	EvidenceTriageView,
	RelatedEvidenceItem,
	TimelinePost,
} from "@/components/dashboard/types";
import {
	Panel,
	PanelHeader,
	RiskPill,
} from "@/components/dashboard/ui-primitives";
import {
	evidenceDetailQueryOptions,
	relatedEvidenceQueryOptions,
} from "@/lib/dashboard/client-queries";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";
import { assessEvidenceRisk } from "@/lib/domain/evidence-risk";

const EvidenceTriageSheet = dynamic(
	() => import("@/components/dashboard/evidence-triage-sheet"),
	{ loading: () => null, ssr: false },
);
const EvidenceDraftSheet = dynamic(
	() => import("@/components/dashboard/evidence-draft-sheet"),
	{ loading: () => null, ssr: false },
);

const triageLabels: Record<EvidenceTriageView["status"], string> = {
	action_required: "Cần hành động",
	dismissed: "Bỏ qua",
	new: "Mới",
	reviewing: "Đang xem xét",
	resolved: "Đã giải quyết",
};

export function EvidenceDetailsPage({ evidenceId }: { evidenceId?: string }) {
	const queryClient = useQueryClient();
	const [triageOpen, setTriageOpen] = useState(false);
	const [draftOpen, setDraftOpen] = useState(false);
	const evidenceQuery = useQuery(evidenceDetailQueryOptions(evidenceId ?? ""));
	const relatedQuery = useQuery(relatedEvidenceQueryOptions(evidenceId ?? ""));
	const rebuildMutation = useMutation({
		mutationFn: rebuildSemanticProfiles,
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: dashboardQueryKeys.relatedEvidence(evidenceId ?? ""),
			});
		},
	});
	const evidence = evidenceQuery.data;
	const assessment = evidence
		? assessEvidenceRisk({
				comments: evidence.engagement.comments,
				shares: evidence.engagement.shares,
				sourceClassification: evidence.pageClassification,
				storedRisk: evidence.riskLevel,
				text: evidence.quote,
			})
		: null;

	function optimisticUpdate(
		patch: Partial<
			Pick<
				EvidenceTriageView,
				"assigneeUserId" | "dueAt" | "isPinned" | "status"
			>
		>,
	) {
		if (!evidenceId) return () => undefined;
		const key = dashboardQueryKeys.evidenceDetail(evidenceId);
		const previous = queryClient.getQueryData<TimelinePost>(key);
		queryClient.setQueryData<TimelinePost>(key, (current) =>
			current
				? {
						...current,
						triage: {
							...current.triage,
							...patch,
							updatedAt: new Date().toISOString(),
						},
					}
				: current,
		);
		return () => queryClient.setQueryData(key, previous);
	}

	if (evidenceQuery.isPending) return <EvidenceDetailLoading />;
	if (evidenceQuery.isError || !evidence) {
		return (
			<Panel>
				<div className="p-10 text-center">
					<FileSearch className="mx-auto text-[var(--danger-strong)]" />
					<h1 className="mt-3 text-base font-extrabold text-[var(--foreground)]">
						Không thể tải đúng bằng chứng
					</h1>
					<p className="mt-2 text-sm text-[var(--muted)]">
						{evidenceQuery.error?.message ?? "Bằng chứng không tồn tại."}
					</p>
					<button
						type="button"
						onClick={() => void evidenceQuery.refetch()}
						className="mt-4 inline-flex h-10 items-center rounded-md border border-[var(--border)] px-4 text-xs font-bold text-[var(--muted-strong)] hover:bg-[var(--surface-soft)]"
					>
						Thử lại
					</button>
				</div>
			</Panel>
		);
	}

	return (
		<div className="space-y-5" data-evidence-id={evidence.id}>
			<PageHeader
				icon={Database}
				title="Chi tiết bằng chứng"
				description={`${evidence.sourceLabel ?? "Nguồn công khai"} · ${formatPublished(evidence.publishedAt ?? evidence.createdAt)}`}
				actions={
					<>
						<IntentPrefetchLink href="/evidence" className={actionClass}>
							<ArrowLeft size={14} /> Dòng thời gian
						</IntentPrefetchLink>
						<IntentPrefetchLink href={evidence.scanHref} className={actionClass}>
							<Radar size={14} /> Scan liên quan
						</IntentPrefetchLink>
					</>
				}
			/>

			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<Metric icon={Gauge} label="Tương tác" value={evidence.engagement.total.toLocaleString("vi-VN")} />
				<Metric icon={MessageSquareText} label="Xử lý" value={triageLabels[evidence.triage.status]} />
				<Metric icon={UserRound} label="Phân công" value={evidence.triage.assigneeDisplayName ?? "Chưa phân công"} />
				<Metric icon={CalendarClock} label="Hạn xử lý" value={evidence.triage.dueAt ? formatPublished(evidence.triage.dueAt) : "Chưa đặt hạn"} />
			</div>

			<div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
				<Panel>
					<PanelHeader
						title="Nội dung bài viết"
						description="Mức ưu tiên kết hợp tín hiệu trong nội dung, độ lan truyền và phân loại trang nguồn."
						action={
							<RiskPill
								labelPrefix="Ưu tiên"
								reasons={assessment?.reasons}
								risk={assessment?.level ?? evidence.riskLevel}
							/>
						}
					/>
					<div className="space-y-5 p-5">
						{evidence.originalImageUrl ? (
							<figure className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-soft)]">
								{/* Facebook CDN URLs are discovered at runtime and cannot use a static Next image host allowlist. */}
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img
									alt="Hình ảnh từ bài viết Facebook gốc"
									className="max-h-[520px] w-full object-contain"
									loading="lazy"
									referrerPolicy="no-referrer"
									src={evidence.originalImageUrl}
								/>
								<figcaption className="border-t border-[var(--border)] px-3 py-2 text-[10px] font-semibold text-[var(--muted)]">
									Hình ảnh gốc được giữ lại từ dữ liệu scan để người duyệt đối chiếu.
								</figcaption>
							</figure>
						) : null}
						<p className="text-justify whitespace-pre-wrap rounded-lg bg-[var(--surface-soft)] p-5 text-[15px] font-semibold leading-7 text-[var(--foreground)]">
							{evidence.quote}
						</p>
						{evidence.summary && evidence.summary !== evidence.quote ? (
							<div>
								<p className={eyebrowClass}>Tóm tắt chuẩn hóa</p>
								<p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">{evidence.summary}</p>
							</div>
						) : null}
						<div className="flex flex-wrap gap-2">
							{evidence.topicSlugs.map((slug) => (
								<IntentPrefetchLink key={slug} href={`/topics/${slug}`} className="rounded-md bg-[var(--accent-soft)] px-2.5 py-1.5 text-xs font-bold text-[var(--accent-strong)]">
									#{slug}
								</IntentPrefetchLink>
							))}
						</div>
					</div>
				</Panel>

				<div className="space-y-5">
					<Panel>
						<PanelHeader title="Ngữ cảnh & nguồn" action={<PageTrustBadge classification={evidence.pageClassification} />} />
						<dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-4 p-4 text-xs">
							<Detail label="Evidence ID" value={evidence.id} mono />
							<Detail label="Tác giả" value={evidence.author ?? "Không rõ"} />
							<Detail label="Provider" value={intelligenceProviderLabel(evidence.provider)} />
							<Detail label="Cảm xúc" value={sentimentLabel(evidence.sentiment)} />
							<Detail label="Lập trường" value={stanceLabel(evidence.stance)} />
							<Detail label="Phân loại trang" value={pageClassificationLabel(evidence.pageClassification)} />
							<Detail label="Tương tác" value={`${evidence.engagement.reactions} phản ứng · ${evidence.engagement.comments} bình luận · ${evidence.engagement.shares} chia sẻ`} />
						</dl>
						<div className="grid gap-2 border-t border-[var(--border)] p-4 sm:grid-cols-2 xl:grid-cols-1">
							<button type="button" onClick={() => setDraftOpen(true)} className={primaryActionClass}>
								<Sparkles size={14} /> {evidence.pageClassification === "trusted" ? "Soạn bài ủng hộ" : evidence.pageClassification === "at_risk" ? "Soạn bài phản bác" : evidence.pageClassification === "neutral" ? "Soạn bài trung lập" : "Chọn mục đích bài viết"}
							</button>
							<button type="button" onClick={() => setTriageOpen(true)} className={primaryActionClass}>
								<MessageSquareText size={14} /> Mở bảng xử lý
							</button>
							{evidence.originalPostHref ? (
								<a href={evidence.originalPostHref} target="_blank" rel="noreferrer" className={actionClass}>
									<ExternalLink size={14} /> Mở bài viết gốc
								</a>
							) : null}
						</div>
					</Panel>
				</div>
			</div>

			<RelatedEvidencePanel
				error={relatedQuery.error}
				generatedAt={relatedQuery.data?.generatedAt ?? null}
				items={relatedQuery.data?.items ?? []}
				model={relatedQuery.data?.model ?? null}
				onRebuild={() => {
					if (
						window.confirm(
							"Xếp hạng lại toàn bộ bằng chứng bằng Gemini Embedding 2? Quá trình có thể mất vài phút.",
						)
					) {
						rebuildMutation.mutate();
					}
				}}
				onRetry={() => void relatedQuery.refetch()}
				pending={relatedQuery.isPending}
				profileReady={relatedQuery.data?.profileReady ?? false}
				rebuildError={rebuildMutation.error}
				rebuildPending={rebuildMutation.isPending}
				rebuildResult={rebuildMutation.data}
			/>

			{triageOpen ? (
				<EvidenceTriageSheet
					onOpenChange={setTriageOpen}
					onOptimisticUpdate={optimisticUpdate}
					open
					post={evidence}
				/>
			) : null}
			{draftOpen ? <EvidenceDraftSheet open post={evidence} onOpenChange={setDraftOpen} /> : null}
		</div>
	);
}

function RelatedEvidencePanel({
	error,
	generatedAt,
	items,
	model,
	onRebuild,
	onRetry,
	pending,
	profileReady,
	rebuildError,
	rebuildPending,
	rebuildResult,
}: {
	error: Error | null;
	generatedAt: string | null;
	items: RelatedEvidenceItem[];
	model: string | null;
	onRebuild: () => void;
	onRetry: () => void;
	pending: boolean;
	profileReady: boolean;
	rebuildError: Error | null;
	rebuildPending: boolean;
	rebuildResult?: EvidenceSemanticRebuildResult;
}) {
	return (
		<Panel>
			<PanelHeader
				title={`Bằng chứng liên quan${items.length ? ` (${items.length})` : ""}`}
				description="So khớp theo sự kiện và ý nghĩa trên toàn bộ kho dữ liệu; kết quả yếu hoặc trùng lặp được ẩn."
				action={
					<button
						type="button"
						disabled={rebuildPending}
						onClick={onRebuild}
						className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[11px] font-bold text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)] disabled:cursor-wait disabled:opacity-60"
					>
						<RefreshCw
							className={rebuildPending ? "animate-spin" : ""}
							size={13}
						/>
						{rebuildPending ? "Đang xếp hạng…" : "Xếp hạng lại toàn bộ"}
					</button>
				}
			/>
			<div className="border-b border-[var(--divider)] px-4 py-3 text-[11px] leading-5 text-[var(--muted)]">
				<span className="inline-flex items-center gap-1.5 font-bold text-[var(--muted-strong)]">
					<BrainCircuit size={13} /> Gemini Embedding 2
				</span>
				<span className="mx-2">·</span>
				{generatedAt
					? `Cập nhật ${formatPublished(generatedAt)}`
					: "Chưa có hồ sơ ngữ nghĩa"}
				{model ? <span className="sr-only">Mô hình {model}</span> : null}
			</div>
			{rebuildResult ? (
				<p
					className="border-b border-[var(--divider)] bg-[var(--success-soft)] px-4 py-2 text-xs font-semibold text-[var(--success-strong)]"
					role="status"
				>
					Đã cập nhật {rebuildResult.generated.toLocaleString("vi-VN")}/
					{rebuildResult.total.toLocaleString("vi-VN")} bằng chứng
					{rebuildResult.failed ? ` · ${rebuildResult.failed} lỗi` : ""}.
				</p>
			) : null}
			{rebuildError ? (
				<p
					className="border-b border-[var(--divider)] bg-[var(--danger-soft)] px-4 py-2 text-xs font-semibold text-[var(--danger-strong)]"
					role="alert"
				>
					{rebuildError.message}
				</p>
			) : null}
			<div className="divide-y divide-[var(--divider)] px-4">
				{pending ? (
					<p className="py-8 text-center text-sm text-[var(--muted)]">
						Đang tìm mối liên hệ có ý nghĩa…
					</p>
				) : error ? (
					<div className="py-8 text-center">
						<p className="text-sm text-[var(--danger-strong)]">
							Không thể tải bằng chứng liên quan.
						</p>
						<button
							type="button"
							onClick={onRetry}
							className="mt-3 text-xs font-bold text-[var(--accent-strong)]"
						>
							Thử lại
						</button>
					</div>
				) : items.length ? (
					items.map((item) => <RelatedEvidenceRow item={item} key={item.id} />)
				) : (
					<div className="py-9 text-center">
						<p className="text-sm font-bold text-[var(--foreground)]">
							{profileReady
								? "Không có bằng chứng đủ liên quan"
								: "Cần xếp hạng kho bằng chứng"}
						</p>
						<p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-[var(--muted)]">
							{profileReady
								? "Hệ thống chủ động ẩn kết quả có độ tương đồng thấp thay vì lấp đầy danh sách bằng nội dung không phù hợp."
								: "Chạy xếp hạng để tạo liên kết ngữ nghĩa cho mọi bằng chứng hiện có."}
						</p>
					</div>
				)}
			</div>
		</Panel>
	);
}

function RelatedEvidenceRow({ item }: { item: RelatedEvidenceItem }) {
	return (
		<IntentPrefetchLink
			href={`/evidence/${item.id}`}
			className="grid gap-3 py-4 transition hover:bg-[var(--surface-soft)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
		>
			<div className="min-w-0">
				<p className="line-clamp-2 text-[13px] font-semibold leading-6 text-[var(--foreground)]">
					{item.quote}
				</p>
				<p className="mt-1 truncate text-[11px] text-[var(--muted)]">
					{item.sourceLabel ?? item.author ?? "Nguồn công khai"} ·{" "}
					{formatPublished(item.publishedAt ?? item.createdAt)}
				</p>
			</div>
			<div className="flex flex-wrap items-center gap-2 sm:justify-end">
				{item.sharedTopics[0] ? (
					<span className="rounded-md bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-bold text-[var(--accent-strong)]">
						#{item.sharedTopics[0]}
					</span>
				) : null}
				<span className="rounded-md bg-[var(--success-soft)] px-2 py-1 text-[10px] font-extrabold text-[var(--success-strong)]">
					{Math.round(item.relevance * 100)}% phù hợp
				</span>
			</div>
		</IntentPrefetchLink>
	);
}

async function rebuildSemanticProfiles(): Promise<EvidenceSemanticRebuildResult> {
	const response = await fetch("/api/evidence/semantic/rebuild", {
		body: JSON.stringify({ force: true }),
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	const body = await response.json().catch(() => null);
	if (!response.ok) {
		throw new Error(
			body && typeof body === "object" && "error" in body
				? typeof body.error === "string"
					? body.error
					: "Không thể xếp hạng lại bằng chứng."
				: "Không thể xếp hạng lại bằng chứng.",
		);
	}
	return body as EvidenceSemanticRebuildResult;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
	return <Panel><div className="flex min-h-24 items-start gap-3 p-4"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Icon size={17} /></span><div className="min-w-0"><p className={eyebrowClass}>{label}</p><p className="mt-2 truncate text-sm font-extrabold text-[var(--foreground)]">{value}</p></div></div></Panel>;
}

function Detail({ label, mono = false, value }: { label: string; mono?: boolean; value: string }) {
	return <><dt className="font-bold text-[var(--muted)]">{label}</dt><dd className={`min-w-0 break-words font-semibold text-[var(--foreground)] ${mono ? "font-mono text-[11px]" : ""}`}>{value}</dd></>;
}

function PageTrustBadge({ classification }: { classification: TimelinePost["pageClassification"] }) {
	if (classification === "uncategorized") return null;
	const Icon = classification === "trusted" ? ShieldCheck : classification === "at_risk" ? ShieldAlert : Scale;
	return <span className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-extrabold ${classification === "trusted" ? "bg-[var(--success-soft)] text-[var(--success-strong)]" : classification === "at_risk" ? "bg-[var(--danger-soft)] text-[var(--danger-strong)]" : "bg-[var(--accent-soft)] text-[var(--accent-strong)]"}`}><Icon size={13} />{pageClassificationLabel(classification)}</span>;
}

function pageClassificationLabel(classification: TimelinePost["pageClassification"]) {
	return classification === "trusted" ? "Đáng tin cậy" : classification === "at_risk" ? "Có rủi ro" : classification === "neutral" ? "Trung lập" : "Chưa phân loại";
}

function EvidenceDetailLoading() {
	return <div className="space-y-5" aria-label="Đang tải chi tiết bằng chứng"><div className="h-28 animate-pulse rounded-lg bg-[var(--surface)]" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-lg bg-[var(--surface)]" />)}</div><div className="h-96 animate-pulse rounded-lg bg-[var(--surface)]" /></div>;
}

function formatPublished(value: string) {
	return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}

function sentimentLabel(value: string) { return ({ positive: "Tích cực", negative: "Tiêu cực", neutral: "Trung tính" } as Record<string, string>)[value] ?? value; }
function stanceLabel(value: string) { return ({ supportive: "Ủng hộ", opposed: "Phản đối", neutral: "Trung lập" } as Record<string, string>)[value] ?? value; }

const eyebrowClass = "text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]";
const actionClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--muted-strong)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]";
const primaryActionClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-3 text-xs font-extrabold text-white transition hover:brightness-110";
