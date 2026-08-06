"use client";

import {
	CalendarDays,
	CheckCheck,
	Download,
	List,
	RefreshCw,
	Search,
	SlidersHorizontal,
	X,
} from "lucide-react";
import { useEffect, useRef } from "react";

import type {
	IntelligenceFacebookPageOption,
	TimelineFilters,
	TimelinePost,
} from "@/components/dashboard/types";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { TimelineFacetCounts } from "@/lib/dashboard/client-queries";

import { TimelineFilterPanel } from "./timeline-filter-panel";
import {
	activeFilterEntries,
	inputClass,
	toolButtonClass,
} from "./timeline-utils";

/**
 * One row of controls, with the rest behind a single panel.
 *
 * Eleven dropdowns used to sit open across the page, so the common case —
 * search, sort, read the results — competed for attention with filters nobody
 * had touched. What is actually applied now reads as chips, each clearing only
 * itself.
 */
export function TimelineToolbar({
	advancedOpen,
	exportHref,
	facets,
	filters,
	isPending,
	loadedNewCount,
	onClearFilters,
	onMarkSeen,
	onParamChange,
	onRefresh,
	onToggleAdvanced,
	pages,
	posts,
	refreshing,
	total,
	view,
}: {
	advancedOpen: boolean;
	exportHref: string;
	facets: TimelineFacetCounts | undefined;
	filters: TimelineFilters;
	isPending: boolean;
	loadedNewCount: number;
	onClearFilters: () => void;
	onMarkSeen: () => void;
	onParamChange: (key: string, value: string, push?: boolean) => void;
	onRefresh: () => void;
	onToggleAdvanced: (open: boolean) => void;
	pages: IntelligenceFacebookPageOption[];
	posts: TimelinePost[];
	refreshing: boolean;
	total: number;
	view: "list" | "timeline";
}) {
	const queryTimer = useRef<number | null>(null);
	const activeFilters = activeFilterEntries(filters);

	useEffect(
		() => () => {
			if (queryTimer.current !== null) window.clearTimeout(queryTimer.current);
		},
		[],
	);

	return (
		<div className="sticky top-2 z-20 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 p-3 shadow-[var(--shadow-soft)] backdrop-blur">
			<div className="flex flex-col gap-2 xl:flex-row xl:items-center">
				<div
					aria-label="Kiểu hiển thị"
					className="inline-flex h-10 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-1"
				>
					<ViewButton
						active={view === "timeline"}
						icon={CalendarDays}
						label="Dòng thời gian"
						onClick={() => onParamChange("view", "", true)}
					/>
					<ViewButton
						active={view === "list"}
						icon={List}
						label="Danh sách"
						onClick={() => onParamChange("view", "list", true)}
					/>
				</div>

				<label className="relative min-w-0 flex-1">
					<Search
						className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--muted)]"
						size={15}
					/>
					<input
						className={`${inputClass} pl-9`}
						defaultValue={filters.query ?? ""}
						key={filters.query ?? ""}
						onChange={(event) => {
							const value = event.target.value;
							if (queryTimer.current !== null) {
								window.clearTimeout(queryTimer.current);
							}
							queryTimer.current = window.setTimeout(
								() => onParamChange("q", value),
								250,
							);
						}}
						placeholder="Tìm nội dung, nguồn hoặc tác giả…"
					/>
				</label>

				<Select
					onValueChange={(value) => onParamChange("sort", value)}
					value={filters.sort ?? "published-desc"}
				>
					<SelectTrigger
						aria-label="Sắp xếp"
						className="h-10 shrink-0 text-xs font-semibold xl:w-52"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="published-desc">Mới đăng trước</SelectItem>
						<SelectItem value="collected-desc">Mới thu thập trước</SelectItem>
						<SelectItem value="published-asc">Cũ đăng trước</SelectItem>
						<SelectItem value="engagement-desc">Tương tác cao</SelectItem>
						<SelectItem value="risk-desc">Rủi ro cao</SelectItem>
						<SelectItem value="triage-updated-desc">
							Xử lý mới cập nhật
						</SelectItem>
					</SelectContent>
				</Select>

				<div className="flex shrink-0 gap-2">
					<Popover onOpenChange={onToggleAdvanced} open={advancedOpen}>
						<PopoverTrigger asChild>
							<button className={toolButtonClass} type="button">
								<SlidersHorizontal size={15} />
								<span className="hidden sm:inline">Bộ lọc</span>
								{activeFilters.length ? (
									<span className="grid size-5 place-items-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">
										{activeFilters.length}
									</span>
								) : null}
							</button>
						</PopoverTrigger>
						<PopoverContent align="end">
							<TimelineFilterPanel
								facets={facets}
								filters={filters}
								onParamChange={onParamChange}
								onReset={onClearFilters}
								pages={pages}
								posts={posts}
							/>
						</PopoverContent>
					</Popover>

					<button
						className={toolButtonClass}
						onClick={onRefresh}
						title="Làm mới"
						type="button"
					>
						<RefreshCw className={refreshing ? "animate-spin" : ""} size={15} />
						<span className="hidden sm:inline">Làm mới</span>
					</button>

					<a
						className={toolButtonClass}
						href={exportHref}
						title="Tải danh sách đang lọc"
					>
						<Download size={15} />
						<span className="hidden sm:inline">Tải về</span>
					</a>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-2 text-[11px]">
				<span className="font-bold text-[var(--muted-strong)]">
					{total.toLocaleString("vi-VN")} kết quả
				</span>
				{activeFilters.map(([key, label]) => (
					// Each chip clears only itself, so narrowing a search does not mean
					// rebuilding it from nothing.
					<button
						className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-2.5 font-bold text-[var(--accent-strong)] transition hover:bg-[var(--accent)]/20"
						key={key}
						onClick={() => onParamChange(key, "")}
						type="button"
					>
						{label}
						<X size={11} />
					</button>
				))}
				{activeFilters.length ? (
					<button
						className="font-bold text-[var(--danger-strong)]"
						onClick={onClearFilters}
						type="button"
					>
						Xóa tất cả
					</button>
				) : null}
				{loadedNewCount ? (
					<button
						className="ml-auto inline-flex items-center gap-1.5 font-bold text-[var(--muted-strong)] hover:text-[var(--foreground)]"
						onClick={onMarkSeen}
						type="button"
					>
						<CheckCheck size={13} /> Đánh dấu đã xem
					</button>
				) : null}
				{isPending ? (
					<span className="text-[var(--muted)]">Đang cập nhật…</span>
				) : null}
			</div>
		</div>
	);
}

function ViewButton({
	active,
	icon: Icon,
	label,
	onClick,
}: {
	active: boolean;
	icon: typeof List;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			aria-pressed={active}
			className={`inline-flex items-center gap-1.5 rounded px-2.5 text-xs font-bold ${
				active
					? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
					: "text-[var(--muted)]"
			}`}
			onClick={onClick}
			type="button"
		>
			<Icon size={14} />
			{label}
		</button>
	);
}
