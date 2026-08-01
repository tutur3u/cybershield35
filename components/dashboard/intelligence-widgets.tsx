"use client";

import { ArrowRight, BarChart3, FileBarChart, Info, Play } from "lucide-react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import {
	intelligenceClaimsInfiniteQueryOptions,
	intelligenceOverviewQueryOptions,
	intelligenceSourcesInfiniteQueryOptions,
} from "@/lib/dashboard/client-queries";
import { IntelligenceEvidenceRowView } from "@/components/dashboard/intelligence-evidence-row";
import { IntentPrefetchLink } from "@/components/dashboard/intent-prefetch-link";
import { IntelligenceTopicRowView } from "@/components/dashboard/intelligence-topic-row";
import {
	EmptyRow,
	formatIntelligenceDate as formatDate,
	IntelligenceFilterBar,
	intelligenceProviderLabel as providerLabel,
	LoadMoreRow,
	useIntelligenceFiltersFromUrl,
} from "@/components/dashboard/intelligence-workspace-shared";
import type {
	IntelligenceClaimRow,
	IntelligenceEvidenceRow,
	IntelligenceHealthState,
	IntelligenceKpi,
	IntelligenceOverviewView,
	IntelligenceProviderRow,
	IntelligenceSourceRow,
	IntelligenceTopicRow,
} from "@/components/dashboard/types";
import {
	DashboardTooltip,
	Panel,
	PanelHeader,
	RiskPill,
} from "@/components/dashboard/ui-primitives";

type IntelligenceWidgetProps = {
	onCreateReport?: () => void;
	onOpenScan?: () => void;
};

export function ExecutiveIntelligenceDashboard({
	onCreateReport,
	onOpenScan,
}: IntelligenceWidgetProps) {
	const [filters, setFilter] = useIntelligenceFiltersFromUrl();
	const overviewQuery = useQuery(intelligenceOverviewQueryOptions(filters));
	const overview = overviewQuery.data;

	return (
		<div className="space-y-5">
			<IntelligenceFilterBar filters={filters} setFilter={setFilter} />
			{overviewQuery.isError ? (
				<IntelligenceError
					title="Không tải được intelligence rollup"
					body={overviewQuery.error.message}
				/>
			) : null}
			<ExecutiveKpiGrid
				kpis={overview?.kpis}
				isLoading={overviewQuery.isPending}
			/>
			<div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
				<RiskTrendPanel overview={overview} isLoading={overviewQuery.isPending} />
				<ActionRoutingPanel
					overview={overview}
					onOpenScan={onOpenScan}
					isLoading={overviewQuery.isPending}
				/>
			</div>
			<div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
				<TopicMomentumPanel topics={overview?.topTopics} />
				<SourceHealthPanel
					providers={overview?.providerHealth}
					sources={overview?.sourceHealth}
				/>
				<ClaimGraphPanel claims={overview?.topClaims} />
				<CriticalEvidencePanel evidence={overview?.topEvidence} />
				<ReportReadinessPanel
					overview={overview}
					onCreateReport={onCreateReport}
					className="xl:col-span-2"
				/>
			</div>
		</div>
	);
}

export function IntelligenceClaimsWorkspace() {
	const [filters, setFilter] = useIntelligenceFiltersFromUrl();
	const claimsQuery = useInfiniteQuery(
		intelligenceClaimsInfiniteQueryOptions(filters, 24),
	);
	const claims = claimsQuery.data?.pages.flatMap((page) => page.items) ?? [];

	return (
		<div className="space-y-5">
			<IntelligenceFilterBar filters={filters} setFilter={setFilter} />
			<Panel>
				<PanelHeader
					title="Đồ thị claim"
					description="Claim, mức tin cậy, bằng chứng hỗ trợ và điều hướng xử lý."
				/>
				<div className="divide-y divide-[var(--divider)]">
					{claims.map((claim) => (
						<ClaimRow key={claim.id} claim={claim} />
					))}
					{claimsQuery.hasNextPage ? (
						<LoadMoreRow
							isFetching={claimsQuery.isFetchingNextPage}
							onClick={() => void claimsQuery.fetchNextPage()}
						/>
					) : null}
					{!claims.length && !claimsQuery.isPending ? (
						<EmptyRow text="Chưa có claim phù hợp bộ lọc." />
					) : null}
				</div>
			</Panel>
		</div>
	);
}

