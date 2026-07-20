"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowLeft,
	CalendarClock,
	Database,
	ExternalLink,
	FileSearch,
	Gauge,
	MessageSquareText,
	Radar,
	ShieldAlert,
	ShieldCheck,
	Sparkles,
	UserRound,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import { EvidencePanel } from "@/components/dashboard/analysis-widgets";
import { IntentPrefetchLink } from "@/components/dashboard/intent-prefetch-link";
import {
	intelligenceProviderLabel,
} from "@/components/dashboard/intelligence-workspace-shared";
import { PageHeader } from "@/components/dashboard/page-header";
import type {
	EvidenceTriageView,
	TimelinePost,
} from "@/components/dashboard/types";
import {
	Panel,
	PanelHeader,
	RiskPill,
} from "@/components/dashboard/ui-primitives";
import { evidenceDetailQueryOptions } from "@/lib/dashboard/client-queries";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";

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
	const evidence = evidenceQuery.data;

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
					<PanelHeader title="Nội dung bài viết" action={<RiskPill risk={evidence.riskLevel} />} />
					<div className="space-y-5 p-5">
						<p className="whitespace-pre-wrap rounded-lg bg-[var(--surface-soft)] p-5 text-[15px] font-semibold leading-7 text-[var(--foreground)]">
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
								<Sparkles size={14} /> {evidence.pageClassification === "trusted" ? "Soạn bài tích cực" : evidence.pageClassification === "at_risk" ? "Soạn phản biện" : "Soạn phản hồi"}
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

			<EvidencePanel
				enableInfinite
				evidence={[]}
				limit={8}
				scanId={evidence.scanId}
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

function Metric({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
	return <Panel><div className="flex min-h-24 items-start gap-3 p-4"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Icon size={17} /></span><div className="min-w-0"><p className={eyebrowClass}>{label}</p><p className="mt-2 truncate text-sm font-extrabold text-[var(--foreground)]">{value}</p></div></div></Panel>;
}

function Detail({ label, mono = false, value }: { label: string; mono?: boolean; value: string }) {
	return <><dt className="font-bold text-[var(--muted)]">{label}</dt><dd className={`min-w-0 break-words font-semibold text-[var(--foreground)] ${mono ? "font-mono text-[11px]" : ""}`}>{value}</dd></>;
}

function PageTrustBadge({ classification }: { classification: TimelinePost["pageClassification"] }) {
	if (classification === "uncategorized") return null;
	const Icon = classification === "trusted" ? ShieldCheck : ShieldAlert;
	return <span className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-extrabold ${classification === "trusted" ? "bg-[var(--success-soft)] text-[var(--success-strong)]" : "bg-[var(--danger-soft)] text-[var(--danger-strong)]"}`}><Icon size={13} />{pageClassificationLabel(classification)}</span>;
}

function pageClassificationLabel(classification: TimelinePost["pageClassification"]) {
	return classification === "trusted" ? "Đáng tin cậy" : classification === "at_risk" ? "Có rủi ro" : "Chưa phân loại";
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
