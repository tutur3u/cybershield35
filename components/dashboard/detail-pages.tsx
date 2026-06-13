import {
	ArrowLeft,
	Clock3,
	Database,
	History,
	MessageSquareText,
	Radar,
	Sparkles,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { EvidencePanel, TopicPanel } from "@/components/dashboard/analysis-widgets";
import {
	DraftReview,
	SourceDetail,
} from "@/components/dashboard/counter-argument-widgets";
import type { DashboardPageProps } from "@/components/dashboard/dashboard-pages";
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
				<SourceDetail
					selectedScan={props.selectedScan}
					detail={props.detail}
					analysis={props.analysis}
				/>
				<AnalysisSummary analysis={props.analysis} />
				<ProviderRunPanel detail={props.detail} />
				<TopicPanel topics={props.topics} />
				<div className="xl:col-span-2">
					<EvidencePanel evidence={props.evidence} limit={8} scanId={props.selectedScanId} />
				</div>
				<DraftReview
					draft={props.draft}
					onReview={props.onReview}
					scanId={props.selectedScanId}
				/>
				<AuditTimeline detail={props.detail} createdAt={props.selectedScan?.createdAt} />
			</div>
		</div>
	);
}

export function EvidenceDetailsPage(
	props: DashboardPageProps & { evidenceId?: string },
) {
	const evidence =
		props.evidence.find((item) => item.id === props.evidenceId) ?? props.evidence[0];

	return (
		<div className="space-y-5">
			<PageHeader
				icon={Database}
				title="Chi tiết bằng chứng"
				description={evidence?.sourceLabel ?? "Nguồn công khai đã chuẩn hóa"}
				actions={
					<>
						<BackLink href="/evidence" label="Kho bằng chứng" />
						<BackLink href={`/scans/${props.selectedScanId}`} label="Scan liên quan" />
					</>
				}
			/>
			<div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
				<Panel>
					<PanelHeader
						title="Trích dẫn"
						action={<RiskPill risk={evidence?.riskLevel ?? "medium"} />}
					/>
					<div className="space-y-4 p-4">
						<p className="rounded-lg bg-slate-50 p-4 text-[15px] leading-7 text-slate-800">
							"{evidence?.quote ?? "Không tìm thấy trích dẫn."}"
						</p>
						<p className="text-[13px] leading-6 text-slate-600">
							{evidence?.summary ?? "Bằng chứng này chưa có tóm tắt."}
						</p>
						<DetailGrid
							rows={[
								["Nguồn", evidence?.sourceLabel ?? "Nguồn công khai"],
								["Tác giả", evidence?.author ?? "Public"],
								["Lập trường", evidence?.stance ?? "Chưa phân loại"],
								["Cảm xúc", evidence?.sentiment ?? "Chưa phân loại"],
							]}
						/>
						{evidence?.sourceUrl ? (
							<a
								href={evidence.sourceUrl}
								target="_blank"
								rel="noreferrer"
								className="inline-flex h-10 items-center rounded-md border border-[var(--border)] px-3 text-[12px] font-bold text-slate-700"
							>
								Mở nguồn gốc
							</a>
						) : null}
					</div>
				</Panel>
				<EvidenceMetaPanel evidence={evidence} />
			</div>
			<EvidencePanel evidence={props.evidence} limit={5} scanId={props.selectedScanId} />
		</div>
	);
}

export function DraftDetailsPage(props: DashboardPageProps & { draftId?: string }) {
	const draft =
		props.detail?.drafts?.find((item) => item.id === props.draftId) ?? props.draft;
	const draftShape = { ...props.draft, ...draft };

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
					draft={draftShape}
					onReview={props.onReview}
					scanId={props.selectedScanId}
				/>
				<DraftMetaPanel draft={draftShape} />
			</div>
			<EvidencePanel evidence={props.evidence} limit={8} scanId={props.selectedScanId} />
		</div>
	);
}