export function IntelligenceSourcesWorkspace({
	onOpenScan,
}: {
	onOpenScan?: () => void;
}) {
	const [filters, setFilter] = useIntelligenceFiltersFromUrl();
	const sourcesQuery = useInfiniteQuery(
		intelligenceSourcesInfiniteQueryOptions(filters, 24),
	);
	const sources = sourcesQuery.data?.pages.flatMap((page) => page.items) ?? [];

	return (
		<div className="space-y-5">
			<IntelligenceFilterBar filters={filters} setFilter={setFilter} />
			<Panel>
				<PanelHeader
					title="Sức khỏe nguồn và pipeline"
					description="Độ mới, chuỗi lỗi, trạng thái provider và liên kết vào chi tiết scan."
					action={
						onOpenScan ? (
							<button
								type="button"
								onClick={onOpenScan}
								className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-[12px] font-bold text-[var(--muted-strong)] hover:bg-[var(--surface-soft)]"
							>
								<Play size={14} /> Tạo scan
							</button>
						) : null
					}
				/>
				<div className="divide-y divide-[var(--divider)]">
					{sources.map((source) => (
						<SourceRow key={source.sourceId} source={source} />
					))}
					{sourcesQuery.hasNextPage ? (
						<LoadMoreRow
							isFetching={sourcesQuery.isFetchingNextPage}
							onClick={() => void sourcesQuery.fetchNextPage()}
						/>
					) : null}
					{!sources.length && !sourcesQuery.isPending ? (
						<EmptyRow text="Không có nguồn phù hợp bộ lọc." />
					) : null}
				</div>
			</Panel>
		</div>
	);
}

export function IntelligenceReportsWorkbench({
	onCreateReport,
}: {
	onCreateReport?: () => void;
}) {
	const [filters] = useIntelligenceFiltersFromUrl();
	const overviewQuery = useQuery(intelligenceOverviewQueryOptions(filters));
	const overview = overviewQuery.data;

	return (
		<div className="space-y-4">
			<ReportReadinessPanel
				overview={overview}
				onCreateReport={onCreateReport}
			/>
			<details className="group rounded-lg border border-[var(--border)] bg-[var(--surface)]">
				<summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-[13px] font-bold text-[var(--foreground)] marker:content-none">
					<span>
						Dữ liệu hỗ trợ quyết định
						<span className="mt-1 block text-[11px] font-semibold leading-4 text-[var(--muted)]">Mở khi cần kiểm tra bằng chứng, claim và xu hướng chủ đề trước khi xuất báo cáo.</span>
					</span>
					<ArrowRight size={15} className="shrink-0 transition group-open:rotate-90" />
				</summary>
				<div className="grid min-w-0 gap-4 border-t border-[var(--divider)] p-4 xl:grid-cols-2">
					<CriticalEvidencePanel evidence={overview?.topEvidence} />
					<ClaimGraphPanel claims={overview?.topClaims} />
					<div className="xl:col-span-2"><TopicMomentumPanel topics={overview?.topTopics} /></div>
				</div>
			</details>
		</div>
	);
}

