"use client";

import { useQuery } from "@tanstack/react-query";
import {
	ArrowRight,
	Minus,
	Sparkles,
	TrendingDown,
	TrendingUp,
} from "lucide-react";

import type { IntelligenceFilters } from "@/components/dashboard/types";
import { intelligenceSummaryQueryOptions } from "@/lib/dashboard/client-queries";

/**
 * What the window says, in words.
 *
 * Six charts is a lot to hold at once, and the question a duty officer opens
 * this page with — what changed, what should I look at first — was left for them
 * to assemble. This assembles it.
 *
 * Two things keep it honest. It is labelled as machine-written wherever it
 * appears, because a paragraph in a government tool reads as an official finding
 * unless it says otherwise. And every point carries the figure it rests on, so
 * checking it against the chart beside it takes a glance rather than trust.
 */
export function AnalyticsSummary({ filters }: { filters: IntelligenceFilters }) {
	const summaryQuery = useQuery(intelligenceSummaryQueryOptions(filters));

	if (summaryQuery.isPending) {
		return (
			<section className="animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
				<div className="h-4 w-40 rounded bg-[var(--surface-soft)]" />
				<div className="mt-3 h-6 w-3/4 rounded bg-[var(--surface-soft)]" />
				<div className="mt-4 grid gap-2 sm:grid-cols-3">
					<div className="h-16 rounded-lg bg-[var(--surface-soft)]" />
					<div className="h-16 rounded-lg bg-[var(--surface-soft)]" />
					<div className="h-16 rounded-lg bg-[var(--surface-soft)]" />
				</div>
			</section>
		);
	}

	/*
	 * Nothing is rendered when there is no summary. This happens for two ordinary
	 * reasons — no model configured, or an empty window — and neither is an error
	 * a reader can act on. The charts below carry the page on their own.
	 */
	if (summaryQuery.isError || !summaryQuery.data) return null;

	const summary = summaryQuery.data;

	return (
		<section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
			<div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-soft)] px-5 py-2.5">
				<span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--accent-strong)]">
					<Sparkles size={13} aria-hidden />
					Tóm tắt xu hướng do AI tổng hợp
				</span>
				<span className="text-[11px] font-semibold text-[var(--muted)]">
					Số liệu trong các biểu đồ bên dưới là nguồn chính thức
				</span>
			</div>

			<div className="p-5">
				<p className="text-[17px] leading-7 font-extrabold text-[var(--foreground)]">
					{summary.headline}
				</p>

				<div className="mt-4 grid gap-2.5 lg:grid-cols-3">
					{summary.trends.map((trend) => {
						const Icon =
							trend.direction === "up"
								? TrendingUp
								: trend.direction === "down"
									? TrendingDown
									: Minus;
						return (
							<article
								className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3.5"
								key={trend.title}
							>
								<h3 className="flex items-start gap-2 text-[13px] font-extrabold text-[var(--foreground)]">
									<Icon
										aria-hidden
										className={`mt-0.5 shrink-0 ${
											trend.direction === "up"
												? "text-[var(--danger-strong)]"
												: trend.direction === "down"
													? "text-[var(--success-strong)]"
													: "text-[var(--muted)]"
										}`}
										size={14}
									/>
									{trend.title}
								</h3>
								<p className="mt-1.5 text-[12.5px] leading-5 text-[var(--muted-strong)]">
									{trend.detail}
								</p>
								{/* The figure this rests on. Without it the paragraph is an
									assertion; with it, a reader can check it in one glance. */}
								<p className="mt-2 inline-flex rounded bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[var(--muted)]">
									{trend.evidence}
								</p>
							</article>
						);
					})}
				</div>

				<div className="mt-4 flex items-start gap-2 rounded-lg border border-[var(--accent-border,var(--border))] bg-[var(--accent-soft)] px-3.5 py-3">
					<ArrowRight
						aria-hidden
						className="mt-0.5 shrink-0 text-[var(--accent-strong)]"
						size={15}
					/>
					<p className="text-[12.5px] leading-5 font-semibold text-[var(--accent-strong)]">
						{summary.focus}
					</p>
				</div>
			</div>
		</section>
	);
}
