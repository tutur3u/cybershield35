"use client";

import {
	Activity,
	ArrowDownAZ,
	ChevronDown,
	Filter,
	Radar,
	RefreshCw,
	Search,
	ShieldAlert,
} from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import {
	type ComponentType,
	useEffect,
	useMemo,
	useRef,
	useTransition,
} from "react";
import { useQuery } from "@tanstack/react-query";

import { DashboardTooltip } from "@/components/dashboard/ui-primitives";
import type {
	IntelligenceFacebookPageOption,
	IntelligenceFilters,
} from "@/components/dashboard/types";
import { intelligenceFacebookPagesQueryOptions } from "@/lib/dashboard/client-queries";
import { defaultIntelligenceFilters } from "@/lib/dashboard/query-keys";

export function IntelligenceFilterBar({
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
	const queryDebounceRef = useRef<number | null>(null);
	const facebookPagesQuery = useQuery(intelligenceFacebookPagesQueryOptions());
	const facebookPageOptions = facebookPageSelectOptions(
		facebookPagesQuery.data ?? [],
	);

	useEffect(
		() => () => {
			if (queryDebounceRef.current !== null) {
				window.clearTimeout(queryDebounceRef.current);
			}
		},
		[],
	);

	return (
		<div className="grid min-w-0 gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-soft)] md:grid-cols-2 xl:grid-cols-[minmax(180px,1.2fr)_repeat(6,minmax(126px,0.75fr))]">
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
						if (queryDebounceRef.current !== null) {
							window.clearTimeout(queryDebounceRef.current);
						}
						queryDebounceRef.current = window.setTimeout(() => {
							startTransition(() => setFilter("query", value));
						}, 250);
					}}
					placeholder="Tìm claim, bằng chứng, nguồn..."
					className="h-10 w-full min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] pl-9 pr-3 text-[12px] font-semibold text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
				/>
			</label>
			<FilterSelect
				icon={ArrowDownAZ}
				label="Sắp xếp"
				value={filters.order ?? "newest"}
				onChange={(value) => setFilter("order", value)}
				options={[["newest", "Mới nhất"], ["oldest", "Cũ nhất"]]}
				help="Sắp xếp kết quả theo thời điểm quan sát hoặc cập nhật."
			/>
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

export function LoadMoreRow({
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

export function EmptyRow({ text }: { text: string }) {
	return (
		<div className="px-4 py-6 text-[12px] font-semibold text-[var(--muted)]">
			{text}
		</div>
	);
}

export function useIntelligenceFiltersFromUrl(): [
	IntelligenceFilters,
	(key: keyof IntelligenceFilters, value: string) => void,
] {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const filters = useMemo<IntelligenceFilters>(
		() => ({
			facebookPage: searchParams.get("facebookPage") ?? undefined,
			provider: searchParams.get("provider") ?? undefined,
			query: searchParams.get("q") ?? undefined,
			risk:
				(searchParams.get("risk") as IntelligenceFilters["risk"]) ??
				defaultIntelligenceFilters.risk,
			source: searchParams.get("source") ?? undefined,
			status: searchParams.get("status") ?? undefined,
			timeRange:
				(searchParams.get("timeRange") as IntelligenceFilters["timeRange"]) ??
				defaultIntelligenceFilters.timeRange,
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
		const query = next.toString();
		window.history.replaceState(
			null,
			"",
			query ? `${pathname}?${query}` : pathname,
		);
	}

	return [filters, setFilter];
}

export function intelligenceProviderLabel(provider?: string | null) {
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

export function formatIntelligenceDate(value?: string | null) {
	if (!value) return "Chưa có";
	return new Intl.DateTimeFormat("vi-VN", {
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(new Date(value));
}