function ExecutiveKpiGrid({
	isLoading,
	kpis,
}: {
	isLoading: boolean;
	kpis?: IntelligenceKpi[];
}) {
	const visible = kpis ?? skeletonKpis;

	return (
		<div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
			{visible.map((kpi) => (
				<IntentPrefetchLink key={kpi.id} href={kpi.href} className="min-w-0">
					<Panel className="h-full transition hover:border-[var(--border-strong)]">
						<div className="min-w-0 p-4">
							<div className="flex min-w-0 items-start justify-between gap-3">
								<div className="min-w-0">
									<DashboardTooltip content={kpi.help}>
										<p className="inline-flex max-w-full items-center gap-1 truncate text-[12px] font-bold text-[var(--muted-strong)]">
											{kpi.label} <Info size={13} className="shrink-0" />
										</p>
									</DashboardTooltip>
									<p
										className={`mt-2 text-[28px] font-bold leading-none ${toneText(kpi.tone)} ${
											isLoading ? "animate-pulse" : ""
										}`}
									>
										{kpi.value}
									</p>
								</div>
								<ArrowRight size={15} className="shrink-0 text-[var(--muted)]" />
							</div>
							<p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">
								{kpi.description}
							</p>
							<p className="mt-3 w-fit max-w-full rounded-md bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-bold text-[var(--foreground)]">
								{kpi.trendLabel}
							</p>
						</div>
					</Panel>
				</IntentPrefetchLink>
			))}
		</div>
	);
}

function RiskTrendPanel({
	isLoading,
	overview,
}: {
	isLoading: boolean;
	overview?: IntelligenceOverviewView;
}) {
	const trends = overview?.trends ?? [];
	return (
		<Panel className="h-full">
			<PanelHeader
				title="Xu hướng rủi ro và bằng chứng"
				description="Khối lượng, bằng chứng rủi ro cao và độ phủ scan theo ngày."
				action={
					<DashboardTooltip content="Biểu đồ dùng SVG nhẹ từ rollup đã cache, không dùng thư viện chart nặng.">
						<span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-soft)] px-2 py-1 text-[11px] font-bold text-[var(--accent-strong)]">
							<BarChart3 size={13} /> Rollup
						</span>
					</DashboardTooltip>
				}
			/>
			<div className="p-4">
				{trends.length ? (
					<TrendSvg trends={trends} />
				) : (
					<div className="grid min-h-56 place-items-center rounded-md border border-dashed border-[var(--border)] text-center text-[12px] font-semibold text-[var(--muted)]">
						{isLoading
							? "Đang tải rollup..."
							: "Chưa có trend. Chạy backfill hoặc tạo scan mới."}
					</div>
				)}
			</div>
		</Panel>
	);
}

function TrendSvg({
	trends,
}: {
	trends: Array<{ day: string; evidence: number; highRisk: number; scans: number }>;
}) {
	const width = 720;
	const height = 220;
	const padding = 26;
	const maxValue = Math.max(
		1,
		...trends.flatMap((point) => [point.evidence, point.highRisk, point.scans]),
	);
	const points = (key: "evidence" | "highRisk" | "scans") =>
		trends
			.map((point, index) => {
				const x =
					padding +
					(index / Math.max(1, trends.length - 1)) * (width - padding * 2);
				const y =
					height -
					padding -
					(point[key] / maxValue) * (height - padding * 2);
				return `${x},${y}`;
			})
			.join(" ");

	return (
		<div className="min-w-0 overflow-hidden">
			<svg
				viewBox={`0 0 ${width} ${height}`}
				className="h-56 w-full"
				role="img"
				aria-label="Biểu đồ xu hướng scan và bằng chứng"
			>
				<polyline
					points={points("evidence")}
					fill="none"
					stroke="var(--accent)"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="4"
				/>
				<polyline
					points={points("highRisk")}
					fill="none"
					stroke="var(--danger-strong)"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="4"
				/>
				<polyline
					points={points("scans")}
					fill="none"
					stroke="var(--success-strong)"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="3"
				/>
			</svg>
			<div className="flex flex-wrap gap-2 text-[11px] font-bold text-[var(--muted-strong)]">
				<Legend color="var(--accent)" label="Bằng chứng" />
				<Legend color="var(--danger-strong)" label="Rủi ro cao" />
				<Legend color="var(--success-strong)" label="Scan" />
			</div>
		</div>
	);
}

