"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
	ArrowRight,
	LoaderCircle,
	Minus,
	Sparkles,
	TrendingDown,
	TrendingUp,
} from "lucide-react";

import type { IntelligenceFilters } from "@/components/dashboard/types";
import {
	intelligenceSummaryQueryOptions,
	requestIntelligenceSummary,
} from "@/lib/dashboard/client-queries";
import {
	dashboardQueryKeys,
	serializeIntelligenceFilters,
} from "@/lib/dashboard/query-keys";

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
	const queryClient = useQueryClient();
	const summaryQuery = useQuery(intelligenceSummaryQueryOptions(filters));
	const generateMutation = useMutation({
		mutationFn: () => requestIntelligenceSummary(filters),
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: dashboardQueryKeys.intelligenceSummary(
					serializeIntelligenceFilters(filters),
				),
			});
		},
	});

	const needsGenerating = summaryQuery.data?.status === "generating";
	/*
	 * Asked for once, when the page first learns none is stored. The server-side
	 * claim is what actually prevents duplicates; this only avoids firing the
	 * request again on every poll.
	 */
	useEffect(() => {
		if (needsGenerating && generateMutation.isIdle) generateMutation.mutate();
	}, [generateMutation, needsGenerating]);

	/*
	 * A labelled wait, not a bare pulse.
	 *
	 * Generating this reads a window of posts and takes tens of seconds on a cold
	 * cache. Three grey rectangles breathing for that long is indistinguishable
	 * from a broken panel — and was reported as exactly that. Saying what is
	 * happening costs one line and turns a fault into a wait.
	 */
	const summary = summaryQuery.data?.summary ?? null;
	const generating = summaryQuery.data?.status === "generating";

	if (summaryQuery.isPending || (generating && !summary)) {
		return (
			<section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
				<span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[var(--accent-strong)]">
					<LoaderCircle className="animate-spin" size={13} aria-hidden />
					Đang tổng hợp xu hướng
				</span>
				<p className="mt-2 text-[12.5px] text-[var(--muted)]">
					AI đang đọc lại nội dung trong kỳ. Việc này chạy nền và mất khoảng nửa
					phút; phần tóm tắt sẽ tự hiện ra, không cần tải lại trang. Các biểu đồ
					bên dưới đã sẵn sàng.
				</p>
				<div className="mt-4 grid gap-2 sm:grid-cols-2">
					<div className="h-14 animate-pulse rounded-lg bg-[var(--surface-soft)]" />
					<div className="h-14 animate-pulse rounded-lg bg-[var(--surface-soft)]" />
				</div>
			</section>
		);
	}

	/*
	 * Nothing is rendered when there is no summary. This happens for two ordinary
	 * reasons — no model configured, or an empty window — and neither is an error
	 * a reader can act on. The charts below carry the page on their own.
	 */
	if (summaryQuery.isError || !summary) return null;

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

				{/*
					What is actually being discussed, clustered from real posts.
					The topic taxonomy names a shelf and the hashtags name a fragment;
					neither answers "what is going on", which is the question this list
					exists for.
				*/}
				{summary.topics?.length ? (
					<ul className="mt-4 grid gap-2 sm:grid-cols-2 sm:[&>li:last-child:nth-child(odd)]:col-span-2">
						{summary.topics.map((topic) => (
							<li
								className="flex gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3"
								key={topic.subject}
							>
								<span
									aria-hidden
									className={`mt-1 h-full w-1 shrink-0 rounded-full ${
										topic.sentiment === "negative"
											? "bg-[var(--danger-strong)]"
											: topic.sentiment === "positive"
												? "bg-[var(--success-strong)]"
												: "bg-[var(--muted)]"
									}`}
								/>
								<span className="min-w-0">
									<span className="flex flex-wrap items-baseline gap-x-2">
										<span className="text-[13px] font-extrabold text-[var(--foreground)]">
											{topic.subject}
										</span>
										<span className="text-[11px] font-bold tabular-nums text-[var(--muted)]">
											{topic.count} bài
										</span>
									</span>
									<span className="mt-1 block text-[12px] leading-5 text-[var(--muted-strong)]">
										{topic.summary}
									</span>
								</span>
							</li>
						))}
					</ul>
				) : null}

				{/*
					Six columns rather than three, so a trailing row can divide evenly:
					each card takes two (three per row), a lone remainder takes all six,
					and a pair takes three each. Three equal columns cannot express
					"half a row", which is what left a gap under the last card.
				*/}
				<div className="mt-4 grid gap-2.5 lg:grid-cols-6 lg:[&>article]:col-span-2 lg:[&>article:last-child:nth-child(3n-2)]:col-span-6 lg:[&>article:nth-last-child(2):nth-child(3n-2)]:col-span-3 lg:[&>article:last-child:nth-child(3n-1)]:col-span-3">
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
									assertion; with it, a reader can check it in one glance.
									Blank when the citation failed validation server-side — an
									empty chip is worse than none. */}
								{trend.evidence ? (
									<p className="mt-2 inline-flex rounded bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[var(--muted)]">
										{trend.evidence}
									</p>
								) : null}
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
