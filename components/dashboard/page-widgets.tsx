import {
	Activity,
	ArrowRight,
	BarChart3,
	Edit3,
	Play,
	Sparkles,
	Trash2,
} from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";

import { providerRows } from "@/components/dashboard/dashboard-data";
import { IntentPrefetchLink } from "@/components/dashboard/intent-prefetch-link";
import type {
	AnalysisView,
	DashboardScan,
	DashboardScansPage,
	DraftShape,
	ProviderAvailabilityView,
} from "@/components/dashboard/types";
import { dashboardScansInfiniteQueryOptions } from "@/lib/dashboard/client-queries";
import type { DashboardInsight } from "@/lib/dashboard/insights";
import {
	Panel,
	PanelHeader,
	ProgressBar,
	RiskPill,
	SecondaryButton,
	StatusPill,
} from "@/components/dashboard/ui-primitives";

export { PageHeader } from "@/components/dashboard/page-header";

export function MetricGrid({ scans }: { scans: DashboardScan[] }) {
	const stats = [
		{ label: "Đang chờ", value: countScans(scans, "queued"), tone: "neutral" },
		{ label: "Đang quét", value: countScans(scans, "running"), tone: "warning" },
		{ label: "Hoàn tất", value: countScans(scans, "completed"), tone: "success" },
		{ label: "Lỗi", value: countScans(scans, "failed"), tone: "danger" },
	];

	return (
		<div className="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4">
			{stats.map((stat) => (
				<Panel key={stat.label} className="h-full">
					<div className="p-4">
						<p className={`text-[26px] font-bold ${statColor(stat.tone)}`}>
							{stat.value.toLocaleString("vi-VN")}
						</p>
						<p className="mt-1 text-[12px] font-semibold text-[var(--muted)]">
							{stat.label}
						</p>
					</div>
				</Panel>
			))}
		</div>
	);
}

export function InsightGrid({ insights }: { insights: DashboardInsight[] }) {
	const icons = [Activity, BarChart3, Sparkles, ArrowRight];

	return (
		<div className="grid items-stretch gap-3 md:grid-cols-2 xl:grid-cols-4">
			{insights.map((insight, index) => {
				const Icon = icons[index % icons.length] ?? Activity;
				const content = (
					<Panel className="h-full transition hover:border-[var(--border-strong)]">
						<div className="flex h-full min-w-0 flex-col gap-3 p-4">
							<div className="flex min-w-0 items-start justify-between gap-3">
								<span
									className={`grid size-9 shrink-0 place-items-center rounded-md ${insightToneClass(
										insight.tone,
									)}`}
								>
									<Icon size={17} />
								</span>
								<span className="min-w-0 rounded-md bg-[var(--surface-soft)] px-2 py-1 text-right text-[11px] font-bold leading-4 text-[var(--foreground)]">
									{insight.value}
								</span>
							</div>
							<div className="min-w-0">
								<p className="text-[13px] font-bold text-[var(--foreground)]">
									{insight.label}
								</p>
								<p className="mt-1 break-words text-[12px] leading-5 text-[var(--muted)]">
									{insight.body}
								</p>
							</div>
						</div>
					</Panel>
				);

				return insight.href ? (
					<IntentPrefetchLink
						key={insight.label}
						href={insight.href}
						className="block min-w-0"
					>
						{content}
					</IntentPrefetchLink>
				) : (
					<div key={insight.label} className="min-w-0">
						{content}
					</div>
				);
			})}
		</div>
	);
}