function ActionRoutingPanel({
	isLoading,
	onOpenScan,
	overview,
}: {
	isLoading: boolean;
	onOpenScan?: () => void;
	overview?: IntelligenceOverviewView;
}) {
	return (
		<Panel className="h-full">
			<PanelHeader
				title="Ngoại lệ cần xử lý"
				description="Ưu tiên từ rollup rủi ro, claim và pipeline."
				action={
					onOpenScan ? (
						<button
							type="button"
							onClick={onOpenScan}
							className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-[12px] font-bold text-[var(--muted-strong)] hover:bg-[var(--surface-soft)]"
						>
							<Play size={14} /> Scan mới
						</button>
					) : null
				}
			/>
			<div className="divide-y divide-[var(--divider)]">
				{overview?.actions.map((action) => (
					<IntentPrefetchLink
						key={action.id}
						href={action.href}
						className="grid min-w-0 gap-2 px-4 py-3 transition hover:bg-[var(--surface-soft)]"
					>
						<div className="flex min-w-0 items-start justify-between gap-3">
							<DashboardTooltip content={action.help}>
								<p className="min-w-0 truncate text-[13px] font-bold text-[var(--foreground)]">
									{action.label}
								</p>
							</DashboardTooltip>
							<RiskPill risk={action.severity} />
						</div>
						<p className="line-clamp-2 text-[12px] leading-5 text-[var(--muted)]">
							{action.body}
						</p>
					</IntentPrefetchLink>
				))}
				{!overview?.actions.length ? (
					<EmptyRow
						text={
							isLoading
								? "Đang tải việc cần xử lý..."
								: "Không có việc khẩn cấp."
						}
					/>
				) : null}
			</div>
		</Panel>
	);
}

function TopicMomentumPanel({ topics }: { topics?: IntelligenceTopicRow[] }) {
	return (
		<Panel className="h-full">
			<PanelHeader
				title="Động lượng chủ đề"
				description="Chủ đề đang tăng về rủi ro, claim và evidence."
			/>
			<div className="divide-y divide-[var(--divider)]">
				{topics?.map((topic) => (
					<IntelligenceTopicRowView key={topic.id} topic={topic} compact />
				))}
				{!topics?.length ? <EmptyRow text="Chưa có topic rollup." /> : null}
			</div>
		</Panel>
	);
}

function SourceHealthPanel({
	providers,
	sources,
}: {
	providers?: IntelligenceProviderRow[];
	sources?: IntelligenceSourceRow[];
}) {
	return (
		<Panel className="h-full">
			<PanelHeader
				title="Sức khỏe nguồn và provider"
				description="Nguồn, adapter và freshness cần theo dõi."
			/>
			<div className="grid gap-0 divide-y divide-[var(--divider)]">
				{providers?.slice(0, 3).map((provider) => (
					<ProviderHealthRow key={provider.provider} provider={provider} />
				))}
				{sources?.slice(0, 4).map((source) => (
					<SourceRow key={source.sourceId} source={source} compact />
				))}
				{!providers?.length && !sources?.length ? (
					<EmptyRow text="Chưa có dữ liệu sức khỏe provider/source." />
				) : null}
			</div>
		</Panel>
	);
}

function ClaimGraphPanel({ claims }: { claims?: IntelligenceClaimRow[] }) {
	return (
		<Panel className="h-full">
			<PanelHeader
				title="Claim và lập luận"
				description="Claim quan trọng, độ tin cậy và bằng chứng liên quan."
			/>
			<div className="divide-y divide-[var(--divider)]">
				{claims?.map((claim) => (
					<ClaimRow key={claim.id} claim={claim} compact />
				))}
				{!claims?.length ? <EmptyRow text="Chưa có claim index." /> : null}
			</div>
		</Panel>
	);
}

