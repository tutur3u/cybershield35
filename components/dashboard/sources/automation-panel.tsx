"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ChevronRight, RefreshCw } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import type {
	DashboardScan,
	ManagedSchedulerJobView,
	TrackedSourceView,
} from "@/components/dashboard/types";
import {
	DashboardTooltip,
	Panel,
	PanelHeader,
} from "@/components/dashboard/ui-primitives";
import { managedSchedulerQueryOptions } from "@/lib/dashboard/client-queries";

import {
	cronStatusLabel,
	facebookIdentity,
	formatDate,
	metricToneClass,
	sourceAutomationState,
	type SourceAutomationState,
} from "./source-utils";

export function SourceAutomationPanel({
	onRunSchedulerJob,
	scans,
	sources,
}: {
	onRunSchedulerJob: (jobKey: "daily-scans") => Promise<void>;
	scans: DashboardScan[];
	sources: TrackedSourceView[];
}) {
	const schedulerQuery = useQuery(managedSchedulerQueryOptions());
	const [runningJob, setRunningJob] = useState<"daily-scans" | null>(null);
	const sourceStates = useMemo(
		() => sources.map((source) => ({ source, state: sourceAutomationState(source) })),
		[sources],
	);
	const activeSources = sourceStates.filter((item) => item.source.isActive);
	const dueSources = sourceStates.filter((item) =>
		["due", "stale_active"].includes(item.state.kind),
	);
	const skippedSources = sourceStates.filter((item) =>
		["inactive", "in_progress", "recent"].includes(item.state.kind),
	);
	const queuedScans = scans.filter((scan) =>
		["queued", "retrying"].includes(scan.status),
	);
	const runningScans = scans.filter((scan) => scan.status === "running");
	const status = schedulerQuery.data;
	const dailyJob = status?.jobs.find((job) => job.jobKey === "daily-scans");

	async function runJob() {
		setRunningJob("daily-scans");
		try {
			await onRunSchedulerJob("daily-scans");
			await schedulerQuery.refetch();
		} finally {
			setRunningJob(null);
		}
	}

	return (
		<Panel>
			<PanelHeader
				title="Quét lại tự động"
				description="Mỗi ngày CS35 kiểm tra mọi nguồn đến hạn và hoàn tất các lượt quét đang chờ."
			/>
			<div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
				<div className="grid gap-3 sm:grid-cols-2">
					<AutomationMetric
						help="Nguồn đang bật sẽ được xem xét quét lại mỗi ngày."
						label="Nguồn đang bật"
						value={activeSources.length.toLocaleString("vi-VN")}
					/>
					<AutomationMetric
						help="Nguồn sẵn sàng quét lại, gồm cả nguồn có lượt quét cũ bị kẹt."
						label="Đến hạn quét"
						tone={dueSources.length ? "warning" : "success"}
						value={dueSources.length.toLocaleString("vi-VN")}
					/>
					<AutomationMetric
						help="Số lượt đang chờ tới lượt xử lý."
						label="Đang chờ"
						value={queuedScans.length.toLocaleString("vi-VN")}
					/>
					<AutomationMetric
						help="Số lượt đang thu thập và phân tích ngay lúc này."
						label="Đang quét"
						tone={runningScans.length ? "accent" : "neutral"}
						value={runningScans.length.toLocaleString("vi-VN")}
					/>
				</div>
				<div className="grid gap-3">
					<ScheduleRow job={dailyJob} />
					<button
						type="button"
						disabled={runningJob !== null}
						onClick={() => void runJob()}
						className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent-fill)] px-3 text-[12px] font-bold text-white transition hover:bg-[var(--accent-fill-hover)] disabled:cursor-not-allowed disabled:opacity-60"
					>
						<RefreshCw
							size={15}
							className={runningJob === "daily-scans" ? "animate-spin" : ""}
						/>
						Quét toàn bộ nguồn đến hạn ngay
					</button>
				</div>
			</div>
			<div className="grid gap-3 border-t border-[var(--border)] p-4 lg:grid-cols-3">
				<AutomationAccordion
					description={`${dueSources.length.toLocaleString("vi-VN")} nguồn sẽ vào lượt quét tiếp theo.`}
					title="Nguồn đến hạn"
				>
					<SourceStateList emptyText="Không có nguồn đến hạn." items={dueSources} />
				</AutomationAccordion>
				<AutomationAccordion
					description="Các nguồn đã tắt, vừa quét hoặc đang được xử lý."
					title="Nguồn đang bỏ qua"
				>
					<SourceStateList
						emptyText="Không có nguồn nào bị bỏ qua."
						items={skippedSources}
					/>
				</AutomationAccordion>
				<AutomationAccordion
					description="Cách CS35 quyết định nguồn nào được quét lại."
					title="Quy tắc tự động"
				>
					<ul className="space-y-2 text-[12px] font-semibold leading-5 text-[var(--muted-strong)]">
						<li>Nguồn phải đang bật theo dõi.</li>
						<li>Không quét trùng nếu vừa quét trong vòng 1 giờ.</li>
						<li>Không tạo lượt mới khi nguồn vẫn đang được xử lý.</li>
						<li>Lượt quét gián đoạn quá 12 giờ sẽ tự động chạy lại.</li>
					</ul>
				</AutomationAccordion>
			</div>
		</Panel>
	);
}

