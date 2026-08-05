"use client";

import { Play } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";

import {
	intelligenceClaimsInfiniteQueryOptions,
	intelligenceSourcesInfiniteQueryOptions,
} from "@/lib/dashboard/client-queries";
import { IntentPrefetchLink } from "@/components/dashboard/intent-prefetch-link";
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
	IntelligenceHealthState,
	IntelligenceSourceRow,
} from "@/components/dashboard/types";
import {
	DashboardTooltip,
	Panel,
	PanelHeader,
	RiskPill,
} from "@/components/dashboard/ui-primitives";

/**
 * Claims that need a human check, each linked back to the content supporting it.
 * `standalone` adds the filter bar for pages that do not already render one.
 */
export function IntelligenceClaimsWorkspace({
	standalone = false,
}: {
	standalone?: boolean;
}) {
	const [filters, setFilter] = useIntelligenceFiltersFromUrl();
	const claimsQuery = useInfiniteQuery(
		intelligenceClaimsInfiniteQueryOptions(filters, 24),
	);
	const claims = claimsQuery.data?.pages.flatMap((page) => page.items) ?? [];

	return (
		<div className="space-y-5">
			{standalone ? (
				<IntelligenceFilterBar filters={filters} setFilter={setFilter} />
			) : null}
			<Panel>
				<PanelHeader
					title="Nhận định cần kiểm tra"
					description="Mỗi nhận định đi kèm mức tin cậy và các bài viết liên quan."
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
						<EmptyRow text="Chưa có nhận định phù hợp bộ lọc." />
					) : null}
				</div>
			</Panel>
		</div>
	);
}

export function IntelligenceSourcesWorkspace({
	onOpenScan,
	standalone = false,
}: {
	onOpenScan?: () => void;
	standalone?: boolean;
}) {
	const [filters, setFilter] = useIntelligenceFiltersFromUrl();
	const sourcesQuery = useInfiniteQuery(
		intelligenceSourcesInfiniteQueryOptions(filters, 24),
	);
	const sources = sourcesQuery.data?.pages.flatMap((page) => page.items) ?? [];

	return (
		<div className="space-y-5">
			{standalone ? (
				<IntelligenceFilterBar filters={filters} setFilter={setFilter} />
			) : null}
			<Panel>
				<PanelHeader
					title="Tình trạng nguồn"
					description="Độ mới, lỗi gần đây và lần cập nhật gần nhất của từng nguồn."
					action={
						onOpenScan ? (
							<button
								type="button"
								onClick={onOpenScan}
								className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-[12px] font-bold text-[var(--muted-strong)] hover:bg-[var(--surface-soft)]"
							>
								<Play size={14} /> Quét nguồn
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

function ClaimRow({ claim }: { claim: IntelligenceClaimRow }) {
	return (
		<div className="grid min-w-0 gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_120px_92px] sm:items-center">
			<div className="min-w-0">
				<IntentPrefetchLink
					href={claim.deepLink}
					className="line-clamp-2 text-[13px] font-bold leading-5 text-[var(--foreground)] hover:text-[var(--accent-strong)]"
				>
					{claim.claim}
				</IntentPrefetchLink>
				<p className="mt-1 truncate text-[11px] font-semibold text-[var(--muted)]">
					{claim.evidenceCount} nội dung liên quan · {stanceLabel(claim.stance)} ·{" "}
					{claim.sourceLabels.slice(0, 2).join(", ") || "chưa có nguồn"}
				</p>
				<div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
					{claim.evidenceHrefs.slice(0, 3).map((href, index) => (
						<IntentPrefetchLink
							key={href}
							href={href}
							className="max-w-full truncate rounded-md bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-bold text-[var(--accent-strong)]"
						>
							Dẫn chứng {index + 1}
						</IntentPrefetchLink>
					))}
				</div>
			</div>
			<DashboardTooltip content="Mức độ dữ liệu hiện có hỗ trợ trực tiếp cho nhận định này.">
				<span className="w-fit rounded-md bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-bold text-[var(--foreground)]">
					{claim.confidence}% tin cậy
				</span>
			</DashboardTooltip>
			<RiskPill risk={claim.riskLevel} />
		</div>
	);
}

function SourceRow({ source }: { source: IntelligenceSourceRow }) {
	return (
		<div className="grid min-w-0 gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_130px_110px] sm:items-center">
			<div className="min-w-0">
				<IntentPrefetchLink
					href={source.href}
					className="truncate text-[13px] font-bold text-[var(--foreground)] hover:text-[var(--accent-strong)]"
				>
					{source.sourceLabel}
				</IntentPrefetchLink>
				<p className="mt-1 truncate text-[11px] font-semibold text-[var(--muted)]">
					{source.evidenceCount} bài · {source.failedScanCount} lỗi ·{" "}
					{providerLabel(source.provider)}
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
							Lượt quét gần nhất
						</IntentPrefetchLink>
					) : null}
				</div>
			</div>
			<p className="truncate text-[11px] font-semibold text-[var(--muted)]">
				{source.lastScannedAt ? formatDate(source.lastScannedAt) : "Chưa từng quét"}
			</p>
			<HealthBadge health={source.health} />
		</div>
	);
}

function HealthBadge({ health }: { health: IntelligenceHealthState }) {
	const labels: Record<IntelligenceHealthState, string> = {
		attention: "Cần chú ý",
		blocked: "Bị chặn",
		healthy: "Ổn định",
		stale: "Đã cũ",
		unknown: "Không rõ",
		unseen: "Chưa quét",
	};
	const help: Record<IntelligenceHealthState, string> = {
		attention: "Đang cập nhật hoặc cần được kiểm tra thêm.",
		blocked: "Lần cập nhật gần đây gặp lỗi. Mở nguồn để thử lại.",
		healthy: "Gần đây có dữ liệu thành công.",
		stale: "Nguồn chưa có nội dung mới trong một khoảng thời gian.",
		unknown: "Chưa đủ dữ liệu để xác định trạng thái.",
		unseen: "Nguồn chưa có lần quét nào.",
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

function stanceLabel(stance: string) {
	const labels: Record<string, string> = {
		neutral: "trung lập",
		opposed: "phản biện",
		opposing: "phản biện",
		supported: "được củng cố",
		supporting: "được củng cố",
	};
	return labels[stance] ?? "đang đánh giá";
}