function CriticalEvidencePanel({
	evidence,
}: {
	evidence?: IntelligenceEvidenceRow[];
}) {
	return (
		<Panel className="h-full">
			<PanelHeader
				title="Bằng chứng trọng yếu"
				description="Bằng chứng mới hoặc rủi ro cao có thể mở trực tiếp."
			/>
			<div className="divide-y divide-[var(--divider)]">
				{evidence?.map((item) => (
					<IntelligenceEvidenceRowView key={item.id} evidence={item} compact />
				))}
				{!evidence?.length ? <EmptyRow text="Chưa có bằng chứng nổi bật." /> : null}
			</div>
		</Panel>
	);
}

function ReportReadinessPanel({
	className = "",
	onCreateReport,
	overview,
}: {
	className?: string;
	onCreateReport?: () => void;
	overview?: IntelligenceOverviewView;
}) {
	const readiness = overview?.readiness;
	return (
		<Panel className={className}>
			<PanelHeader
				title="Kiểm tra dữ liệu trước khi xuất"
				description="Các chỉ số giúp biết lượt quét nào đã có đủ dữ liệu và bản nháp được người vận hành duyệt."
				action={
					onCreateReport ? (
						<button
							type="button"
							onClick={onCreateReport}
							className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-[12px] font-bold text-[var(--muted-strong)] hover:bg-[var(--surface-soft)]"
						>
							<FileBarChart size={14} /> Tạo mẫu riêng
						</button>
					) : null
				}
			/>
			<div className="grid min-w-0 gap-3 p-4 md:grid-cols-4">
				<ReadinessMetric
					help="Một lượt quét được tính là sẵn sàng khi đã hoàn tất và có bản nháp được người vận hành duyệt."
					label="Lượt quét sẵn sàng"
					value={readiness?.readyReports ?? 0}
				/>
				<ReadinessMetric
					help="Bản nháp đã duyệt là bản nháp được người vận hành kiểm tra."
					label="Bản nháp đã duyệt"
					value={readiness?.approvedDrafts ?? 0}
				/>
				<ReadinessMetric
					help="Tổng số bản nháp phản hồi đã tạo trong khoảng thời gian đang xem."
					label="Tổng bản nháp"
					value={readiness?.draftCount ?? 0}
				/>
				<ReadinessMetric
					help="Tỷ lệ được tính bằng số bản nháp đã duyệt chia cho tổng số bản nháp trong khoảng thời gian đang xem."
					label="Tỷ lệ đã duyệt"
					value={`${readiness?.approvedDraftRate ?? 0}%`}
				/>
			</div>
		</Panel>
	);
}

function ClaimRow({
	claim,
	compact = false,
}: {
	claim: IntelligenceClaimRow;
	compact?: boolean;
}) {
	return (
		<div
			className={`grid min-w-0 gap-3 px-4 py-3 ${
				compact ? "" : "sm:grid-cols-[minmax(0,1fr)_120px_92px]"
			} sm:items-center`}
		>
			<div className="min-w-0">
				<IntentPrefetchLink
					href={claim.deepLink}
					className="line-clamp-2 text-[13px] font-bold leading-5 text-[var(--foreground)] hover:text-[var(--accent-strong)]"
				>
					{claim.claim}
				</IntentPrefetchLink>
				<p className="mt-1 truncate text-[11px] font-semibold text-[var(--muted)]">
					{claim.evidenceCount} bằng chứng - {claim.stance} - {claim.sourceLabels.slice(0, 2).join(", ") || "chưa có nguồn"}
				</p>
				<div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
					{claim.evidenceHrefs.slice(0, 3).map((href, index) => (
						<IntentPrefetchLink
							key={href}
							href={href}
							className="max-w-full truncate rounded-md bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-bold text-[var(--accent-strong)]"
						>
							Bằng chứng {index + 1}
						</IntentPrefetchLink>
					))}
				</div>
			</div>
			{compact ? null : (
				<DashboardTooltip content="Độ tin cậy là điểm có cấu trúc do pipeline phân tích trả về, chuẩn hóa từ 0 đến 100.">
					<span className="w-fit rounded-md bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-bold text-[var(--foreground)]">
						{claim.confidence}% tin cậy
					</span>
				</DashboardTooltip>
			)}
			<RiskPill risk={claim.riskLevel} />
		</div>
	);
}

