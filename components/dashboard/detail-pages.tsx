import {
	ArrowLeft,
	Clock3,
	History,
	MessageSquareText,
	Radar,
	Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";

import { EvidencePanel, TopicPanel } from "@/components/dashboard/analysis-widgets";
import {
	DraftReview,
	SourceDetail,
} from "@/components/dashboard/counter-argument-widgets";
import type { DashboardPageProps } from "@/components/dashboard/dashboard-pages";
import { IntentPrefetchLink } from "@/components/dashboard/intent-prefetch-link";
import type { DraftShape } from "@/components/dashboard/types";
import { AnalysisSummary, PageHeader } from "@/components/dashboard/page-widgets";
import {
	Panel,
	PanelHeader,
	RiskPill,
	SecondaryButton,
	StatusPill,
} from "@/components/dashboard/ui-primitives";

export function ScanDetailsPage(
	props: DashboardPageProps & { scanId?: string },
) {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={Radar}
				title="Chi tiết scan"
				description={
					props.selectedScan?.title ??
					props.detail?.source?.title ??
					props.scanId ??
					"Scan đang được tải"
				}
				actions={
					<>
						<BackLink href="/sources" label="Hàng đợi" />
						<SecondaryButton onClick={props.onOpenDraft}>
							<Sparkles size={14} /> Tạo phản hồi
						</SecondaryButton>
					</>
				}
			/>
			<ScanStatusStrip {...props} />
			<div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
				<div className="space-y-5">
					<SourceDetail
						selectedScan={props.selectedScan}
						detail={props.detail}
						analysis={props.analysis}
					/>
					<ProviderRunPanel detail={props.detail} />
					<AuditTimeline detail={props.detail} />
				</div>
				<div className="space-y-5">
					<AnalysisSummary analysis={props.analysis} />
					<TopicPanel evidence={props.evidence} topics={props.topics} />
					<DraftReview
						key={props.draft?.id ?? "scan-draft-empty"}
						draft={props.draft}
						onReview={props.onReview}
						onRewrite={props.onRewriteDraft}
						onSave={props.onSaveDraft}
						scanId={props.selectedScanId}
					/>
				</div>
			</div>
			<EvidencePanel
				enableInfinite
				evidence={props.evidence}
				limit={8}
				scanId={props.selectedScanId}
			/>
		</div>
	);
}

export function DraftDetailsPage(props: DashboardPageProps & { draftId?: string }) {
	const draft =
		props.detail?.drafts?.find((item) => item.id === props.draftId) ?? props.draft;
	const draftShape = toDraftShape(draft, props.draft);

	return (
		<div className="space-y-5">
			<PageHeader
				icon={MessageSquareText}
				title="Chi tiết bản nháp"
				description="Bản nháp phản hồi nội bộ, chỉ xuất sau khi người vận hành duyệt."
				actions={
					<>
						<BackLink href="/counter-arguments" label="Lập luận" />
						<BackLink href={`/scans/${props.selectedScanId}`} label="Scan liên quan" />
					</>
				}
			/>
			<div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
				<DraftReview
					key={draftShape?.id ?? "draft-detail-empty"}
					draft={draftShape}
					onReview={props.onReview}
					onRewrite={props.onRewriteDraft}
					onSave={props.onSaveDraft}
					scanId={props.selectedScanId}
				/>
				<DraftMetaPanel draft={draftShape} />
			</div>
			<EvidencePanel evidence={props.evidence} limit={8} scanId={props.selectedScanId} />
		</div>
	);
}

function toDraftShape(
	draft: Partial<DraftShape> | null | undefined,
	fallback: DraftShape | null,
): DraftShape | null {
	const matchingFallback = fallback?.id === draft?.id ? fallback : null;
	const id = draft?.id ?? fallback?.id;
	const body = matchingFallback?.body ?? draft?.body ?? fallback?.body;
	if (!id || !body) return null;
	if (draft) return { ...draft, ...matchingFallback, id, body };
	return { ...fallback, id, body };
}

function ScanStatusStrip(props: DashboardPageProps) {
	return (
		<div className="grid gap-3 md:grid-cols-4">
			<MiniMetric label="Trạng thái" value={<StatusPill status={props.selectedScan?.status ?? "queued"} />} />
			<MiniMetric label="Provider" value={providerLabel(props.selectedScan?.provider ?? "none")} />
			<MiniMetric label="Mức rủi ro" value={<RiskPill risk={props.analysis.riskLevel} />} />
			<MiniMetric label="Bằng chứng" value={props.evidence.length.toLocaleString("vi-VN")} />
		</div>
	);
}