function ScheduleRow({ job }: { job?: ManagedSchedulerJobView }) {
	const status = job?.lastStatus ?? "unknown";
	const failed = status === "failed";
	return (
		<div className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
			<div className="min-w-0">
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					<CalendarClock size={15} className="shrink-0 text-[var(--muted)]" />
					<p className="min-w-0 truncate text-[13px] font-bold text-[var(--foreground)]">
						Lịch quét hằng ngày
					</p>
					<span
						className={`inline-flex h-6 items-center rounded-md px-2 text-[10px] font-bold ${
							failed
								? "bg-[var(--danger-soft)] text-[var(--danger-strong)]"
								: "bg-[var(--success-soft)] text-[var(--success-strong)]"
						}`}
					>
						{cronStatusLabel(status)}
					</span>
				</div>
				<p className="mt-1 truncate text-[11px] font-semibold text-[var(--muted)]">
					Lần chạy gần nhất {formatDate(job?.lastRunAt ?? null)}
				</p>
			</div>
			<div className="text-[11px] font-semibold text-[var(--muted)] sm:text-right">
				<p>Lần chạy tới</p>
				<p className="mt-1 text-[var(--muted-strong)]">
					{formatDate(job?.nextRunAt ?? null)}
				</p>
			</div>
		</div>
	);
}

function AutomationMetric({
	help,
	label,
	tone = "neutral",
	value,
}: {
	help: string;
	label: string;
	tone?: "accent" | "neutral" | "success" | "warning";
	value: string;
}) {
	return (
		<DashboardTooltip content={help}>
			<div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
				<p className={`text-[24px] font-bold ${metricToneClass(tone)}`}>{value}</p>
				<p className="mt-1 text-[12px] font-semibold text-[var(--muted)]">{label}</p>
			</div>
		</DashboardTooltip>
	);
}

function AutomationAccordion({
	children,
	description,
	title,
}: {
	children: ReactNode;
	description: string;
	title: string;
}) {
	return (
		<details className="group min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)]">
			<summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-3 py-3">
				<span className="min-w-0">
					<span className="block text-[13px] font-bold text-[var(--foreground)]">
						{title}
					</span>
					<span className="mt-1 block text-[11px] font-semibold leading-4 text-[var(--muted)]">
						{description}
					</span>
				</span>
				<ChevronRight
					size={15}
					className="mt-1 shrink-0 text-[var(--muted)] transition group-open:rotate-90"
				/>
			</summary>
			<div className="border-t border-[var(--divider)] px-3 py-3">{children}</div>
		</details>
	);
}

function SourceStateList({
	emptyText,
	items,
}: {
	emptyText: string;
	items: Array<{ source: TrackedSourceView; state: SourceAutomationState }>;
}) {
	if (!items.length) {
		return <p className="text-[12px] font-semibold text-[var(--muted)]">{emptyText}</p>;
	}
	return (
		<div className="space-y-2">
			{items.slice(0, 6).map(({ source, state }) => {
				const identity = facebookIdentity(source);
				return (
					<div key={source.id} className="rounded-md bg-[var(--surface-soft)] px-3 py-2">
						<div className="flex min-w-0 items-center justify-between gap-2">
							<p className="min-w-0 truncate text-[12px] font-bold text-[var(--foreground)]">
								{source.displayName}
							</p>
							<DashboardTooltip content={state.help}>
								<span className="shrink-0 rounded-md bg-[var(--surface)] px-2 py-0.5 text-[10px] font-bold text-[var(--muted-strong)]">
									{state.label}
								</span>
							</DashboardTooltip>
						</div>
						<p className="mt-1 truncate text-[11px] font-semibold text-[var(--muted)]">
							{identity.username ? `@${identity.username}` : source.normalizedUrl}
						</p>
					</div>
				);
			})}
			{items.length > 6 ? (
				<p className="text-[11px] font-semibold text-[var(--muted)]">
					+{(items.length - 6).toLocaleString("vi-VN")} nguồn khác
				</p>
			) : null}
		</div>
	);
}