function SourceRow({
	compact = false,
	source,
}: {
	compact?: boolean;
	source: IntelligenceSourceRow;
}) {
	return (
		<div
			className={`grid min-w-0 gap-3 px-4 py-3 ${
				compact ? "" : "sm:grid-cols-[minmax(0,1fr)_130px_110px]"
			} sm:items-center`}
		>
			<div className="min-w-0">
				<IntentPrefetchLink
					href={source.href}
					className="truncate text-[13px] font-bold text-[var(--foreground)] hover:text-[var(--accent-strong)]"
				>
					{source.sourceLabel}
				</IntentPrefetchLink>
				<p className="mt-1 truncate text-[11px] font-semibold text-[var(--muted)]">
					{source.evidenceCount} bằng chứng - {source.failedScanCount} lỗi - {providerLabel(source.provider)}
				</p>
				<div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
					<IntentPrefetchLink
						href={`/evidence?facebookPage=${encodeURIComponent(source.sourceLabel)}`}
						className="max-w-full truncate rounded-md bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-bold text-[var(--accent-strong)]"
					>
						Xem bài viết
					</IntentPrefetchLink>
					{source.lastScanHref ? (
						<IntentPrefetchLink
							href={source.lastScanHref}
							className="max-w-full truncate rounded-md bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-bold text-[var(--accent-strong)]"
						>
							Scan gần nhất
						</IntentPrefetchLink>
					) : null}
				</div>
			</div>
			{compact ? null : (
				<p className="truncate text-[11px] font-semibold text-[var(--muted)]">
					{source.lastScannedAt ? formatDate(source.lastScannedAt) : "Chưa từng quét"}
				</p>
			)}
			<HealthBadge health={source.health} />
		</div>
	);
}

function ProviderHealthRow({ provider }: { provider: IntelligenceProviderRow }) {
	return (
		<div className="grid min-w-0 gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_120px_100px] sm:items-center">
			<div className="min-w-0">
				<p className="truncate text-[13px] font-bold text-[var(--foreground)]">
					{providerLabel(provider.provider)}
				</p>
				<p className="mt-1 truncate text-[11px] font-semibold text-[var(--muted)]">
					{provider.completedRunCount} hoàn tất - {provider.failedRunCount} lỗi
				</p>
			</div>
			<p className="truncate text-[11px] font-semibold text-[var(--muted)]">
				{provider.avgDurationMs ? `${provider.avgDurationMs}ms trung bình` : "Chưa có thời lượng"}
			</p>
			<HealthBadge health={provider.health} />
		</div>
	);
}

function ReadinessMetric({
	help,
	label,
	value,
}: {
	help: string;
	label: string;
	value: number | string;
}) {
	return (
		<DashboardTooltip content={help}>
			<div className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
				<p className="flex min-h-8 items-start gap-1.5 text-[11px] font-bold leading-4 text-[var(--muted)]">{label}<Info size={12} className="mt-0.5 shrink-0" /></p>
				<p className="mt-1 break-words text-[22px] font-bold text-[var(--foreground)]">
					{typeof value === "number" ? value.toLocaleString("vi-VN") : value}
				</p>
			</div>
		</DashboardTooltip>
	);
}