export function QueueCard({
	enableInfinite = false,
	limit,
	onDeleteScan,
	onEditScan,
	onRunScan,
	onSelectScan,
	scans,
	selectedScanId,
}: {
	enableInfinite?: boolean;
	limit?: number;
	onDeleteScan?: (scan: DashboardScan) => Promise<void>;
	onEditScan?: (scan: DashboardScan) => void;
	onRunScan?: (scan: DashboardScan) => Promise<void>;
	onSelectScan: (id: string) => void;
	scans: DashboardScan[];
	selectedScanId: string;
}) {
	const pageSize = limit ?? 8;
	const scansQuery = useInfiniteQuery({
		...dashboardScansInfiniteQueryOptions(pageSize),
		enabled: enableInfinite,
		initialData:
			enableInfinite && scans.length
				? initialScansPage(scans, pageSize)
				: undefined,
	});
	const loadedScans = enableInfinite
		? (scansQuery.data?.pages.flatMap((page) => page.items) ?? scans)
		: scans;
	const visible = enableInfinite ? loadedScans : limit ? scans.slice(0, limit) : scans;

	return (
		<Panel className="h-full">
			<PanelHeader
				title="Hàng đợi quét"
				description="Chọn một scan để xem phân tích, bằng chứng và bản nháp."
			/>
			<div className="divide-y divide-[var(--divider)]">
				{visible.length ? (
					visible.map((scan) => (
						<div
							key={scan.id}
							className={`grid min-h-16 w-full gap-3 px-4 py-3 text-left transition sm:grid-cols-[minmax(0,1fr)_96px_96px_auto] sm:items-center ${
								selectedScanId === scan.id
									? "bg-[var(--accent-soft)]"
									: "hover:bg-[var(--surface-soft)]"
							}`}
						>
								<IntentPrefetchLink
								href={`/scans/${scan.id}`}
								onClick={() => onSelectScan(scan.id)}
								className="min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
							>
								<p className="truncate text-[13px] font-bold text-[var(--foreground)]">
									{scan.title}
								</p>
								<p className="mt-1 truncate text-[11px] text-[var(--muted)]">
									{scan.sourceLabel} - {providerLabel(scan.provider)}
								</p>
								</IntentPrefetchLink>
							<StatusPill status={scan.status} />
							<div className="min-w-0 text-[11px] font-semibold text-[var(--muted)] sm:text-right">
								{scan.progress}%
								<div className="mt-1">
									<ProgressBar value={scan.progress} />
								</div>
							</div>
							{onRunScan || onEditScan || onDeleteScan ? (
								<div className="flex gap-2 sm:justify-end">
									{onRunScan ? (
										<button
											type="button"
											disabled={!canRunScan(scan)}
											onClick={() => void onRunScan(scan)}
											className="grid size-9 place-items-center rounded-md border border-[var(--border)] text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-50"
											aria-label="Chạy scan ngay"
											title="Chạy scan ngay"
										>
											<Play size={14} />
										</button>
									) : null}
									{onEditScan ? (
										<button
											type="button"
											onClick={() => onEditScan(scan)}
											className="grid size-9 place-items-center rounded-md border border-[var(--border)] text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]"
											aria-label="Chỉnh scan"
										>
											<Edit3 size={14} />
										</button>
									) : null}
									{onDeleteScan ? (
										<button
											type="button"
											onClick={() => void onDeleteScan(scan)}
											className="grid size-9 place-items-center rounded-md border border-[var(--danger-border)] text-[var(--danger-strong)] transition hover:bg-[var(--danger-soft)]"
											aria-label="Xóa scan"
										>
											<Trash2 size={14} />
										</button>
									) : null}
								</div>
							) : null}
						</div>
					))
				) : (
					<p className="px-4 py-5 text-[12px] font-semibold text-[var(--muted)]">
						Chưa có scan live. Tạo scan mới để bắt đầu thu thập.
					</p>
				)}
			</div>
			{enableInfinite ? (
				<div className="border-t border-[var(--border)] p-3">
					<button
						type="button"
						disabled={!scansQuery.hasNextPage || scansQuery.isFetchingNextPage}
						onClick={() => void scansQuery.fetchNextPage()}
						className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-60"
					>
						{scansQuery.isFetchingNextPage
							? "Đang tải thêm..."
							: scansQuery.hasNextPage
								? "Tải thêm scan"
								: "Đã tải hết scan"}
					</button>
				</div>
			) : null}
		</Panel>
	);
}

export function ProviderStatus({
	availability,
}: {
	availability?: ProviderAvailabilityView;
}) {
	return (
		<Panel>
			<PanelHeader
				title="Adapter provider"
				description="Tất cả khóa provider phải được cấu hình bằng biến môi trường phía server."
			/>
			<div className="space-y-3 p-4">
				{providerRows.map((provider) => (
					<div
						key={provider.label}
						className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3"
					>
						<div className="flex items-center justify-between gap-3">
							<p className="min-w-0 truncate text-[13px] font-bold text-[var(--foreground)]">
								{provider.label}
							</p>
							<span
								className={`inline-flex h-6 min-w-12 shrink-0 items-center justify-center rounded-md px-2 text-center text-[10px] font-bold leading-none ${providerStatusStyle(
									providerStatus(provider.key, availability),
								)}`}
							>
								{providerStatusLabel(
									providerStatus(provider.key, availability),
								)}
							</span>
						</div>
						<p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
							{provider.helper}
						</p>
					</div>
				))}
			</div>
		</Panel>
	);
}

export function AnalysisSummary({
	analysis,
	className = "",
}: {
	analysis: AnalysisView;
	className?: string;
}) {
	return (
		<Panel className={className}>
			<PanelHeader title="Tóm tắt phân tích" />
			<div className="space-y-4 p-4">
				<p className="break-words text-[13px] leading-6 text-[var(--muted-strong)]">
					{analysis.summary}
				</p>
				<div className="flex flex-wrap gap-2">
					<RiskPill risk={analysis.riskLevel} />
					<span className="inline-flex min-h-6 max-w-full min-w-12 items-center justify-center rounded-md bg-[var(--accent-soft)] px-2.5 py-1 text-left text-[11px] font-bold leading-4 text-[var(--accent-strong)]">
						{analysis.stanceSummary}
					</span>
				</div>
			</div>
		</Panel>
	);
}

