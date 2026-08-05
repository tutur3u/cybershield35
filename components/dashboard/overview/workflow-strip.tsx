"use client";

import {
	ArrowRight,
	CalendarClock,
	FileText,
	Newspaper,
	Radar,
	Send,
	type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import type { WorkflowPipelineView } from "@/components/dashboard/types";

type Step = {
	attention?: string;
	detail: string;
	href: string;
	icon: LucideIcon;
	label: string;
	value: string;
};

/**
 * The five stages a piece of content passes through, with the live counters that
 * tell an operator where work is waiting. This is the overview's core job — the
 * analysis charts live on the intelligence workspace instead.
 */
export function WorkflowStrip({ pipeline }: { pipeline?: WorkflowPipelineView }) {
	const steps: Step[] = [
		{
			detail: `${pipeline?.sources.total ?? 0} nguồn đã thêm`,
			href: "/sources",
			icon: Radar,
			label: "Nguồn theo dõi",
			value: `${pipeline?.sources.active ?? 0} đang bật`,
		},
		{
			attention: pipeline?.scans.failedToday
				? `${pipeline.scans.failedToday} lượt lỗi hôm nay`
				: undefined,
			detail: `${pipeline?.scans.completedToday ?? 0} hoàn tất trong 24 giờ`,
			href: "/sources?tab=queue",
			icon: CalendarClock,
			label: "Quét nội dung",
			value: `${(pipeline?.scans.queued ?? 0) + (pipeline?.scans.running ?? 0)} đang chạy`,
		},
		{
			attention: pipeline?.timeline.highRiskOpen
				? `${pipeline.timeline.highRiskOpen} bài rủi ro cao chưa xử lý`
				: undefined,
			detail: `${pipeline?.timeline.collectedToday ?? 0} bài mới trong 24 giờ`,
			href: "/evidence?sort=collected-desc",
			icon: Newspaper,
			label: "Dòng thời gian",
			value: `${pipeline?.timeline.collectedToday ?? 0} bài mới`,
		},
		{
			attention: pipeline?.articles.awaitingReview
				? `${pipeline.articles.awaitingReview} bài chờ duyệt`
				: undefined,
			detail: `${pipeline?.drafts.pending ?? 0} bản nháp phản hồi đang chờ`,
			href: "/articles?review=needs_review",
			icon: FileText,
			label: "Biên tập & duyệt",
			value: `${pipeline?.articles.awaitingReview ?? 0} chờ duyệt`,
		},
		{
			attention: pipeline?.articles.readyForZalo
				? `${pipeline.articles.readyForZalo} bài sẵn sàng lên Zalo`
				: undefined,
			detail: `${pipeline?.articles.liveOnZalo ?? 0} bài đang hiển thị trên Zalo`,
			href: "/articles?state=published",
			icon: Send,
			label: "Xuất bản",
			value: `${pipeline?.articles.readyForZalo ?? 0} sẵn sàng`,
		},
	];

	return (
		<section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
			<div className="flex items-baseline justify-between gap-3">
				<h2 className="text-[15px] font-bold text-[var(--foreground)]">
					Quy trình hôm nay
				</h2>
				<p className="text-[11px] font-semibold text-[var(--muted)]">
					Từ nguồn tới bài đăng
				</p>
			</div>
			<ol className="mt-3 grid gap-2 xl:grid-cols-5">
				{steps.map((step, index) => {
					const Icon = step.icon;
					return (
						<li key={step.label} className="min-w-0">
							<Link
								href={step.href}
								className={`flex h-full min-w-0 flex-col gap-1 rounded-lg border p-3 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)] ${
									step.attention
										? "border-[var(--warning-border)] bg-[var(--warning-soft)]/40"
										: "border-[var(--border)]"
								}`}
							>
								<span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
									<Icon size={14} />
									<span className="truncate">
										{index + 1}. {step.label}
									</span>
								</span>
								<span className="text-[19px] font-bold leading-tight text-[var(--foreground)]">
									{step.value}
								</span>
								<span className="text-[11px] font-semibold text-[var(--muted)]">
									{step.detail}
								</span>
								{step.attention ? (
									<span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--warning-strong)]">
										{step.attention} <ArrowRight size={12} />
									</span>
								) : null}
							</Link>
						</li>
					);
				})}
			</ol>
		</section>
	);
}