function HealthBadge({ health }: { health: IntelligenceHealthState }) {
	const labels: Record<IntelligenceHealthState, string> = {
		attention: "Cần chú ý",
		blocked: "Bị chặn",
		healthy: "Ổn định",
		stale: "Cũ",
		unknown: "Không rõ",
		unseen: "Chưa thấy",
	};
	const help: Record<IntelligenceHealthState, string> = {
		attention: "Đang chạy, retry hoặc cần người vận hành theo dõi.",
		blocked: "Có lỗi gần đây. Mở scan hoặc provider để xử lý.",
		healthy: "Gần đây có dữ liệu thành công.",
		stale: "Không có hoạt động mới trong ngưỡng freshness.",
		unknown: "Chưa đủ dữ liệu để xác định trạng thái.",
		unseen: "Nguồn/provider chưa có lần chạy ghi nhận.",
	};
	const className: Record<IntelligenceHealthState, string> = {
		attention: "bg-[var(--warning-soft)] text-[var(--warning-strong)]",
		blocked: "bg-[var(--danger-soft)] text-[var(--danger-strong)]",
		healthy: "bg-[var(--success-soft)] text-[var(--success-strong)]",
		stale: "bg-[var(--neutral-soft)] text-[var(--muted-strong)]",
		unknown: "bg-[var(--surface-soft)] text-[var(--muted-strong)]",
		unseen: "bg-[var(--surface-soft)] text-[var(--muted-strong)]",
	};

	return (
		<DashboardTooltip content={help[health]}>
			<span
				className={`inline-flex h-6 w-fit max-w-full items-center rounded-md px-2 text-[11px] font-bold ${className[health]}`}
			>
				{labels[health]}
			</span>
		</DashboardTooltip>
	);
}

function IntelligenceError({ body, title }: { body: string; title: string }) {
	return (
		<div className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3">
			<p className="text-[13px] font-bold text-[var(--danger-strong)]">{title}</p>
			<p className="mt-1 text-[12px] leading-5 text-[var(--danger-strong)]">
				{body}
			</p>
		</div>
	);
}

function Legend({ color, label }: { color: string; label: string }) {
	return (
		<span className="inline-flex items-center gap-1.5">
			<span
				aria-hidden
				className="size-2 rounded-full"
				style={{ backgroundColor: color }}
			/>
			{label}
		</span>
	);
}

function toneText(tone: IntelligenceKpi["tone"]) {
	const map: Record<IntelligenceKpi["tone"], string> = {
		accent: "text-[var(--accent-strong)]",
		danger: "text-[var(--danger-strong)]",
		neutral: "text-[var(--muted-strong)]",
		success: "text-[var(--success-strong)]",
		warning: "text-[var(--warning-strong)]",
	};
	return map[tone];
}

const skeletonKpis: IntelligenceKpi[] = [
	{
		description: "Đang tải rollup scan.",
		help: "Rollup được tải từ endpoint tổng quan intelligence.",
		href: "/sources",
		id: "loading-scans",
		label: "Thông lượng scan",
		tone: "neutral",
		trendLabel: "Đang tải",
		value: "-",
	},
	{
		description: "Đang tải tư thế rủi ro.",
		help: "Rollup được tải từ endpoint tổng quan intelligence.",
		href: "/evidence",
		id: "loading-risk",
		label: "Tư thế rủi ro",
		tone: "neutral",
		trendLabel: "Đang tải",
		value: "-",
	},
	{
		description: "Đang tải claim.",
		help: "Rollup được tải từ endpoint tổng quan intelligence.",
		href: "/alerts",
		id: "loading-claims",
		label: "Chỉ mục claim",
		tone: "neutral",
		trendLabel: "Đang tải",
		value: "-",
	},
	{
		description: "Đang tải độ sẵn sàng báo cáo.",
		help: "Rollup được tải từ endpoint tổng quan intelligence.",
		href: "/reports",
		id: "loading-reports",
		label: "Sẵn sàng báo cáo",
		tone: "neutral",
		trendLabel: "Đang tải",
		value: "-",
	},
];