function ProviderRunPanel({ detail }: Pick<DashboardPageProps, "detail">) {
	const runs = detail?.providerRuns?.length ? detail.providerRuns : [];

	return (
		<Panel>
			<PanelHeader title="Provider runs" description="Lịch sử adapter đã chạy cho scan." />
			<div className="divide-y divide-[var(--divider)] p-4">
				{runs.length ? (
					runs.map((run, index) => (
						<div key={String(run.id ?? index)} className="py-3">
							<p className="text-[13px] font-bold text-[var(--foreground)]">
								{String(run.provider ?? "Provider")}
							</p>
							<p className="mt-1 text-[12px] text-[var(--muted)]">
								{String(run.status ?? "completed")} - {formatTime(run.startedAt)}
							</p>
						</div>
					))
				) : (
					<p className="text-[13px] leading-6 text-[var(--muted)]">
						Chưa có provider run chi tiết trong dữ liệu hiện tại.
					</p>
				)}
			</div>
		</Panel>
	);
}

function AuditTimeline({ detail }: Pick<DashboardPageProps, "detail">) {
	const events = detail?.audit ?? [];

	return (
		<Panel>
			<PanelHeader title="Nhật ký scan" />
			<div className="divide-y divide-[var(--divider)] p-4">
				{events.length ? (
					events.map((event) => (
						<div key={event.id ?? event.action} className="flex gap-3 py-3">
							<Clock3 className="mt-0.5 shrink-0 text-[var(--muted)]" size={15} />
							<div className="min-w-0">
								<p className="text-[13px] font-bold text-[var(--foreground)]">
									{event.action ?? "activity"}
								</p>
								<p className="mt-1 text-[11px] text-[var(--muted)]">
									{formatTime(event.createdAt)}
								</p>
							</div>
						</div>
					))
				) : (
					<p className="py-3 text-[12px] font-semibold text-[var(--muted)]">
						Chưa có nhật ký scan.
					</p>
				)}
			</div>
		</Panel>
	);
}

function DraftMetaPanel({ draft }: { draft: DashboardPageProps["draft"] }) {
	return (
		<Panel>
			<PanelHeader title="Thuộc tính bản nháp" />
			<div className="space-y-4 p-4">
				<DetailGrid
					rows={[
						["Draft ID", draft?.id ?? "Chưa có"],
						["Giọng điệu", draft?.tone ?? "Chưa đặt"],
						["Giọng văn", draft?.voice ?? "Chưa đặt"],
						["Audience", draft?.audience ?? "Chưa đặt"],
						["Language", draft?.language ?? "vi"],
						["Length", draft?.length ?? "medium"],
						["Created", formatTime(draft?.createdAt)],
					]}
				/>
				<p className="flex items-center gap-2 text-[11px] font-semibold text-[var(--muted)]">
					<History size={13} /> Không tự động đăng hoặc xuất bản nội dung.
				</p>
			</div>
		</Panel>
	);
}

function MiniMetric({ label, value }: { label: string; value: ReactNode }) {
	return (
		<Panel>
			<div className="p-4">
				<p className="text-[11px] font-bold uppercase text-[var(--muted)]">
					{label}
				</p>
				<div className="mt-2 text-[16px] font-bold text-[var(--foreground)]">
					{value}
				</div>
			</div>
		</Panel>
	);
}

function DetailGrid({ rows }: { rows: Array<[string, ReactNode]> }) {
	return (
		<div className="grid gap-3 text-[13px] sm:grid-cols-[120px_minmax(0,1fr)]">
			{rows.map(([label, value]) => (
				<div key={label} className="contents">
					<span className="font-semibold text-[var(--muted)]">{label}</span>
					<span className="min-w-0 break-words text-[var(--foreground)]">
						{value}
					</span>
				</div>
			))}
		</div>
	);
}

function BackLink({ href, label }: { href: string; label: string }) {
	return (
		<IntentPrefetchLink
			href={href}
			className="inline-flex h-10 max-w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition whitespace-nowrap hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
		>
			<ArrowLeft size={14} /> {label}
		</IntentPrefetchLink>
	);
}

function providerLabel(provider: string) {
	if (provider.startsWith("apify")) return "Apify";
	if (provider.startsWith("firecrawl")) return "Firecrawl";
	if (provider === "browser_use") return "Browser Use";
	if (provider === "local_text") return "Local Text";
	return provider;
}

function formatTime(value?: unknown) {
	if (!value) return "Chưa có thời gian";
	return new Intl.DateTimeFormat("vi-VN", {
		hour: "2-digit",
		minute: "2-digit",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(new Date(String(value)));
}
