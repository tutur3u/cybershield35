"use client";

import {
	ArrowDownRight,
	ArrowUpRight,
	Flame,
	Minus,
	ShieldAlert,
	Signal,
	TrendingDown,
	TrendingUp,
	type LucideIcon,
} from "lucide-react";

import { IntentPrefetchLink } from "@/components/dashboard/intent-prefetch-link";
import type {
	IntelligenceAnalyticsView,
	IntelligenceMomentumStat,
} from "@/components/dashboard/types";
import { DashboardTooltip } from "@/components/dashboard/ui-primitives";

/**
 * The four numbers worth reading before any chart.
 *
 * A level on its own is not information — "808 rủi ro cao" is only alarming or
 * reassuring next to what it was last period. Every tile that can carry a
 * comparison does, and the ones that cannot say so rather than implying a
 * change that was never measured.
 */
export function AnalyticsHeadline({
	analytics,
}: {
	analytics: IntelligenceAnalyticsView;
}) {
	const { previousPeriod, reach, riskByLevel, total } = analytics;
	const totalReach = reach.high + reach.medium + reach.low;
	const highShare = total ? Math.round((riskByLevel.high / total) * 100) : 0;
	// What share of all the engagement in the window landed on high-risk content.
	// A small number of posts can carry most of the reach, which is the case the
	// volume charts cannot show.
	const highReachShare = totalReach
		? Math.round((reach.high / totalReach) * 100)
		: 0;

	return (
		<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
			<MetricTile
				delta={delta(total, previousPeriod?.total)}
				help="Tổng số bài đã thu thập và chấm điểm trong khoảng thời gian đang chọn."
				icon={Signal}
				label="Bài đã phân tích"
				value={total.toLocaleString("vi-VN")}
			/>
			<MetricTile
				delta={delta(riskByLevel.high, previousPeriod?.high)}
				help="Số bài ở mức rủi ro cao. So sánh với cùng độ dài khoảng thời gian liền trước."
				icon={ShieldAlert}
				label="Rủi ro cao"
				tone="danger"
				value={riskByLevel.high.toLocaleString("vi-VN")}
			/>
			<MetricTile
				caption={`${riskByLevel.high.toLocaleString("vi-VN")} trên ${total.toLocaleString("vi-VN")} bài`}
				help="Tỷ lệ bài rủi ro cao trên tổng số bài trong kỳ."
				icon={TrendingUp}
				label="Tỷ trọng rủi ro cao"
				value={`${highShare}%`}
			/>
			<MetricTile
				caption={`${reach.high.toLocaleString("vi-VN")} trên ${totalReach.toLocaleString("vi-VN")} lượt tương tác`}
				help="Phần tương tác (like, bình luận, chia sẻ) rơi vào nhóm rủi ro cao. Số bài ít vẫn có thể chiếm phần lớn lượng lan truyền."
				icon={Flame}
				label="Lan truyền rủi ro cao"
				tone={highReachShare >= 50 ? "danger" : undefined}
				value={`${highReachShare}%`}
			/>
		</div>
	);
}

/** The period-over-period change, or null when there is nothing to compare to. */
function delta(current: number, previous: number | undefined) {
	if (previous === undefined) return null;
	// Growth from zero is real movement but has no percentage; the tile shows the
	// absolute change instead of "∞%".
	if (previous === 0) return current === 0 ? { percent: 0 } : { absolute: current };
	return { percent: Math.round(((current - previous) / previous) * 100) };
}

function MetricTile({
	caption,
	delta: change,
	help,
	icon: Icon,
	label,
	tone,
	value,
}: {
	/**
	 * What to print under a tile that is a ratio rather than a level.
	 *
	 * A share of the current window has no previous-period equivalent, so it is
	 * given the two figures it was computed from instead. The first version fell
	 * through to the "no previous period" line, which reads as missing data on a
	 * metric that was never a comparison.
	 */
	caption?: string;
	delta?: { absolute?: number; percent?: number } | null;
	help: string;
	icon: LucideIcon;
	label: string;
	tone?: "danger";
	value: string;
}) {
	const percent = change?.percent;
	const absolute = change?.absolute;
	const rising = (percent ?? absolute ?? 0) > 0;
	const flat = (percent ?? absolute ?? 0) === 0;
	const DeltaIcon = flat ? Minus : rising ? ArrowUpRight : ArrowDownRight;

	return (
		<DashboardTooltip content={help}>
			<div className="cursor-help rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] transition hover:border-[var(--border-strong)]">
				<div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
					<Icon size={13} aria-hidden />
					{label}
				</div>
				<div className="mt-2 flex flex-wrap items-baseline gap-2">
					<span
						className={`text-[26px] leading-8 font-extrabold tabular-nums ${
							tone === "danger"
								? "text-[var(--danger-strong)]"
								: "text-[var(--foreground)]"
						}`}
					>
						{value}
					</span>
					{change ? (
						<span
							className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
								flat
									? "text-[var(--muted)]"
									: rising
										? "text-[var(--danger-strong)]"
										: "text-[var(--success-strong)]"
							}`}
						>
							<DeltaIcon size={12} />
							{percent !== undefined
								? `${Math.abs(percent)}%`
								: `+${absolute?.toLocaleString("vi-VN")}`}
						</span>
					) : null}
				</div>
				<p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">
					{/* Said out loud rather than left blank: an empty slot where the
						other tiles carry a line reads as "no change". */}
					{caption ?? (change ? "so với kỳ trước" : "không có kỳ trước để so sánh")}
				</p>
			</div>
		</DashboardTooltip>
	);
}

/**
 * Topics ranked by movement rather than size.
 *
 * The topic chart already says what is big. This says what changed, which is a
 * different question and usually the more urgent one — a subject that tripled
 * from a small base will not appear anywhere near the top of a volume ranking.
 */
export function TopicMomentum({ rows }: { rows: IntelligenceMomentumStat[] }) {
	if (!rows.length) {
		return (
			<p className="px-4 py-6 text-center text-[12px] text-[var(--muted)]">
				Chưa đủ dữ liệu hai kỳ liên tiếp để so sánh biến động.
			</p>
		);
	}

	return (
		<ul className="divide-y divide-[var(--divider)]">
			{rows.map((row) => {
				const isNew = row.previous === 0;
				const percent = isNew
					? null
					: Math.round(((row.current - row.previous) / row.previous) * 100);
				const rising = isNew || (percent ?? 0) > 0;
				return (
					<li key={row.slug}>
						<IntentPrefetchLink
							className="flex items-center justify-between gap-3 px-4 py-2.5 transition hover:bg-[var(--surface-soft)]"
							href={`/topics/${row.slug}`}
						>
							<span className="min-w-0 flex-1">
								<span className="block truncate text-[13px] font-bold text-[var(--foreground)]">
									{row.name}
								</span>
								<span className="text-[11px] font-semibold text-[var(--muted)]">
									{row.current.toLocaleString("vi-VN")} bài · kỳ trước{" "}
									{row.previous.toLocaleString("vi-VN")}
								</span>
							</span>
							<span
								className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold ${
									rising
										? "bg-[var(--danger-soft)] text-[var(--danger-strong)]"
										: "bg-[var(--success-soft)] text-[var(--success-strong)]"
								}`}
							>
								{rising ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
								{isNew ? "Mới xuất hiện" : `${percent && percent > 0 ? "+" : ""}${percent}%`}
							</span>
						</IntentPrefetchLink>
					</li>
				);
			})}
		</ul>
	);
}