function ScanStatusStrip(props: DashboardPageProps) {
	return (
		<div className="grid gap-3 md:grid-cols-4">
			<MiniMetric label="Trạng thái" value={<StatusPill status={props.selectedScan?.status ?? "queued"} />} />
			<MiniMetric label="Provider" value={providerLabel(props.selectedScan?.provider ?? "demo")} />
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
			<div className="divide-y divide-slate-100 p-4">
				{runs.length ? (
					runs.map((run, index) => (
						<div key={String(run.id ?? index)} className="py-3">
							<p className="text-[13px] font-bold text-slate-800">
								{String(run.provider ?? "Provider")}
							</p>
							<p className="mt-1 text-[12px] text-slate-500">
								{String(run.status ?? "completed")} - {formatTime(run.startedAt)}
							</p>
						</div>
					))
				) : (
					<p className="text-[13px] leading-6 text-slate-500">
						Chưa có provider run chi tiết trong dữ liệu hiện tại.
					</p>
				)}
			</div>
		</Panel>
	);
}

function AuditTimeline({
	createdAt,
	detail,
}: Pick<DashboardPageProps, "detail"> & { createdAt?: string }) {
	const events = detail?.audit?.length
		? detail.audit
		: [
				{ id: "audit-source", action: "source_registered", createdAt },
				{ id: "audit-provider", action: "provider_selected", createdAt },
				{ id: "audit-review", action: "human_review_required", createdAt },
			];

	return (
		<Panel>
			<PanelHeader title="Nhật ký scan" />
			<div className="divide-y divide-slate-100 p-4">
				{events.map((event) => (
					<div key={event.id ?? event.action} className="flex gap-3 py-3">
						<Clock3 className="mt-0.5 shrink-0 text-slate-400" size={15} />
						<div className="min-w-0">
							<p className="text-[13px] font-bold text-slate-800">
								{event.action ?? "activity"}
							</p>
							<p className="mt-1 text-[11px] text-slate-500">
								{formatTime(event.createdAt)}
							</p>
						</div>
					</div>
				))}
			</div>
		</Panel>
	);
}

function EvidenceMetaPanel({ evidence }: { evidence?: DashboardPageProps["evidence"][number] }) {
	const engagement = evidence?.engagement as Record<string, unknown> | undefined;

	return (
		<Panel>
			<PanelHeader title="Metadata" />
			<div className="space-y-4 p-4">
				<DetailGrid
					rows={[
						["Evidence ID", evidence?.id ?? "unknown"],
						["Comments", String(engagement?.comments ?? "-")],
						["Shares", String(engagement?.shares ?? "-")],
						["Reactions", String(engagement?.reactions ?? "-")],
					]}
				/>
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
						["Draft ID", draft.id],
						["Tone", draft.tone ?? "Chưa đặt"],
						["Audience", draft.audience ?? "Chưa đặt"],
						["Language", draft.language ?? "vi"],
						["Length", draft.length ?? "medium"],
						["Created", formatTime(draft.createdAt)],
					]}
				/>
				<p className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
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
				<p className="text-[11px] font-bold uppercase text-slate-500">{label}</p>
				<div className="mt-2 text-[16px] font-bold text-slate-900">{value}</div>
			</div>
		</Panel>
	);
}

function DetailGrid({ rows }: { rows: Array<[string, ReactNode]> }) {
	return (
		<div className="grid gap-3 text-[13px] sm:grid-cols-[120px_minmax(0,1fr)]">
			{rows.map(([label, value]) => (
				<div key={label} className="contents">
					<span className="font-semibold text-slate-500">{label}</span>
					<span className="min-w-0 break-words text-slate-800">{value}</span>
				</div>
			))}
		</div>
	);
}

function BackLink({ href, label }: { href: string; label: string }) {
	return (
		<Link
			href={href}
			className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 text-[12px] font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
		>
			<ArrowLeft size={14} /> {label}
		</Link>
	);
}

function providerLabel(provider: string) {
	if (provider.startsWith("apify")) return "Apify";
	if (provider.startsWith("firecrawl")) return "Firecrawl";
	if (provider === "browser_use") return "Browser Use";
	if (provider === "local_text") return "Local Text";
	return "Demo";
}

function formatTime(value?: unknown) {
	if (!value) return "10:12 AM";
	return new Intl.DateTimeFormat("vi-VN", {
		hour: "2-digit",
		minute: "2-digit",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(new Date(String(value)));
}
