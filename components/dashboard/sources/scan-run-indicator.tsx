"use client";

import {
	AlertTriangle,
	ArrowRight,
	CheckCircle2,
	Clock,
	LoaderCircle,
	Radar,
	X,
} from "lucide-react";
import Link from "next/link";

import type { ScanRun } from "./use-scan-runs";

const STEPS = [
	{ key: "queued", label: "Đã xếp hàng" },
	{ key: "running", label: "Đang quét" },
	{ key: "completed", label: "Đã có kết quả" },
] as const;

/**
 * Narrates one scan run: which step it is on, what came back, and where to go next.
 */
export function ScanRunIndicator({
	onDismiss,
	run,
	timelineHref = "/evidence?sort=collected-desc",
}: {
	onDismiss: () => void;
	run: ScanRun;
	timelineHref?: string;
}) {
	const activeIndex =
		run.phase === "completed"
			? 2
			: run.phase === "running"
				? 1
				: run.phase === "failed"
					? 1
					: 0;
	const failed = run.phase === "failed";
	const done = run.phase === "completed";

	return (
		<div
			aria-live="polite"
			className={`rounded-lg border px-3 py-2.5 ${
				failed
					? "border-[var(--danger-border)] bg-[var(--danger-soft)]"
					: done
						? "border-[var(--success-border)] bg-[var(--success-soft)]"
						: "border-[var(--accent)] bg-[var(--accent-soft)]"
			}`}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2">
					{failed ? (
						<AlertTriangle size={15} className="shrink-0 text-[var(--danger-strong)]" />
					) : done ? (
						<CheckCircle2 size={15} className="shrink-0 text-[var(--success-strong)]" />
					) : (
						<LoaderCircle
							size={15}
							className="shrink-0 animate-spin text-[var(--accent-strong)]"
						/>
					)}
					<p
						className={`min-w-0 truncate text-[12px] font-bold ${
							failed
								? "text-[var(--danger-strong)]"
								: done
									? "text-[var(--success-strong)]"
									: "text-[var(--accent-strong)]"
						}`}
					>
						{failed
							? (run.error ?? "Lượt quét gặp lỗi.")
							: done
								? `Đã quét xong · ${run.evidenceCount.toLocaleString("vi-VN")} bài mới${
										run.highRiskCount
											? ` · ${run.highRiskCount.toLocaleString("vi-VN")} rủi ro cao`
											: ""
									}`
								: run.phase === "running"
									? "Đang thu thập và phân tích nội dung…"
									: "Đã đưa vào hàng đợi, sắp bắt đầu…"}
					</p>
				</div>
				<button
					type="button"
					onClick={onDismiss}
					aria-label="Đóng trạng thái quét"
					className="shrink-0 text-[var(--muted)] transition hover:text-[var(--foreground)]"
				>
					<X size={14} />
				</button>
			</div>

			<ol className="mt-2 flex flex-wrap items-center gap-1.5">
				{STEPS.map((step, index) => {
					const complete = index < activeIndex || (done && index === 2);
					const active = index === activeIndex && !done;
					return (
						<li key={step.key} className="flex items-center gap-1.5">
							<span
								className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-bold ${
									complete
										? "bg-[var(--success-soft)] text-[var(--success-strong)]"
										: active
											? "bg-[var(--surface)] text-[var(--accent-strong)]"
											: "text-[var(--muted)]"
								}`}
							>
								{complete ? (
									<CheckCircle2 size={11} />
								) : active ? (
									<Radar size={11} className="animate-pulse" />
								) : (
									<Clock size={11} />
								)}
								{step.label}
							</span>
							{index < STEPS.length - 1 ? (
								<span aria-hidden className="text-[var(--muted)]">
									›
								</span>
							) : null}
						</li>
					);
				})}
			</ol>

			{done && run.evidenceCount > 0 ? (
				<Link
					href={timelineHref}
					className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--surface)] px-2.5 text-[11px] font-bold text-[var(--accent-strong)]"
				>
					Xem trên dòng thời gian <ArrowRight size={12} />
				</Link>
			) : null}
			{done && run.evidenceCount === 0 ? (
				<p className="mt-2 text-[11px] font-semibold text-[var(--muted-strong)]">
					Không có nội dung mới so với lần quét trước.
				</p>
			) : null}
		</div>
	);
}
