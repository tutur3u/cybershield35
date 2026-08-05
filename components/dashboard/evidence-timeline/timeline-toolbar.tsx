"use client";

import {
	CalendarDays,
	CheckCheck,
	Download,
	List,
	RefreshCw,
	Search,
	SlidersHorizontal,
	Zap,
} from "lucide-react";
import { useEffect, useRef } from "react";

import type {
	IntelligenceFacebookPageOption,
	TimelineFilters,
	TimelinePost,
} from "@/components/dashboard/types";

import {
	activeFilterEntries,
	filterLabelClass,
	inputClass,
	knownAssignees,
	toolButtonClass,
} from "./timeline-utils";

export function TimelineToolbar({
	advancedOpen,
	exportHref,
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
	filters: TimelineFilters;
	isPending: boolean;
	loadedNewCount: number;
	onClearFilters: () => void;
	onMarkSeen: () => void;
	onParamChange: (key: string, value: string, push?: boolean) => void;
	onRefresh: () => void;
	onToggleAdvanced: () => void;
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
					className="inline-flex h-10 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-1"
					aria-label="Kiểu hiển thị"
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
						size={15}
						className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
					/>
					<input
						key={filters.query ?? ""}
						defaultValue={filters.query ?? ""}
						onChange={(event) => {
							const value = event.target.value;
							if (queryTimer.current !== null) window.clearTimeout(queryTimer.current);
							queryTimer.current = window.setTimeout(
								() => onParamChange("q", value),
								250,
							);
						}}
						placeholder="Tìm nội dung, nguồn hoặc tác giả…"
						className={`${inputClass} pl-9`}
					/>
				</label>
				<select
					aria-label="Sắp xếp"
					value={filters.sort ?? "published-desc"}
					onChange={(event) => onParamChange("sort", event.target.value)}
					className={`${inputClass} xl:w-56`}
				>
					<option value="published-desc">Mới đăng trước</option>
					<option value="collected-desc">Mới thu thập trước</option>
					<option value="published-asc">Cũ đăng trước</option>
					<option value="engagement-desc">Tương tác cao</option>
					<option value="risk-desc">Rủi ro cao</option>
					<option value="triage-updated-desc">Xử lý mới cập nhật</option>
				</select>
				<div className="flex shrink-0 gap-2">
					<ToolButton
						active={advancedOpen}
						icon={SlidersHorizontal}
						label="Bộ lọc"
						onClick={onToggleAdvanced}
					/>
					<ToolButton
						icon={RefreshCw}
						label="Làm mới"
						onClick={onRefresh}
						spinning={refreshing}
					/>
					<a href={exportHref} className={toolButtonClass} title="Tải danh sách đang lọc">
						<Download size={15} />
						<span className="hidden sm:inline">Tải về</span>
					</a>
				</div>
			</div>

			{advancedOpen ? (
				<div className="grid gap-2 border-t border-[var(--border)] pt-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
					<FilterSelect
						label="Khoảng thời gian"
						onChange={(value) => onParamChange("timeRange", value)}
						options={[
							["all", "Tất cả"],
							["7d", "7 ngày qua"],
							["30d", "30 ngày qua"],
							["90d", "90 ngày qua"],
						]}
						value={filters.timeRange ?? "all"}
					/>
					<FilterSelect
						label="Trang theo dõi"
						onChange={(value) => onParamChange("facebookPage", value)}
						options={[
							["", "Tất cả trang"],
							...pages.map((page) => [page.value, page.label] as [string, string]),
						]}
						value={filters.facebookPage ?? ""}
					/>
					<FilterSelect
						label="Loại nội dung"
						onChange={(value) => onParamChange("provider", value)}
						options={[
							["", "Tất cả"],
							["apify_facebook_posts", "Bài viết Facebook"],
							["apify_facebook_comments", "Bình luận Facebook"],
							["apify_facebook_groups", "Nhóm Facebook"],
							["firecrawl", "Trang web"],
							["browser_use", "Trang web công khai"],
							["local_text", "Văn bản nội bộ"],
						]}
						value={filters.provider ?? ""}
					/>
					<FilterSelect
						label="Mức rủi ro"
						onChange={(value) => onParamChange("risk", value)}
						options={[
							["all", "Mọi mức"],
							["high", "Cao"],
							["medium", "Trung bình"],
							["low", "Thấp"],
						]}
						value={filters.risk ?? "all"}
					/>
					<FilterSelect
						label="Sắc thái"
						onChange={(value) => onParamChange("sentiment", value)}
						options={[
							["", "Mọi sắc thái"],
							["positive", "Tích cực"],
							["neutral", "Trung tính"],
							["negative", "Tiêu cực"],
						]}
						value={filters.sentiment ?? ""}
					/>
					<FilterSelect
						label="Lập trường"
						onChange={(value) => onParamChange("stance", value)}
						options={[
							["", "Mọi lập trường"],
							["supportive", "Ủng hộ"],
							["neutral", "Trung lập"],
							["opposed", "Phản đối"],
						]}
						value={filters.stance ?? ""}
					/>
					<FilterSelect
						label="Trạng thái xử lý"
						onChange={(value) => onParamChange("triageStatus", value)}
						options={[
							["all", "Mọi trạng thái"],
							["new", "Mới"],
							["reviewing", "Đang xem xét"],
							["action_required", "Cần hành động"],
							["resolved", "Đã giải quyết"],
							["dismissed", "Bỏ qua"],
						]}
						value={filters.triageStatus ?? "all"}
					/>
					<FilterSelect
						label="Phân công"
						onChange={(value) => onParamChange("assignee", value)}
						options={[
							["", "Mọi người"],
							["unassigned", "Chưa phân công"],
							...knownAssignees(posts),
						]}
						value={filters.assignee ?? ""}
					/>
					<FilterSelect
						label="Ghim đội ngũ"
						onChange={(value) => onParamChange("isPinned", value)}
						options={[
							["", "Tất cả"],
							["true", "Đã ghim"],
							["false", "Chưa ghim"],
						]}
						value={filters.isPinned === undefined ? "" : String(filters.isPinned)}
					/>
					<FilterSelect
						label="Hạn xử lý"
						onChange={(value) => onParamChange("due", value)}
						options={[
							["all", "Mọi hạn"],
							["overdue", "Quá hạn"],
							["today", "Hôm nay"],
							["none", "Không có hạn"],
						]}
						value={filters.due ?? "all"}
					/>
					<label className="space-y-1">
						<span className={filterLabelClass}>Từ ngày</span>
						<input
							type="date"
							value={filters.dateFrom ?? ""}
							onChange={(event) => onParamChange("dateFrom", event.target.value)}
							className={inputClass}
						/>
					</label>
					<label className="space-y-1">
						<span className={filterLabelClass}>Đến ngày</span>
						<input
							type="date"
							value={filters.dateTo ?? ""}
							onChange={(event) => onParamChange("dateTo", event.target.value)}
							className={inputClass}
						/>
					</label>
					<label className="space-y-1">
						<span className={filterLabelClass}>Chủ đề</span>
						<input
							value={filters.topic ?? ""}
							onChange={(event) => onParamChange("topic", event.target.value)}
							placeholder="Tên chủ đề"
							className={inputClass}
						/>
					</label>
				</div>
			) : null}

			<div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3 text-xs">
				<span className="font-bold text-[var(--foreground)]">
					{total.toLocaleString("vi-VN")} kết quả
				</span>
				{loadedNewCount ? (
					<span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 font-bold text-[var(--accent-strong)]">
						<Zap size={12} /> {loadedNewCount.toLocaleString("vi-VN")} bài mới thu thập
					</span>
				) : null}
				{activeFilters.map(([key, label]) => (
					<button
						key={key}
						type="button"
						onClick={() => onParamChange(key, "")}
						className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 font-bold text-[var(--accent-strong)]"
					>
						{label} ×
					</button>
				))}
				{activeFilters.length ? (
					<button
						type="button"
						onClick={onClearFilters}
						className="font-bold text-[var(--danger-strong)]"
					>
						Xóa tất cả
					</button>
				) : null}
				{loadedNewCount ? (
					<button
						type="button"
						onClick={onMarkSeen}
						className="ml-auto inline-flex items-center gap-1.5 font-bold text-[var(--muted-strong)] hover:text-[var(--foreground)]"
					>
						<CheckCheck size={13} /> Đánh dấu đã xem
					</button>
				) : null}
				{isPending ? <span className="text-[var(--muted)]">Đang cập nhật…</span> : null}
			</div>
		</div>
	);
}

function FilterSelect({
	label,
	onChange,
	options,
	value,
}: {
	label: string;
	onChange: (value: string) => void;
	options: [string, string][];
	value: string;
}) {
	return (
		<label className="space-y-1">
			<span className={filterLabelClass}>{label}</span>
			<select
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className={inputClass}
			>
				{options.map(([key, text]) => (
					<option key={key || "all"} value={key}>
						{text}
					</option>
				))}
			</select>
		</label>
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
			type="button"
			aria-pressed={active}
			onClick={onClick}
			className={`inline-flex items-center gap-1.5 rounded px-2.5 text-xs font-bold ${
				active
					? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
					: "text-[var(--muted)]"
			}`}
		>
			<Icon size={14} />
			{label}
		</button>
	);
}

function ToolButton({
	active = false,
	icon: Icon,
	label,
	onClick,
	spinning = false,
}: {
	active?: boolean;
	icon: typeof List;
	label: string;
	onClick: () => void;
	spinning?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`${toolButtonClass} ${
				active ? "border-[var(--accent)] text-[var(--accent-strong)]" : ""
			}`}
			title={label}
		>
			<Icon size={15} className={spinning ? "animate-spin" : ""} />
			<span className="hidden sm:inline">{label}</span>
		</button>
	);
}
