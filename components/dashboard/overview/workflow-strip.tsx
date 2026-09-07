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
export function WorkflowStrip({
	pipeline,
}: {
	pipeline?: WorkflowPipelineView;
}) {
	if (!pipeline) return null;
	const steps: Step[] = [
		{
			detail: `Đang bật / ${pipeline.sources.total} nguồn đã thêm`,
			href: "/sources",
			icon: Radar,
			label: "Nguồn theo dõi",
			value: String(pipeline.sources.active),
		},
		{
			attention: pipeline?.scans.failedToday
				? `${pipeline.scans.failedToday} lượt lỗi trong 24 giờ`
				: undefined,
			detail: `${pipeline.scans.queued} đang chờ · ${pipeline.scans.completedToday} hoàn tất / 24 giờ`,
			href: "/sources?view=queue",
			icon: CalendarClock,
			label: "Đang quét",
			value: String(pipeline.scans.running),
		},
		{
			attention: pipeline?.timeline.highRiskOpen
				? `${pipeline.timeline.highRiskOpen.toLocaleString("vi-VN")} rủi ro cao còn mở`
				: undefined,
			detail: "Bằng chứng thu thập trong 24 giờ",
			href: "/evidence?sort=collected-desc",
			icon: Newspaper,
			label: "Bằng chứng mới",
			value: pipeline.timeline.collectedToday.toLocaleString("vi-VN"),
		},
		{
			detail: `${pipeline?.drafts.pending ?? 0} bản nháp phản hồi đang chờ`,
			href: "/articles?review=needs_review",
			icon: FileText,
			label: "Bài chờ duyệt",
			value: pipeline.articles.awaitingReview.toLocaleString("vi-VN"),
		},
		{
			detail: `${pipeline?.articles.liveOnZalo ?? 0} bài đang hiển thị trên Zalo`,
			href: "/articles?state=published",
			icon: Send,
			label: "Sẵn sàng xuất bản",
			value: String(pipeline.articles.readyForZalo),
		},
	];

	return (
		<section className="space-y-3">
			<div className="flex items-baseline justify-between gap-3">
				<h2 className="text-[15px] font-bold text-[var(--foreground)]">
					Nhịp công việc
				</h2>
				<p className="text-[11px] font-semibold text-[var(--muted)]">
					Trạng thái hiện tại · Thu thập trong 24 giờ
				</p>
			</div>
			<ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
				{steps.map((step) => {
					const Icon = step.icon;
					return (
						<li key={step.label} className="min-w-0">
							<Link
								href={step.href}
								className={`flex h-full min-w-0 flex-col gap-3 rounded-xl border bg-[var(--surface)] p-4 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)] ${
									step.attention
										? "border-[var(--warning-border)] bg-[var(--warning-soft)]/40"
										: "border-[var(--border)]"
								}`}
							>
								<span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
									<Icon size={14} />
									<span className="truncate">{step.label}</span>
								</span>
								<span className="text-[22px] font-bold leading-tight text-[var(--foreground)]">
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
