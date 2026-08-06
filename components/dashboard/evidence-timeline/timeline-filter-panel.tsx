"use client";

import { RotateCcw } from "lucide-react";

import type {
	IntelligenceFacebookPageOption,
	TimelineFilters,
	TimelinePost,
} from "@/components/dashboard/types";
import type { TimelineFacetCounts } from "@/lib/dashboard/client-queries";
import {
	EVIDENCE_RISK_LEVEL_LABELS,
	EVIDENCE_SENTIMENT_LABELS,
	EVIDENCE_STANCE_LABELS,
	EVIDENCE_TRIAGE_LABELS,
	optionsFrom,
} from "@/lib/domain/evidence-classification";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

import { knownAssignees } from "./timeline-utils";

type Counts = Record<string, number> | undefined;

/**
 * Every filter, in one panel, each option carrying what it would return.
 *
 * The previous surface laid eleven native dropdowns across the page with no
 * indication which had anything behind them — so picking one that returned
 * nothing was indistinguishable from a broken filter, which is what customers
 * reported. Counts come from the same conditions the list runs, computed
 * against the other active filters, so "0" is a fact about the data rather than
 * a suspicion about the software.
 */
export function TimelineFilterPanel({
	facets,
	filters,
	onParamChange,
	onReset,
	pages,
	posts,
}: {
	facets: TimelineFacetCounts | undefined;
	filters: TimelineFilters;
	onParamChange: (key: string, value: string) => void;
	onReset: () => void;
	pages: IntelligenceFacebookPageOption[];
	posts: TimelinePost[];
}) {
	const assignees = knownAssignees(posts);

	return (
		<div className="w-[min(92vw,44rem)] space-y-4">
			<div className="flex items-center justify-between gap-3">
				<p className="text-[12px] font-bold text-[var(--foreground)]">
					Bộ lọc nâng cao
				</p>
				<button
					className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[11px] font-bold text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]"
					onClick={onReset}
					type="button"
				>
					<RotateCcw size={12} /> Đặt lại
				</button>
			</div>

			<div className="grid gap-3 sm:grid-cols-2">
				<FilterField
					counts={facets?.risk}
					label="Mức rủi ro"
					onChange={(value) => onParamChange("risk", value)}
					options={[
						["all", "Mọi mức"],
						...optionsFrom(EVIDENCE_RISK_LEVEL_LABELS),
					]}
					value={filters.risk ?? "all"}
				/>
				<FilterField
					counts={facets?.triageStatus}
					label="Trạng thái xử lý"
					onChange={(value) => onParamChange("triageStatus", value)}
					options={[
						["all", "Mọi trạng thái"],
						...optionsFrom(EVIDENCE_TRIAGE_LABELS),
					]}
					value={filters.triageStatus ?? "all"}
				/>
				<FilterField
					counts={facets?.sentiment}
					label="Sắc thái"
					onChange={(value) => onParamChange("sentiment", value)}
					options={[
						["all", "Mọi sắc thái"],
						...optionsFrom(EVIDENCE_SENTIMENT_LABELS),
					]}
					value={filters.sentiment ?? "all"}
				/>
				<FilterField
					counts={facets?.stance}
					label="Lập trường"
					onChange={(value) => onParamChange("stance", value)}
					options={[
						["all", "Mọi lập trường"],
						...optionsFrom(EVIDENCE_STANCE_LABELS),
					]}
					value={filters.stance ?? "all"}
				/>
				<FilterField
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
				<FilterField
					label="Hạn xử lý"
					onChange={(value) => onParamChange("due", value)}
					options={[
						["all", "Mọi hạn"],
						["overdue", "Quá hạn"],
						["today", "Hạn hôm nay"],
						["none", "Không có hạn"],
					]}
					value={filters.due ?? "all"}
				/>
				<FilterField
					label="Trang theo dõi"
					onChange={(value) => onParamChange("facebookPage", value)}
					options={[
						["all", "Tất cả trang"],
						...pages.map(
							(page) => [page.value, page.label] as [string, string],
						),
					]}
					value={filters.facebookPage ?? "all"}
				/>
				<FilterField
					label="Loại nội dung"
					onChange={(value) => onParamChange("provider", value)}
					options={[
						["all", "Tất cả"],
						["apify_facebook_posts", "Bài viết Facebook"],
						["apify_facebook_comments", "Bình luận Facebook"],
						["apify_facebook_groups", "Nhóm Facebook"],
						["firecrawl", "Trang web"],
						["browser_use", "Trang web công khai"],
						["local_text", "Văn bản nội bộ"],
					]}
					value={filters.provider ?? "all"}
				/>
				<FilterField
					label="Phân công"
					onChange={(value) => onParamChange("assignee", value)}
					options={[
						["all", "Mọi người"],
						["unassigned", "Chưa phân công"],
						...assignees,
					]}
					value={filters.assignee ?? "all"}
				/>
				<FilterField
					label="Ghim đội ngũ"
					onChange={(value) => onParamChange("isPinned", value)}
					options={[
						["all", "Tất cả"],
						["true", "Đã ghim"],
						["false", "Chưa ghim"],
					]}
					value={
						filters.isPinned === undefined ? "all" : String(filters.isPinned)
					}
				/>
				<div className="space-y-1.5">
					<span className="block text-[11px] font-bold text-[var(--muted)]">
						Chủ đề
					</span>
					<input
						className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-semibold text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
						defaultValue={filters.topic ?? ""}
						onBlur={(event) => onParamChange("topic", event.target.value.trim())}
						placeholder="Tên chủ đề"
					/>
				</div>
			</div>

			<div className="grid gap-3 sm:grid-cols-2">
				<DateField
					label="Từ ngày"
					onChange={(value) => onParamChange("dateFrom", value)}
					value={filters.dateFrom ?? ""}
				/>
				<DateField
					label="Đến ngày"
					onChange={(value) => onParamChange("dateTo", value)}
					value={filters.dateTo ?? ""}
				/>
			</div>
		</div>
	);
}

function FilterField({
	counts,
	label,
	onChange,
	options,
	value,
}: {
	counts?: Counts;
	label: string;
	onChange: (value: string) => void;
	options: [string, string][];
	value: string;
}) {
	return (
		<div className="min-w-0 space-y-1.5">
			<span className="block text-[11px] font-bold text-[var(--muted)]">
				{label}
			</span>
			<Select onValueChange={onChange} value={value}>
				<SelectTrigger className="h-10 w-full text-[12px] font-semibold">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map(([key, text]) => {
						const count = key === "all" ? undefined : counts?.[key];
						return (
							<SelectItem key={key} value={key}>
								<span className="flex w-full items-center justify-between gap-3">
									<span>{text}</span>
									{count === undefined ? null : (
										// A zero here is the data speaking, not the filter failing.
										<span
											className={
												count === 0
													? "text-[10px] font-bold text-[var(--muted)]"
													: "text-[10px] font-bold text-[var(--muted-strong)]"
											}
										>
											{count.toLocaleString("vi-VN")}
										</span>
									)}
								</span>
							</SelectItem>
						);
					})}
				</SelectContent>
			</Select>
		</div>
	);
}

function DateField({
	label,
	onChange,
	value,
}: {
	label: string;
	onChange: (value: string) => void;
	value: string;
}) {
	return (
		<div className="space-y-1.5">
			<span className="block text-[11px] font-bold text-[var(--muted)]">
				{label}
			</span>
			<input
				className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-semibold text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
				onChange={(event) => onChange(event.target.value)}
				type="date"
				value={value}
			/>
		</div>
	);
}
