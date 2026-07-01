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
						draft={props.draft}
						onReview={props.onReview}
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
			<div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
				<Panel className="h-full">
					<PanelHeader
						title="Trích dẫn"
						action={<RiskPill risk={evidence?.riskLevel ?? "medium"} />}
					/>
					<div className="space-y-4 p-4">
						<p className="rounded-lg bg-[var(--surface-soft)] p-4 text-[15px] leading-7 text-[var(--foreground)]">
							"{evidence?.quote ?? "Không tìm thấy trích dẫn."}"
						</p>
						<p className="text-[13px] leading-6 text-[var(--muted-strong)]">
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
								className="inline-flex h-10 max-w-full items-center rounded-md border border-[var(--border)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition whitespace-nowrap hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
							>
								Mở nguồn gốc
							</a>
						) : null}
					</div>
				</Panel>
				<div className="grid gap-5">
					<EvidenceMetaPanel evidence={evidence} />
					<EvidenceActionsPanel scanId={props.selectedScanId} />
				</div>
			</div>
			<EvidencePanel evidence={props.evidence} limit={5} scanId={props.selectedScanId} />
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

function toDraftShape(
	draft: Partial<DraftShape> | null | undefined,
	fallback: DraftShape | null,
): DraftShape | null {
	const id = draft?.id ?? fallback?.id;
	const body = draft?.body ?? fallback?.body;
	if (!id || !body) return null;
	return { ...fallback, ...draft, id, body };
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

function EvidenceActionsPanel({ scanId }: { scanId: string }) {
	return (
		<Panel>
			<PanelHeader title="Liên kết xử lý" />
			<div className="space-y-3 p-4">
				<Link
					href={`/scans/${scanId}`}
					className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
				>
					<span className="truncate">Mở scan liên quan</span>
					<ArrowLeft className="rotate-180" size={14} />
				</Link>
				<Link
					href="/counter-arguments"
					className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
				>
					<span className="truncate">Soạn phản hồi từ bằng chứng</span>
					<ArrowLeft className="rotate-180" size={14} />
				</Link>
				<p className="rounded-lg bg-[var(--surface-soft)] p-3 text-[11px] leading-5 text-[var(--muted)]">
					Bằng chứng này chỉ được dùng làm căn cứ nội bộ; mọi phản hồi phải qua
					trạng thái duyệt thủ công trước khi xuất.
				</p>
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
						["Tone", draft?.tone ?? "Chưa đặt"],
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
		<Link
			href={href}
			className="inline-flex h-10 max-w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition whitespace-nowrap hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
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
