"use client";

import {
	Activity,
	ArrowRight,
	BarChart3,
	ChevronDown,
	Database,
	FileBarChart,
	Filter,
	Info,
	Play,
	Radar,
	RefreshCw,
	Search,
	ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	type ComponentType,
	useMemo,
	useRef,
	useTransition,
} from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";

import {
	intelligenceActivityInfiniteQueryOptions,
	intelligenceClaimsInfiniteQueryOptions,
	intelligenceEvidenceInfiniteQueryOptions,
	intelligenceFacebookPagesQueryOptions,
	intelligenceOverviewQueryOptions,
	intelligenceSourcesInfiniteQueryOptions,
	intelligenceTopicsInfiniteQueryOptions,
} from "@/lib/dashboard/client-queries";
import type {
	IntelligenceActivityRow,
	IntelligenceClaimRow,
	IntelligenceEvidenceRow,
	IntelligenceFacebookPageOption,
	IntelligenceFilters,
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

export function IntelligenceTopicsWorkspace() {
	const [filters, setFilter] = useIntelligenceFiltersFromUrl();
	const topicsQuery = useInfiniteQuery(
		intelligenceTopicsInfiniteQueryOptions(filters, 24),
	);
	const topics = topicsQuery.data?.pages.flatMap((page) => page.items) ?? [];

	return (
		<div className="space-y-5">
			<IntelligenceFilterBar
				filters={filters}
				setFilter={setFilter}
				showStatus={false}
			/>
			<Panel>
				<PanelHeader
					title="Chủ đề intelligence"
					description="Mỗi chủ đề là một đối tượng vận hành: xu hướng, rủi ro, bằng chứng, claim và tác động báo cáo."
				/>
				<div className="divide-y divide-[var(--divider)]">
					{topics.map((topic) => (
						<TopicRow key={topic.id} topic={topic} />
					))}
					{topicsQuery.hasNextPage ? (
						<LoadMoreRow
							isFetching={topicsQuery.isFetchingNextPage}
							onClick={() => void topicsQuery.fetchNextPage()}
						/>
					) : null}
					{!topics.length && !topicsQuery.isPending ? (
						<EmptyRow text="Chưa có chủ đề intelligence phù hợp bộ lọc." />
					) : null}
				</div>
			</Panel>
		</div>
	);
}

export function IntelligenceEvidenceVault() {
	const [filters, setFilter] = useIntelligenceFiltersFromUrl();
	const evidenceQuery = useInfiniteQuery(
		intelligenceEvidenceInfiniteQueryOptions(filters, 40),
	);
	const evidence = evidenceQuery.data?.pages.flatMap((page) => page.items) ?? [];
	const parentRef = useRef<HTMLDivElement | null>(null);
	// eslint-disable-next-line react-hooks/incompatible-library
	const rowVirtualizer = useVirtualizer({
		count: evidence.length,
		estimateSize: () => 118,
		getScrollElement: () => parentRef.current,
		overscan: 8,
	});

	return (
		<div className="space-y-5">
			<IntelligenceFilterBar filters={filters} setFilter={setFilter} />
			<Panel>
				<PanelHeader
					title="Kho bằng chứng intelligence"
					description="Danh sách lớn được tải vô hạn và ảo hóa để giữ thao tác nhanh khi dữ liệu tăng."
					action={
						<DashboardTooltip content="Bằng chứng được lấy từ bảng đã chuẩn hóa, không hiển thị raw provider payload hoặc khóa bí mật.">
							<span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-bold text-[var(--muted-strong)]">
								<Database size={13} /> Có dữ liệu gốc
							</span>
						</DashboardTooltip>
					}
				/>
				<div ref={parentRef} className="max-h-[720px] overflow-auto">
					<div
						className="relative min-w-0"
						style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
					>
						{rowVirtualizer.getVirtualItems().map((virtualRow) => {
							const item = evidence[virtualRow.index];
							if (!item) return null;
							return (
								<div
									key={item.id}
									className="absolute left-0 top-0 w-full"
									style={{
										height: `${virtualRow.size}px`,
										transform: `translateY(${virtualRow.start}px)`,
									}}
								>
									<EvidenceRow evidence={item} />
								</div>
							);
						})}
					</div>
				</div>
				{evidenceQuery.hasNextPage ? (
					<LoadMoreRow
						isFetching={evidenceQuery.isFetchingNextPage}
						onClick={() => void evidenceQuery.fetchNextPage()}
					/>
				) : null}
				{!evidence.length && !evidenceQuery.isPending ? (
					<EmptyRow text="Không có bằng chứng phù hợp bộ lọc hiện tại." />
				) : null}
			</Panel>
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

export function IntelligenceActivityStream() {
	const [filters, setFilter] = useIntelligenceFiltersFromUrl();
	const activityQuery = useInfiniteQuery(
		intelligenceActivityInfiniteQueryOptions(filters, 30),
	);
	const events = activityQuery.data?.pages.flatMap((page) => page.items) ?? [];

	return (
		<div className="space-y-5">
			<IntelligenceFilterBar
				filters={filters}
				setFilter={setFilter}
				showProvider={false}
			/>
			<Panel>
				<PanelHeader
					title="Nhật ký intelligence"
					description="Hoạt động vận hành có liên kết đến scan, evidence và draft liên quan."
				/>
				<div className="divide-y divide-[var(--divider)]">
					{events.map((event) => (
						<ActivityRow key={event.id} event={event} />
					))}
					{activityQuery.hasNextPage ? (
						<LoadMoreRow
							isFetching={activityQuery.isFetchingNextPage}
							onClick={() => void activityQuery.fetchNextPage()}
						/>
					) : null}
					{!events.length && !activityQuery.isPending ? (
						<EmptyRow text="Chưa có hoạt động phù hợp bộ lọc." />
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
		<div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
			<ReportReadinessPanel
				overview={overview}
				onCreateReport={onCreateReport}
				className="h-full"
			/>
			<CriticalEvidencePanel evidence={overview?.topEvidence} />
			<ClaimGraphPanel claims={overview?.topClaims} />
			<TopicMomentumPanel topics={overview?.topTopics} />
		</div>
	);
}

function IntelligenceFilterBar({
	filters,
	setFilter,
	showProvider = true,
	showStatus = true,
}: {
	filters: IntelligenceFilters;
	setFilter: (key: keyof IntelligenceFilters, value: string) => void;
	showProvider?: boolean;
	showStatus?: boolean;
}) {
	const [, startTransition] = useTransition();
	const facebookPagesQuery = useQuery(intelligenceFacebookPagesQueryOptions());
	const facebookPageOptions = facebookPageSelectOptions(
		facebookPagesQuery.data ?? [],
	);

	return (
		<div className="grid min-w-0 gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-soft)] md:grid-cols-2 xl:grid-cols-[minmax(180px,1.2fr)_repeat(5,minmax(126px,0.75fr))]">
			<label className="relative min-w-0">
				<Search
					aria-hidden
					size={15}
					className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
				/>
				<input
					defaultValue={filters.query ?? ""}
					onChange={(event) => {
						const value = event.target.value;
						startTransition(() => setFilter("query", value));
					}}
					placeholder="Tìm claim, bằng chứng, nguồn..."
					className="h-10 w-full min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] pl-9 pr-3 text-[12px] font-semibold text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
				/>
			</label>
			<FilterSelect
				icon={Radar}
				label="Fanpage"
				value={filters.facebookPage ?? ""}
				onChange={(value) => setFilter("facebookPage", value)}
				options={[["", "Tất cả fanpage"], ...facebookPageOptions]}
				help="Lọc theo fanpage Facebook đã theo dõi. Nhãn hiển thị tên trang, username và Facebook ID nếu hệ thống đã thu thập được."
			/>
			<FilterSelect
				icon={Filter}
				label="Thời gian"
				value={filters.timeRange ?? "30d"}
				onChange={(value) => setFilter("timeRange", value)}
				options={[
					["7d", "7 ngày"],
					["30d", "30 ngày"],
					["90d", "90 ngày"],
					["all", "Tất cả"],
				]}
				help="Giới hạn rollup và lịch sử hiển thị theo ngày tạo hoặc thời điểm hoạt động."
			/>
			<FilterSelect
				icon={ShieldAlert}
				label="Rủi ro"
				value={filters.risk ?? "all"}
				onChange={(value) => setFilter("risk", value)}
				options={[
					["all", "Mọi mức"],
					["high", "Cao"],
					["medium", "Trung bình"],
					["low", "Thấp"],
				]}
				help="Lọc theo mức rủi ro đã lưu trong evidence, claim hoặc activity."
			/>
			{showProvider ? (
				<FilterSelect
					icon={Radar}
					label="Provider"
					value={filters.provider ?? ""}
					onChange={(value) => setFilter("provider", value)}
					options={[
						["", "Tất cả"],
						["apify_facebook_posts", "Apify bài viết"],
						["apify_facebook_comments", "Apify bình luận"],
						["apify_facebook_groups", "Apify nhóm"],
						["firecrawl", "Firecrawl"],
						["browser_use", "Browser Use"],
						["local_text", "Văn bản nội bộ"],
					]}
					help="Provider là adapter thu thập dữ liệu cho scan."
				/>
			) : null}
			{showStatus ? (
				<FilterSelect
					icon={Activity}
					label="Sức khỏe"
					value={filters.status ?? ""}
					onChange={(value) => setFilter("status", value)}
					options={[
						["", "Tất cả"],
						["healthy", "Ổn định"],
						["attention", "Cần chú ý"],
						["blocked", "Bị chặn"],
						["stale", "Cũ"],
					]}
					help="Trạng thái sức khỏe được tính từ lần quét gần nhất và lỗi provider."
				/>
			) : null}
		</div>
	);
}

function FilterSelect({
	help,
	icon: Icon,
	label,
	onChange,
	options,
	value,
}: {
	help: string;
	icon: ComponentType<{ size?: number; className?: string }>;
	label: string;
	onChange: (value: string) => void;
	options: [string, string][];
	value: string;
}) {
	return (
		<DashboardTooltip content={help}>
			<label className="relative min-w-0">
				<span className="sr-only">{label}</span>
				<Icon
					aria-hidden
					size={15}
					className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
				/>
				<select
					value={value}
					onChange={(event) => onChange(event.target.value)}
					className="h-10 w-full min-w-0 appearance-none rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] pl-9 pr-8 text-[12px] font-bold text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
				>
					{options.map(([optionValue, text]) => (
						<option key={optionValue || "all"} value={optionValue}>
							{text}
						</option>
					))}
				</select>
				<ChevronDown
					aria-hidden
					size={14}
					className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
				/>
			</label>
		</DashboardTooltip>
	);
}

function facebookPageSelectOptions(
	pages: IntelligenceFacebookPageOption[],
): [string, string][] {
	return pages.map((page) => {
		const details = [
			page.username ? `@${page.username}` : null,
			page.facebookId ? `ID ${page.facebookId}` : null,
			page.evidenceCount ? `${page.evidenceCount} bằng chứng` : null,
		].filter(Boolean);
		return [
			page.value,
			details.length ? `${page.label} - ${details.join(" - ")}` : page.label,
		];
	});
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
				<Link key={kpi.id} href={kpi.href} className="min-w-0">
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
				</Link>
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
					<Link
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
					</Link>
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
					<TopicRow key={topic.id} topic={topic} compact />
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
					<EvidenceRow key={item.id} evidence={item} compact />
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
				title="Độ sẵn sàng báo cáo điều hành"
				description="Độ sẵn sàng dựa trên draft đã duyệt, bằng chứng và citation coverage."
				action={
					onCreateReport ? (
						<button
							type="button"
							onClick={onCreateReport}
							className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-[12px] font-bold text-[var(--muted-strong)] hover:bg-[var(--surface-soft)]"
						>
							<FileBarChart size={14} /> Mẫu báo cáo
						</button>
					) : null
				}
			/>
			<div className="grid min-w-0 gap-3 p-4 md:grid-cols-4">
				<ReadinessMetric
					help="Scan sẵn sàng báo cáo là scan đã hoàn tất và có bản nháp được duyệt trong khoảng rollup."
					label="Báo cáo sẵn sàng"
					value={readiness?.readyReports ?? 0}
				/>
				<ReadinessMetric
					help="Bản nháp đã duyệt là bản nháp được người vận hành kiểm tra."
					label="Bản nháp đã duyệt"
					value={readiness?.approvedDrafts ?? 0}
				/>
				<ReadinessMetric
					help="Bao gồm tất cả bản nháp phản hồi đã tạo."
					label="Bản nháp"
					value={readiness?.draftCount ?? 0}
				/>
				<ReadinessMetric
					help="Độ phủ citation so sánh bản nháp đã duyệt với tổng bản nháp sẵn có."
					label="Độ phủ citation"
					value={`${readiness?.citationCoverage ?? 0}%`}
				/>
			</div>
		</Panel>
	);
}

function TopicRow({
	compact = false,
	topic,
}: {
	compact?: boolean;
	topic: IntelligenceTopicRow;
}) {
	return (
		<Link
			href={topic.href}
			className={`grid min-w-0 gap-3 px-4 py-3 transition hover:bg-[var(--surface-soft)] ${
				compact
					? "sm:grid-cols-[minmax(0,1fr)_90px_80px]"
					: "sm:grid-cols-[minmax(0,1fr)_110px_110px_80px]"
			} sm:items-center`}
		>
			<div className="min-w-0">
				<p className="truncate text-[13px] font-bold text-[var(--foreground)]">
					{topic.name}
				</p>
				<p className="mt-1 truncate text-[11px] font-semibold text-[var(--muted)]">
					{topic.evidenceCount} bằng chứng - {topic.claimCount} claim - {topic.scanCount} scan
				</p>
			</div>
			<DashboardTooltip content="Động lượng kết hợp khối lượng bằng chứng, độ phủ scan và bằng chứng rủi ro cao.">
				<span className="min-w-0 rounded-md bg-[var(--surface-soft)] px-2 py-1 text-center text-[11px] font-bold text-[var(--foreground)]">
					{topic.momentumScore}/100
				</span>
			</DashboardTooltip>
			{compact ? null : (
				<span className="min-w-0 truncate text-[11px] font-bold text-[var(--muted-strong)]">
					{topic.trend}
				</span>
			)}
			<RiskPill risk={topic.riskLevel} />
		</Link>
	);
}

function EvidenceRow({
	compact = false,
	evidence,
}: {
	compact?: boolean;
	evidence: IntelligenceEvidenceRow;
}) {
	return (
		<div
			className={`grid min-w-0 gap-3 px-4 py-3 ${
				compact ? "" : "sm:grid-cols-[minmax(0,1fr)_120px_90px]"
			} sm:items-center`}
		>
			<div className="min-w-0">
				<Link
					href={evidence.href}
					className="line-clamp-2 text-[13px] font-bold leading-5 text-[var(--foreground)] hover:text-[var(--accent-strong)]"
				>
					{evidence.quote}
				</Link>
				<p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[var(--muted)]">
					{evidence.summary}
				</p>
				<p className="mt-2 truncate text-[11px] font-semibold text-[var(--muted)]">
					{evidence.facebookUsername
						? `Fanpage @${evidence.facebookUsername}`
						: evidence.sourceLabel ?? providerLabel(evidence.provider)}
					{evidence.facebookPageId ? ` - Facebook ID ${evidence.facebookPageId}` : ""}
				</p>
				<div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
					{evidence.topicSlugs.slice(0, 3).map((slug) => (
						<Link
							key={slug}
							href={`/topics/${slug}`}
							className="max-w-full truncate rounded-md bg-[var(--accent-soft)] px-2 py-1 text-[11px] font-bold text-[var(--accent-strong)]"
						>
							{slug}
						</Link>
					))}
					<Link
						href={evidence.scanHref}
						className="max-w-full truncate rounded-md bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-bold text-[var(--accent-strong)]"
					>
						Mở scan
					</Link>
					{evidence.originalPostHref ? (
						<a
							href={evidence.originalPostHref}
							target="_blank"
							rel="noreferrer"
							className="max-w-full truncate rounded-md bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-bold text-[var(--accent-strong)]"
						>
							Bài gốc
						</a>
					) : null}
				</div>
			</div>
			{compact ? null : (
				<div className="min-w-0 text-[11px] font-semibold text-[var(--muted)]">
					<p className="truncate">{evidence.sourceLabel ?? providerLabel(evidence.provider)}</p>
					<p className="mt-1 truncate">{formatDate(evidence.createdAt)}</p>
					<Link href={evidence.scanHref} className="mt-1 inline-flex text-[var(--accent-strong)]">
						Chi tiết scan <ArrowRight size={12} />
					</Link>
				</div>
			)}
			<RiskPill risk={evidence.riskLevel} />
		</div>
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
				<Link
					href={claim.deepLink}
					className="line-clamp-2 text-[13px] font-bold leading-5 text-[var(--foreground)] hover:text-[var(--accent-strong)]"
				>
					{claim.claim}
				</Link>
				<p className="mt-1 truncate text-[11px] font-semibold text-[var(--muted)]">
					{claim.evidenceCount} bằng chứng - {claim.stance} - {claim.sourceLabels.slice(0, 2).join(", ") || "chưa có nguồn"}
				</p>
				<div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
					{claim.evidenceHrefs.slice(0, 3).map((href, index) => (
						<Link
							key={href}
							href={href}
							className="max-w-full truncate rounded-md bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-bold text-[var(--accent-strong)]"
						>
							Bằng chứng {index + 1}
						</Link>
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
				<Link
					href={source.href}
					className="truncate text-[13px] font-bold text-[var(--foreground)] hover:text-[var(--accent-strong)]"
				>
					{source.sourceLabel}
				</Link>
				<p className="mt-1 truncate text-[11px] font-semibold text-[var(--muted)]">
					{source.evidenceCount} bằng chứng - {source.failedScanCount} lỗi - {providerLabel(source.provider)}
				</p>
				<div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
					<Link
						href={`/evidence?facebookPage=${encodeURIComponent(source.sourceLabel)}`}
						className="max-w-full truncate rounded-md bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-bold text-[var(--accent-strong)]"
					>
						Xem bài viết
					</Link>
					{source.lastScanHref ? (
						<Link
							href={source.lastScanHref}
							className="max-w-full truncate rounded-md bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-bold text-[var(--accent-strong)]"
						>
							Scan gần nhất
						</Link>
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

function ActivityRow({ event }: { event: IntelligenceActivityRow }) {
	return (
		<Link
			href={event.href}
			className="grid min-w-0 gap-3 px-4 py-3 transition hover:bg-[var(--surface-soft)] sm:grid-cols-[160px_minmax(0,1fr)_90px] sm:items-center"
		>
			<p className="truncate text-[11px] font-semibold text-[var(--muted)]">
				{formatDate(event.occurredAt)}
			</p>
			<div className="min-w-0">
				<p className="truncate text-[13px] font-bold text-[var(--foreground)]">
					{event.title}
				</p>
				<p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[var(--muted)]">
					{event.description}
				</p>
			</div>
			<RiskPill risk={event.severity} />
		</Link>
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
				<p className="truncate text-[11px] font-bold text-[var(--muted)]">{label}</p>
				<p className="mt-2 truncate text-[22px] font-bold text-[var(--foreground)]">
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

function LoadMoreRow({
	isFetching,
	onClick,
}: {
	isFetching: boolean;
	onClick: () => void;
}) {
	return (
		<div className="flex justify-center p-4">
			<button
				type="button"
				disabled={isFetching}
				onClick={onClick}
				className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-[12px] font-bold text-[var(--muted-strong)] hover:bg-[var(--surface-soft)] disabled:opacity-60"
			>
				<RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
				{isFetching ? "Đang tải..." : "Tải thêm"}
			</button>
		</div>
	);
}

function EmptyRow({ text }: { text: string }) {
	return (
		<div className="px-4 py-6 text-[12px] font-semibold text-[var(--muted)]">
			{text}
		</div>
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

function useIntelligenceFiltersFromUrl(): [
	IntelligenceFilters,
	(key: keyof IntelligenceFilters, value: string) => void,
] {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const filters = useMemo<IntelligenceFilters>(
		() => ({
			facebookPage: searchParams.get("facebookPage") ?? undefined,
			provider: searchParams.get("provider") ?? undefined,
			query: searchParams.get("q") ?? undefined,
			risk: (searchParams.get("risk") as IntelligenceFilters["risk"]) ?? "all",
			source: searchParams.get("source") ?? undefined,
			status: searchParams.get("status") ?? undefined,
			timeRange:
				(searchParams.get("timeRange") as IntelligenceFilters["timeRange"]) ??
				"30d",
			topic: searchParams.get("topic") ?? undefined,
		}),
		[searchParams],
	);

	function setFilter(key: keyof IntelligenceFilters, value: string) {
		const next = new URLSearchParams(searchParams);
		const paramKey = key === "query" ? "q" : key;
		if (!value || value === "all") {
			next.delete(paramKey);
		} else {
			next.set(paramKey, value);
		}
		router.replace(`${pathname}?${next.toString()}`, { scroll: false });
	}

	return [filters, setFilter];
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

function providerLabel(provider?: string | null) {
	const labels: Record<string, string> = {
		apify_facebook_comments: "Apify bình luận",
		apify_facebook_groups: "Apify nhóm",
		apify_facebook_posts: "Apify bài viết",
		browser_use: "Browser Use",
		firecrawl: "Firecrawl",
		firecrawl_parse: "Firecrawl parse",
		local_text: "Văn bản nội bộ",
	};
	return provider ? (labels[provider] ?? provider) : "Chưa có provider";
}

function formatDate(value?: string | null) {
	if (!value) return "Chưa có";
	return new Intl.DateTimeFormat("vi-VN", {
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(new Date(value));
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