export function DraftSnapshot({
	draft,
	onOpenDraft,
	scanId,
}: {
	draft: DraftShape | null;
	onOpenDraft: () => void;
	scanId?: string;
}) {
	return (
		<Panel>
			<PanelHeader
				title="Bản nháp phản hồi"
				action={
					<SecondaryButton onClick={onOpenDraft}>
						<Sparkles size={14} /> Tạo mới
					</SecondaryButton>
				}
			/>
			<div className="p-4">
				{draft ? (
					<>
						<p className="overflow-hidden rounded-lg bg-[var(--surface-soft)] p-3 text-[13px] leading-6 break-words text-[var(--muted-strong)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:6]">
							{draft.body}
						</p>
						<p className="mt-3 text-[11px] font-semibold text-[var(--muted)]">
							Trạng thái: {draftStatusLabel(draft.status)}
						</p>
							<IntentPrefetchLink
							href={`/drafts/${draft.id}${scanId ? `?scanId=${scanId}` : ""}`}
							className="mt-3 inline-flex h-9 items-center rounded-md border border-[var(--border)] px-3 text-[12px] font-bold text-[var(--muted-strong)]"
						>
							Xem chi tiết
							</IntentPrefetchLink>
					</>
				) : (
					<p className="rounded-lg bg-[var(--surface-soft)] p-3 text-[13px] leading-6 text-[var(--muted-strong)]">
						Chưa có bản nháp live cho scan đang chọn.
					</p>
				)}
			</div>
		</Panel>
	);
}

function initialScansPage(scans: DashboardScan[], limit: number): {
	pageParams: Array<string | null>;
	pages: DashboardScansPage[];
} {
	const hasNextPage = scans.length > limit;
	return {
		pageParams: [null],
		pages: [
			{
				hasNextPage,
				items: scans.slice(0, limit),
				limit,
				nextCursor: hasNextPage ? String(limit) : null,
			},
		],
	};
}

function countScans(scans: DashboardScan[], status: DashboardScan["status"]) {
	return scans.filter((scan) => scan.status === status).length;
}

function canRunScan(scan: DashboardScan) {
	return scan.status !== "running";
}

function statColor(tone: string) {
	if (tone === "success") return "text-[var(--brand)]";
	if (tone === "danger") return "text-[var(--danger-strong)]";
	if (tone === "warning") return "text-[var(--warning-strong)]";
	return "text-[var(--foreground)]";
}

function insightToneClass(tone: DashboardInsight["tone"]) {
	if (tone === "success") return "bg-[var(--success-soft)] text-[var(--success-strong)]";
	if (tone === "danger") return "bg-[var(--danger-soft)] text-[var(--danger-strong)]";
	if (tone === "warning") return "bg-[var(--warning-soft)] text-[var(--warning-strong)]";
	return "bg-[var(--accent-soft)] text-[var(--accent-strong)]";
}

type ProviderStatusState = "server" | "missing";

function providerStatus(
	key: string,
	availability?: ProviderAvailabilityView,
): ProviderStatusState {
	if (key === "googleGenerativeAi") {
		if (availability?.llm) return "server";
		return "missing";
	}

	if (key === "apify") {
		if (availability?.apify) return "server";
		return "missing";
	}

	if (key === "firecrawl") {
		if (availability?.firecrawl) return "server";
		return "missing";
	}

	if (key === "browserUse") {
		if (availability?.browserUse) return "server";
		return "missing";
	}

	return "missing";
}

function providerStatusLabel(status: ProviderStatusState) {
	if (status === "server") return "Máy chủ";
	return "Thiếu";
}

function providerStatusStyle(status: ProviderStatusState) {
	if (status === "server") {
		return "bg-[var(--success-soft)] text-[var(--success-strong)]";
	}
	return "bg-[var(--neutral-soft)] text-[var(--muted-strong)]";
}

function providerLabel(provider: string) {
	if (provider.startsWith("apify")) return "Apify";
	if (provider.startsWith("firecrawl")) return "Firecrawl";
	if (provider === "browser_use") return "Browser Use";
	if (provider === "local_text") return "Văn bản nội bộ";
	return provider;
}

function draftStatusLabel(status?: string) {
	if (status === "approved") return "Đã duyệt";
	if (status === "rejected") return "Từ chối";
	return "Cần người duyệt";
}
