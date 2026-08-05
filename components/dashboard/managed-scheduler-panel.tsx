"use client";

import {
	AlertTriangle,
	Clock3,
	Edit3,
	ExternalLink,
	History,
	Loader2,
	Pause,
	Play,
	RefreshCw,
	RotateCw,
	Save,
	X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
	ManagedSchedulerExecutionView,
	ManagedSchedulerJobView,
} from "@/components/dashboard/types";
import { Panel, PanelHeader } from "@/components/dashboard/ui-primitives";
import {
	managedSchedulerExecutionsQueryOptions,
	managedSchedulerQueryOptions,
} from "@/lib/dashboard/client-queries";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";
import {
	managedSchedulerErrorMessage,
	parseManagedSchedulerStatusResponse,
} from "@/lib/managed-scheduler/client";

const FALLBACK_MANAGED_JOBS: ManagedSchedulerJobView[] = [
	{
		active: true,
		failureCount: 0,
		jobId: null,
		jobKey: "daily-scans",
		lastExecution: null,
		lastRunAt: null,
		lastStatus: null,
		name: "Quét nguồn hằng ngày",
		nextRunAt: null,
		remoteStatusUnknown: true,
		schedule: "0 0 * * *",
		scheduleDescription: "Hằng ngày lúc 00:00 UTC",
		scheduleTimezone: "Asia/Ho_Chi_Minh",
	},
];

export function ManagedSchedulerPanel({
	autoRetryToken,
}: {
	autoRetryToken?: number;
}) {
	const queryClient = useQueryClient();
	const handledAutoRetry = useRef<number | undefined>(undefined);
	const [editingJob, setEditingJob] =
		useState<ManagedSchedulerJobView | null>(null);
	const [historyJobKey, setHistoryJobKey] = useState<string>("all");
	const [selectedExecution, setSelectedExecution] =
		useState<ManagedSchedulerExecutionView | null>(null);
	const query = useQuery(managedSchedulerQueryOptions());
	const setupMutation = useMutation({
		mutationFn: setupManagedScheduler,
		onSuccess: (payload) => {
			queryClient.setQueryData(dashboardQueryKeys.managedScheduler(), payload);
			void queryClient.invalidateQueries({
				queryKey: dashboardQueryKeys.managedScheduler(),
			});
		},
	});
	const runMutation = useMutation({
		mutationFn: runJobNow,
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: dashboardQueryKeys.managedSchedulerExecutions(
					historyJobKey === "all" ? "all" : historyJobKey,
				),
			});
			void queryClient.invalidateQueries({
				queryKey: dashboardQueryKeys.managedScheduler(),
			});
		},
	});
	const patchMutation = useMutation({
		mutationFn: patchJob,
		onSuccess: () => {
			setEditingJob(null);
			void queryClient.invalidateQueries({
				queryKey: dashboardQueryKeys.managedSchedulerExecutions(),
			});
			void queryClient.invalidateQueries({
				queryKey: dashboardQueryKeys.managedSchedulerExecutions(historyJobKey),
			});
			queryClient.invalidateQueries({
				queryKey: dashboardQueryKeys.managedScheduler(),
			});
		},
	});
	const status = setupMutation.data ?? query.data;
	const isVercelScheduler = status?.schedulerProvider === "vercel-cron";
	const hasLocalScheduler = Boolean(
		isVercelScheduler || status?.configured || status?.tokenLastFour,
	);
	const remoteStatusUnavailable =
		hasLocalScheduler && status?.remoteStatusAvailable === false;
	const displayJobs = useMemo(() => {
		if (hasLocalScheduler && status?.jobs.length === 0) {
			return FALLBACK_MANAGED_JOBS;
		}

		return status?.jobs ?? [];
	}, [hasLocalScheduler, status?.jobs]);
	const executionsQuery = useQuery({
		...managedSchedulerExecutionsQueryOptions(
			historyJobKey === "all" ? undefined : historyJobKey,
		),
		enabled: hasLocalScheduler,
		refetchInterval: 30_000,
	});

	useEffect(() => {
		if (!autoRetryToken || handledAutoRetry.current === autoRetryToken) return;
		handledAutoRetry.current = autoRetryToken;
		setupMutation.mutate();
	}, [autoRetryToken, setupMutation]);

	const storageNotReady =
		status?.code === "LOCAL_SCHEDULER_STORAGE_NOT_READY" ||
		status?.localStorageReady === false;
	const queryUnavailable = Boolean(query.error) && !status;
	const controlsDisabled =
		query.isLoading ||
		queryUnavailable ||
		setupMutation.isPending ||
		Boolean(status?.setupDisabled) ||
		storageNotReady;
	const canOpenRecovery =
		Boolean(status?.adminRecoveryHref) &&
		!status?.approvalHref &&
		!query.isLoading &&
		!queryUnavailable;
	const error =
		setupMutation.error instanceof Error
			? setupMutation.error.message
			: queryUnavailable && query.error instanceof Error
				? query.error.message
				: !status?.approvalHref &&
					  !status?.setupDisabledReason &&
					  !storageNotReady &&
					  status?.error
					? status.error
					: "";
	const actionError =
		runMutation.error instanceof Error
			? runMutation.error.message
			: patchMutation.error instanceof Error
				? patchMutation.error.message
				: "";
	const statusFreshness = useMemo(
		() => schedulerFreshness(status?.generatedAt ?? status?.serverNow ?? null),
		[status?.generatedAt, status?.serverNow],
	);
	const overdueJobs = displayJobs.filter((job) => job.isOverdue);
	const nextJob = useMemo(() => nearestNextJob(displayJobs), [displayJobs]);
	const executionItems = executionsQuery.data?.items ?? [];

	return (
		<Panel>
			<PanelHeader
				title={isVercelScheduler ? "Vercel Cron scheduler" : "Managed scheduler"}
				description={
					isVercelScheduler
						? "Vercel gọi trực tiếp các endpoint cron của CS35 theo lịch trong vercel.json."
						: "Tự động tạo lịch quét định kỳ và xử lý hàng đợi khi worker riêng chưa chạy."
				}
				action={
					isVercelScheduler ? (
						<span className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-[12px] font-bold text-[var(--foreground)]">
							<Clock3 size={14} />
							Vercel Cron
						</span>
					) : status?.approvalHref && !controlsDisabled ? (
						<a
							href={status.approvalHref}
							className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-3 text-[12px] font-bold text-white transition hover:bg-[var(--accent-strong)]"
						>
							<ExternalLink size={14} />
							Duyệt thiết lập
						</a>
					) : canOpenRecovery ? (
						<a
							href={status?.adminRecoveryHref}
							className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-3 text-[12px] font-bold text-white transition hover:bg-[var(--accent-strong)]"
						>
							<ExternalLink size={14} />
							Khôi phục cron
						</a>
					) : (
						<button
							type="button"
							onClick={() => setupMutation.mutate()}
							disabled={controlsDisabled}
							className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-3 text-[12px] font-bold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
						>
							{setupMutation.isPending ? (
								<Loader2 size={14} className="animate-spin" />
							) : status?.configured ? (
								<RotateCw size={14} />
							) : (
								<Clock3 size={14} />
							)}
							{status?.configured ? "Xoay token" : "Thiết lập"}
						</button>
					)
				}
			/>
			<div className="space-y-4 p-4">
				{query.isLoading ? <SchedulerSkeleton /> : null}
				{queryUnavailable ? (
					<SchedulerLoadError
						message={error}
						onRetry={() => void query.refetch()}
						retrying={query.isFetching}
					/>
				) : error ? (
					<InlineError message={error} />
				) : null}
				{actionError ? <InlineError message={actionError} /> : null}
				{storageNotReady ? (
					<StorageNotReadyNotice
						message={
							status?.error ??
							"Managed scheduler storage is not ready. Run bun db:migrate, then restart the app."
						}
					/>
				) : null}
				{status?.approvalHref ? (
					<div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3">
						<p className="text-[13px] font-bold text-[var(--warning-strong)]">
							Cần duyệt thiết lập managed scheduler
						</p>
						<p className="mt-1 text-[12px] leading-5 text-[var(--muted-strong)]">
							{approvalCopy(status.missingApprovalItems)}
						</p>
						<a
							href={status.approvalHref}
							className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--foreground)] transition hover:bg-[var(--surface-soft)]"
						>
							<ExternalLink size={14} />
							Duyệt thiết lập trên Tuturuuu
						</a>
					</div>
				) : null}
				{status?.setupDisabledReason &&
				!status.approvalHref &&
				!storageNotReady ? (
					<SetupBlockedNotice
						adminRecoveryHref={status.adminRecoveryHref}
						code={status.code}
						message={status.setupDisabledReason}
						missingApprovalItems={status.missingApprovalItems}
						setupOrigin={status.setupOrigin}
					/>
				) : null}
				{remoteStatusUnavailable ? <LocalSchedulerConfiguredNotice /> : null}
				{status && !query.isLoading ? (
					<>
						<div className="grid gap-3 sm:grid-cols-3">
							<Metric label="Trạng thái" value={status.enabled ? "Đang bật" : "Tạm dừng"} />
							<Metric
								label={isVercelScheduler ? "Bảo mật" : "Token"}
								value={
									isVercelScheduler
										? status.enabled
											? "CRON_SECRET"
											: "Thiếu CRON_SECRET"
										: status.tokenLastFour
											? `...${status.tokenLastFour}`
											: "Chưa có"
								}
							/>
							<Metric label="Cập nhật" value={formatDate(status.updatedAt)} />
						</div>
						<SchedulerSummary
							freshness={statusFreshness}
							nextJob={nextJob}
							overdueJobs={overdueJobs}
						/>
						{/*
							These posted "enqueue-tracked-sources" and "process-queue", job
							keys that no longer exist — the scheduler answered 404 for both,
							so neither manual button did anything. The daily pass now enqueues
							and drains in one job, and publication is its own.
						*/}
						<ImmediateCronActions
							disabled={!hasLocalScheduler}
							onProcess={() =>
								runMutation.mutate("process-article-publications")
							}
							onQueue={() => runMutation.mutate("daily-scans")}
							pending={runMutation.isPending}
						/>
						{displayJobs.length > 0 ? (
							<div className="space-y-2">
								{displayJobs.map((job) => (
									<SchedulerJobRow
										key={job.jobKey}
										job={job}
										onEdit={() => setEditingJob(job)}
										onHistory={() => {
											setHistoryJobKey(job.jobKey);
											setSelectedExecution(null);
										}}
										onPatch={(enabled) =>
											patchMutation.mutate({ enabled, jobKey: job.jobKey })
										}
										onRun={() => runMutation.mutate(job.jobKey)}
										pending={
											runMutation.isPending ||
											patchMutation.isPending ||
											(Boolean(status.setupDisabled) &&
												!job.remoteStatusUnknown &&
												!isVercelScheduler)
										}
										runDisabled={!hasLocalScheduler}
									/>
								))}
							</div>
						) : (
							<EmptyState
								configured={status.configured}
								hasLocalScheduler={hasLocalScheduler}
								remoteStatusUnavailable={remoteStatusUnavailable}
							/>
						)}
						<SchedulerHistory
							executions={executionItems}
							error={
								executionsQuery.error instanceof Error
									? executionsQuery.error.message
									: ""
							}
							filterJobKey={historyJobKey}
							jobs={displayJobs}
							loading={executionsQuery.isFetching}
							onFilterChange={(jobKey) => {
								setHistoryJobKey(jobKey);
								setSelectedExecution(null);
							}}
							onRetry={() => void executionsQuery.refetch()}
							onSelect={setSelectedExecution}
							selectedExecution={selectedExecution}
						/>
						{editingJob ? (
							<ScheduleEditor
								job={editingJob}
								onCancel={() => setEditingJob(null)}
								onSave={(payload) =>
									patchMutation.mutate({
										...payload,
										jobKey: editingJob.jobKey,
									})
								}
								pending={patchMutation.isPending}
							/>
						) : null}
					</>
				) : null}
			</div>
		</Panel>
	);
}

function ImmediateCronActions({
	disabled,
	onProcess,
	onQueue,
	pending,
}: {
	disabled: boolean;
	onProcess: () => void;
	onQueue: () => void;
	pending: boolean;
}) {
	return (
		<div className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
			<div className="min-w-0">
				<p className="text-[13px] font-bold text-[var(--foreground)]">
					Chạy thủ công
				</p>
				<p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
					Chạy lượt quét hằng ngày hoặc đẩy hàng đợi xuất bản Zalo OA ngay,
					không cần chờ lịch Vercel Cron kế tiếp.
				</p>
			</div>
			<div className="flex flex-wrap gap-2 sm:justify-end">
				<button
					type="button"
					disabled={disabled || pending}
					onClick={onQueue}
					title="Quét toàn bộ nguồn theo dõi ngay"
					className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--border)] px-3 text-[12px] font-bold text-[var(--foreground)] transition hover:bg-[var(--surface-soft)] disabled:opacity-60"
				>
					{pending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
					Quét ngay
				</button>
				<button
					type="button"
					disabled={disabled || pending}
					onClick={onProcess}
					title="Đẩy hàng đợi xuất bản Zalo OA ngay"
					className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-3 text-[12px] font-bold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
				>
					{pending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
					Xuất bản ngay
				</button>
			</div>
		</div>
	);
}

function SchedulerJobRow({
	job,
	onEdit,
	onHistory,
	onPatch,
	onRun,
	pending,
	runDisabled,
}: {
	job: ManagedSchedulerJobView;
	onEdit: () => void;
	onHistory: () => void;
	onPatch: (enabled: boolean) => void;
	onRun: () => void;
	pending: boolean;
	runDisabled: boolean;
}) {
	const overdue = job.isOverdue;
	const scheduleText = job.scheduleDescription || describeSchedule(job);
	const remoteControlsDisabled =
		pending || job.remoteStatusUnknown === true || job.lockedByDeployment === true;

	return (
		<div className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
			<div className="min-w-0">
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					<p className="truncate text-[13px] font-bold text-[var(--foreground)]">
						{labelForJob(job)}
					</p>
					<span
						className={`rounded-md px-2 py-1 text-[10px] font-bold ${
							job.active
								? "bg-[var(--success-soft)] text-[var(--success-strong)]"
								: "bg-[var(--neutral-soft)] text-[var(--muted-strong)]"
						}`}
					>
						{job.active ? "Bật" : "Tắt"}
					</span>
					{overdue ? (
						<span className="inline-flex items-center gap-1 rounded-md bg-[var(--warning-soft)] px-2 py-1 text-[10px] font-bold text-[var(--warning-strong)]">
							<AlertTriangle size={12} />
							Quá hạn
						</span>
					) : null}
					{job.remoteStatusUnknown ? (
						<span className="rounded-md bg-[var(--warning-soft)] px-2 py-1 text-[10px] font-bold text-[var(--warning-strong)]">
							Trạng thái Tuturuuu chưa rõ
						</span>
					) : null}
					{job.lockedByDeployment ? (
						<span className="rounded-md bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-bold text-[var(--accent-strong)]">
							Vercel Cron
						</span>
					) : null}
				</div>
				<p className="mt-1 text-[11px] text-[var(--muted)]">
					{scheduleText}
				</p>
				<p className="mt-1 text-[11px] text-[var(--muted)]">
					Chạy gần nhất {formatDate(job.lastRunAt)} ·{" "}
					{overdue ? "quá hạn từ" : "lần tới"}{" "}
					{formatDate(job.overdueSince ?? job.nextRunAt)}
				</p>
				{overdue ? (
					<p className="mt-1 text-[11px] font-semibold text-[var(--warning-strong)]">
						{job.overdueReason ??
							"Không có lần chạy nào được ghi nhận sau lịch dự kiến."}
					</p>
				) : null}
				{job.lastStatus ? (
					<p className="mt-1 text-[11px] text-[var(--muted)]">
						Kết quả gần nhất: {job.lastStatus}
						{job.failureCount > 0 ? ` · lỗi liên tiếp ${job.failureCount}` : ""}
					</p>
				) : null}
			</div>
			<div className="flex gap-2 sm:justify-end">
				<button
					type="button"
					disabled={remoteControlsDisabled}
					onClick={onEdit}
					title={
						job.lockedByDeployment
							? "Lịch được quản lý bằng vercel.json và cần redeploy để thay đổi"
							: job.remoteStatusUnknown
								? "Không thể sửa lịch khi chưa lấy được trạng thái Tuturuuu"
							: "Sửa lịch"
					}
					className="grid size-9 place-items-center rounded-md border border-[var(--border)] text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)] disabled:opacity-60"
				>
					<Edit3 size={14} />
				</button>
				<button
					type="button"
					disabled={pending}
					onClick={onHistory}
					title="Xem lịch sử"
					className="grid size-9 place-items-center rounded-md border border-[var(--border)] text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)] disabled:opacity-60"
				>
					<History size={14} />
				</button>
				<button
					type="button"
					disabled={pending || runDisabled}
					onClick={onRun}
					title="Chạy ngay"
					className="grid size-9 place-items-center rounded-md border border-[var(--border)] text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)] disabled:opacity-60"
				>
					<Play size={14} />
				</button>
				<button
					type="button"
					disabled={remoteControlsDisabled}
					onClick={() => onPatch(!job.active)}
					title={
						job.lockedByDeployment
							? "Bật/tắt lịch Vercel Cron trong Vercel dashboard hoặc vercel.json"
							: job.remoteStatusUnknown
								? "Không thể tạm dừng khi chưa lấy được trạng thái Tuturuuu"
							: job.active
								? "Tạm dừng"
								: "Bật lại"
					}
					className="grid size-9 place-items-center rounded-md border border-[var(--border)] text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)] disabled:opacity-60"
				>
					{job.active ? <Pause size={14} /> : <RefreshCw size={14} />}
				</button>
			</div>
		</div>
	);
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
			<p className="text-[11px] font-bold uppercase text-[var(--muted)]">
				{label}
			</p>
			<p className="mt-1 truncate text-[13px] font-bold text-[var(--foreground)]">
				{value}
			</p>
		</div>
	);
}

function SchedulerSummary({
	freshness,
	nextJob,
	overdueJobs,
}: {
	freshness: { ageMs: number | null; stale: boolean };
	nextJob: ManagedSchedulerJobView | null;
	overdueJobs: ManagedSchedulerJobView[];
}) {
	return (
		<div className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3 sm:grid-cols-3">
			<div>
				<p className="text-[11px] font-bold uppercase text-[var(--muted)]">
					Dữ liệu trạng thái
				</p>
				<p
					className={`mt-1 text-[13px] font-bold ${
						freshness.stale
							? "text-[var(--warning-strong)]"
							: "text-[var(--foreground)]"
					}`}
				>
					{freshness.stale
						? "Có thể đã cũ"
						: freshness.ageMs == null
							? "Chưa rõ"
							: "Đang mới"}
				</p>
			</div>
			<div>
				<p className="text-[11px] font-bold uppercase text-[var(--muted)]">
					Job kế tiếp
				</p>
				<p className="mt-1 truncate text-[13px] font-bold text-[var(--foreground)]">
					{nextJob
						? `${labelForJob(nextJob)} · ${formatDate(nextJob.nextRunAt)}`
						: "Chưa có"}
				</p>
			</div>
			<div>
				<p className="text-[11px] font-bold uppercase text-[var(--muted)]">
					Quá hạn
				</p>
				<p
					className={`mt-1 text-[13px] font-bold ${
						overdueJobs.length
							? "text-[var(--warning-strong)]"
							: "text-[var(--foreground)]"
					}`}
				>
					{overdueJobs.length
						? `${overdueJobs.length} job cần kiểm tra`
						: "Không có"}
				</p>
			</div>
		</div>
	);
}

function ScheduleEditor({
	job,
	onCancel,
	onSave,
	pending,
}: {
	job: ManagedSchedulerJobView;
	onCancel: () => void;
	onSave: (payload: { schedule: string; scheduleTimezone: string }) => void;
	pending: boolean;
}) {
	const initial = scheduleFormFromCron(job);
	const [kind, setKind] = useState(initial.kind);
	const [minutes, setMinutes] = useState(initial.minutes);
	const [hourInterval, setHourInterval] = useState(initial.hourInterval);
	const [time, setTime] = useState(initial.time);
	const [weekdays, setWeekdays] = useState<number[]>(initial.weekdays);
	const [timezone, setTimezone] = useState(
		job.scheduleTimezone ||
			Intl.DateTimeFormat().resolvedOptions().timeZone ||
			"UTC",
	);
	const schedule = buildSchedule({ hourInterval, kind, minutes, time, weekdays });
	const canSave = Boolean(schedule && timezone.trim());

	return (
		<div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="text-[13px] font-bold text-[var(--foreground)]">
						Sửa lịch: {labelForJob(job)}
					</p>
					<p className="mt-1 text-[12px] text-[var(--muted)]">
						Chọn cách diễn đạt lịch chạy, hệ thống sẽ lưu cron tương ứng.
					</p>
				</div>
				<button
					type="button"
					onClick={onCancel}
					className="grid size-8 place-items-center rounded-md border border-[var(--border)] text-[var(--muted-strong)]"
				>
					<X size={14} />
				</button>
			</div>
			<div className="mt-4 grid gap-3 sm:grid-cols-2">
				<label className="grid gap-1 text-[12px] font-bold text-[var(--foreground)]">
					Kiểu lịch
					<select
						value={kind}
						onChange={(event) => setKind(event.target.value as ScheduleKind)}
						className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-[12px]"
					>
						<option value="minutes">Mỗi vài phút</option>
						<option value="hourly">Mỗi giờ</option>
						<option value="hours">Mỗi vài giờ</option>
						<option value="daily">Hằng ngày</option>
						<option value="weekly">Hằng tuần</option>
					</select>
				</label>
				<label className="grid gap-1 text-[12px] font-bold text-[var(--foreground)]">
					Múi giờ
					<input
						value={timezone}
						onChange={(event) => setTimezone(event.target.value)}
						className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-[12px]"
					/>
				</label>
				{kind === "minutes" ? (
					<label className="grid gap-1 text-[12px] font-bold text-[var(--foreground)]">
						Chạy mỗi
						<select
							value={minutes}
							onChange={(event) => setMinutes(Number(event.target.value))}
							className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-[12px]"
						>
							{[5, 10, 15, 30].map((value) => (
								<option key={value} value={value}>
									{value} phút
								</option>
							))}
						</select>
					</label>
				) : null}
				{kind === "hours" ? (
					<label className="grid gap-1 text-[12px] font-bold text-[var(--foreground)]">
						Chạy mỗi
						<select
							value={hourInterval}
							onChange={(event) => setHourInterval(Number(event.target.value))}
							className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-[12px]"
						>
							{[2, 4, 6, 12].map((value) => (
								<option key={value} value={value}>
									{value} giờ
								</option>
							))}
						</select>
					</label>
				) : null}
				{kind === "daily" || kind === "weekly" ? (
					<label className="grid gap-1 text-[12px] font-bold text-[var(--foreground)]">
						Giờ chạy
						<input
							type="time"
							value={time}
							onChange={(event) => setTime(event.target.value)}
							className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-[12px]"
						/>
					</label>
				) : null}
			</div>
			{kind === "weekly" ? (
				<div className="mt-3 flex flex-wrap gap-2">
					{WEEKDAY_OPTIONS.map((day) => (
						<button
							key={day.value}
							type="button"
							onClick={() => setWeekdays(toggleWeekday(weekdays, day.value))}
							className={`h-8 rounded-md border px-2 text-[12px] font-bold ${
								weekdays.includes(day.value)
									? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
									: "border-[var(--border)] text-[var(--muted-strong)]"
							}`}
						>
							{day.label}
						</button>
					))}
				</div>
			) : null}
			<div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
				<p className="text-[12px] font-bold text-[var(--foreground)]">
					{describeScheduleFromForm({ hourInterval, kind, minutes, time, weekdays })}
				</p>
				<p className="mt-1 font-mono text-[11px] text-[var(--muted)]">
					{schedule || "Chọn ít nhất một ngày chạy"} · {timezone || "UTC"}
				</p>
			</div>
			<div className="mt-4 flex justify-end gap-2">
				<button
					type="button"
					onClick={onCancel}
					className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--border)] px-3 text-[12px] font-bold text-[var(--foreground)]"
				>
					Hủy
				</button>
				<button
					type="button"
					disabled={!canSave || pending}
					onClick={() => schedule && onSave({ schedule, scheduleTimezone: timezone })}
					className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-3 text-[12px] font-bold text-white disabled:opacity-60"
				>
					{pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
					Lưu lịch
				</button>
			</div>
		</div>
	);
}

function SchedulerHistory({
	executions,
	error,
	filterJobKey,
	jobs,
	loading,
	onFilterChange,
	onRetry,
	onSelect,
	selectedExecution,
}: {
	executions: ManagedSchedulerExecutionView[];
	error: string;
	filterJobKey: string;
	jobs: ManagedSchedulerJobView[];
	loading: boolean;
	onFilterChange: (jobKey: string) => void;
	onRetry: () => void;
	onSelect: (execution: ManagedSchedulerExecutionView) => void;
	selectedExecution: ManagedSchedulerExecutionView | null;
}) {
	return (
		<div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)]">
			<div className="flex flex-col gap-3 border-[var(--border)] border-b p-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p className="text-[13px] font-bold text-[var(--foreground)]">
						Lịch sử chạy
					</p>
					<p className="mt-1 text-[12px] text-[var(--muted)]">
						Xem job đã chạy thủ công hay theo lịch và kết quả gần đây.
					</p>
				</div>
				<select
					value={filterJobKey}
					onChange={(event) => onFilterChange(event.target.value)}
					className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-[12px]"
				>
					<option value="all">Tất cả job</option>
					{jobs.map((job) => (
						<option key={job.jobKey} value={job.jobKey}>
							{labelForJob(job)}
						</option>
					))}
				</select>
			</div>
			<div className="divide-y divide-[var(--border)]">
				{loading ? (
					<div className="p-4 text-[12px] text-[var(--muted)]">
						Đang tải lịch sử...
					</div>
				) : error ? (
					<div className="flex flex-col gap-3 p-4 text-[12px] text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
						<p className="font-semibold text-[var(--warning-strong)]">
							Không thể tải lịch sử chạy: {error}
						</p>
						<button
							type="button"
							onClick={onRetry}
							className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border)] px-3 text-[12px] font-bold text-[var(--foreground)]"
						>
							Thử lại
						</button>
					</div>
				) : executions.length > 0 ? (
					executions.map((execution) => (
						<button
							type="button"
							key={execution.id}
							onClick={() => onSelect(execution)}
							className="grid w-full gap-2 p-3 text-left transition hover:bg-[var(--surface-soft)] sm:grid-cols-[minmax(0,1fr)_120px_90px_80px]"
						>
							<div className="min-w-0">
								<p className="truncate text-[12px] font-bold text-[var(--foreground)]">
									{labelForExecution(execution, jobs)}
								</p>
								<p className="mt-1 text-[11px] text-[var(--muted)]">
									{execution.source === "manual" ? "Chạy thủ công" : "Theo lịch"}
								</p>
								{executionFailureInsight(execution) ? (
									<p className="mt-1 line-clamp-2 text-[11px] font-semibold text-[var(--warning-strong)]">
										{executionFailureInsight(execution)}
									</p>
								) : null}
							</div>
							<p className="text-[11px] text-[var(--muted)]">
								{formatDate(execution.startedAt)}
							</p>
							<p className="text-[11px] font-bold text-[var(--foreground)]">
								{execution.status}
							</p>
							<p className="text-[11px] text-[var(--muted)]">
								{formatDuration(execution.durationMs)}
							</p>
						</button>
					))
				) : (
					<div className="p-4 text-[12px] text-[var(--muted)]">
						Chưa ghi nhận lần chạy nào.
					</div>
				)}
			</div>
			{selectedExecution ? (
				<div className="border-[var(--border)] border-t p-3">
					<div className="grid gap-3 sm:grid-cols-4">
						<Metric label="Kết quả" value={selectedExecution.status} />
						<Metric label="Nguồn" value={selectedExecution.source === "manual" ? "Thủ công" : "Theo lịch"} />
						<Metric label="HTTP" value={selectedExecution.httpStatus?.toString() ?? "Chưa có"} />
						<Metric label="Thời lượng" value={formatDuration(selectedExecution.durationMs)} />
					</div>
					{selectedExecution.error || selectedExecution.response ? (
						<div className="mt-3 space-y-2">
							{executionFailureInsight(selectedExecution) ? (
								<p className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3 text-[11px] font-semibold leading-5 text-[var(--warning-strong)]">
									{executionFailureInsight(selectedExecution)}
								</p>
							) : null}
							<pre className="max-h-40 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-[11px] text-[var(--foreground)]">
								{selectedExecution.error ?? selectedExecution.response}
							</pre>
						</div>
					) : null}
				</div>
			) : null}
		</div>
	);
}

function EmptyState({
	configured,
	hasLocalScheduler,
	remoteStatusUnavailable,
}: {
	configured: boolean;
	hasLocalScheduler: boolean;
	remoteStatusUnavailable: boolean;
}) {
	const title =
		hasLocalScheduler && remoteStatusUnavailable
			? "Đã cấu hình cục bộ, chưa lấy được trạng thái Tuturuuu"
			: configured
				? "Chưa có job nào"
				: "Chưa thiết lập managed scheduler";
	const description =
		hasLocalScheduler && remoteStatusUnavailable
			? "CS35 vẫn giữ token cục bộ. Bạn có thể thử chạy job thủ công hoặc mở trang vận hành Tuturuuu để kiểm tra trạng thái managed cron."
			: "Thiết lập sẽ tạo lịch xử lý hàng đợi mỗi 5 phút và tạo scan theo dõi mỗi giờ.";

	return (
		<div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-center">
			<p className="text-[13px] font-bold text-[var(--foreground)]">
				{title}
			</p>
			<p className="mt-1 text-[12px] text-[var(--muted)]">
				{description}
			</p>
		</div>
	);
}

function StorageNotReadyNotice({ message }: { message: string }) {
	return (
		<div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3">
			<p className="text-[13px] font-bold text-[var(--warning-strong)]">
				Cần cập nhật cơ sở dữ liệu
			</p>
			<p className="mt-1 text-[12px] leading-5 text-[var(--muted-strong)]">
				{message}
			</p>
			<code className="mt-3 inline-flex rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-bold text-[var(--foreground)]">
				bun db:migrate
			</code>
		</div>
	);
}

function LocalSchedulerConfiguredNotice() {
	return (
		<div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
			<p className="text-[13px] font-bold text-[var(--foreground)]">
				Đã cấu hình cục bộ, chưa lấy được trạng thái Tuturuuu
			</p>
			<p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
				CS35 vẫn có token managed scheduler. Các job mặc định bên dưới có thể
				chạy thủ công, nhưng lịch và trạng thái chính xác cần Tuturuuu phản hồi
				thành công.
			</p>
		</div>
	);
}

function SetupBlockedNotice({
	adminRecoveryHref,
	code,
	message,
	missingApprovalItems,
	setupOrigin,
}: {
	adminRecoveryHref?: string;
	code?: string;
	message: string;
	missingApprovalItems?: string[];
	setupOrigin?: string;
}) {
	return (
		<div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3">
			<p className="text-[13px] font-bold text-[var(--warning-strong)]">
				{code === "VERCEL_CRON_SECRET_MISSING"
					? "Cần cấu hình Vercel Cron"
					: "Cần cấu hình URL public"}
			</p>
			<p className="mt-1 text-[12px] leading-5 text-[var(--muted-strong)]">
				{message}
			</p>
			{missingApprovalItems?.length ? (
				<p className="mt-2 text-[12px] leading-5 text-[var(--muted-strong)]">
					Đang thiếu: {formatApprovalItems(missingApprovalItems)}.
				</p>
			) : null}
			{setupOrigin ? (
				<code className="mt-3 inline-flex max-w-full overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-bold text-[var(--foreground)]">
					<span className="truncate">{setupOrigin}</span>
				</code>
			) : null}
			{adminRecoveryHref ? (
				<a
					href={adminRecoveryHref}
					className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--foreground)] transition hover:bg-[var(--surface-soft)]"
				>
					<ExternalLink size={14} />
					Mở trang vận hành Tuturuuu
				</a>
			) : null}
		</div>
	);
}

function SchedulerSkeleton() {
	return (
		<div className="space-y-3">
			<div className="grid gap-3 sm:grid-cols-3">
				{["a", "b", "c"].map((key) => (
					<div
						key={key}
						className="h-16 animate-pulse rounded-lg bg-[var(--surface-elevated)]"
					/>
				))}
			</div>
			<div className="h-20 animate-pulse rounded-lg bg-[var(--surface-elevated)]" />
		</div>
	);
}

function InlineError({ message }: { message: string }) {
	return (
		<div className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-soft)] px-3 py-2 text-[12px] font-bold text-[var(--danger-strong)]">
			{message}
		</div>
	);
}

function approvalCopy(missingApprovalItems?: string[]) {
	if (!missingApprovalItems?.length) {
		return "Thiết lập sẽ tự thử lại khi bạn quay về màn hình này.";
	}

	return `Cần duyệt ${formatApprovalItems(
		missingApprovalItems,
	)} trước khi thiết lập. Thiết lập sẽ tự thử lại khi bạn quay về màn hình này.`;
}

function formatApprovalItems(items: string[]) {
	const labels = items.map((item) => {
		if (item === "domain") return "domain whitelist";
		if (item === "origin") return "origin ứng dụng";
		if (item === "workspace") return "workspace binding";
		if (item === "scopes") return "scope truy cập";
		return item;
	});

	if (labels.length <= 1) return labels[0] ?? "";
	return `${labels.slice(0, -1).join(", ")} và ${labels.at(-1)}`;
}

type ScheduleKind = "daily" | "hourly" | "hours" | "minutes" | "weekly";

const WEEKDAY_OPTIONS = [
	{ label: "CN", value: 0 },
	{ label: "T2", value: 1 },
	{ label: "T3", value: 2 },
	{ label: "T4", value: 3 },
	{ label: "T5", value: 4 },
	{ label: "T6", value: 5 },
	{ label: "T7", value: 6 },
] as const;

function schedulerFreshness(value: string | null) {
	if (!value) return { ageMs: null, stale: false };
	const timestamp = Date.parse(value);
	if (!Number.isFinite(timestamp)) return { ageMs: null, stale: false };
	const ageMs = Math.max(0, Date.now() - timestamp);
	return { ageMs, stale: ageMs > 2 * 60_000 };
}

function nearestNextJob(jobs: ManagedSchedulerJobView[]) {
	return jobs
		.filter((job) => job.active && job.nextRunAt)
		.sort(
			(left, right) =>
				Date.parse(left.nextRunAt ?? "") - Date.parse(right.nextRunAt ?? ""),
		)[0] ?? null;
}

function scheduleFormFromCron(job: ManagedSchedulerJobView) {
	const parts = job.schedule.trim().split(/\s+/u);
	const [minute = "0", hour = "*", , , weekday = "*"] = parts;
	if (/^\*\/(5|10|15|30)$/u.test(minute) && hour === "*") {
		return {
			hourInterval: 2,
			kind: "minutes" as ScheduleKind,
			minutes: Number(minute.slice(2)),
			time: "09:00",
			weekdays: [1],
		};
	}
	if (minute === "0" && hour === "*") {
		return {
			hourInterval: 2,
			kind: "hourly" as ScheduleKind,
			minutes: 5,
			time: "09:00",
			weekdays: [1],
		};
	}
	if (/^\*\/(2|4|6|12)$/u.test(hour)) {
		return {
			hourInterval: Number(hour.slice(2)),
			kind: "hours" as ScheduleKind,
			minutes: 5,
			time: "09:00",
			weekdays: [1],
		};
	}
	if (weekday !== "*") {
		return {
			hourInterval: 2,
			kind: "weekly" as ScheduleKind,
			minutes: 5,
			time: cronTime(minute, hour),
			weekdays: weekday
				.split(",")
				.map((value) => Number(value))
				.filter((value) => Number.isInteger(value) && value >= 0 && value <= 6),
		};
	}
	if (minute !== "*" && hour !== "*") {
		return {
			hourInterval: 2,
			kind: "daily" as ScheduleKind,
			minutes: 5,
			time: cronTime(minute, hour),
			weekdays: [1],
		};
	}
	return {
		hourInterval: 2,
		kind: "minutes" as ScheduleKind,
		minutes: 5,
		time: "09:00",
		weekdays: [1],
	};
}

function cronTime(minute: string, hour: string) {
	return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function buildSchedule({
	hourInterval,
	kind,
	minutes,
	time,
	weekdays,
}: {
	hourInterval: number;
	kind: ScheduleKind;
	minutes: number;
	time: string;
	weekdays: number[];
}) {
	const [hour = "9", minute = "0"] = time.split(":");
	if (kind === "minutes") return `*/${minutes} * * * *`;
	if (kind === "hourly") return "0 * * * *";
	if (kind === "hours") return `0 */${hourInterval} * * *`;
	if (kind === "daily") return `${Number(minute)} ${Number(hour)} * * *`;
	if (kind === "weekly") {
		const days = [...new Set(weekdays)].sort((a, b) => a - b).join(",");
		return days ? `${Number(minute)} ${Number(hour)} * * ${days}` : "";
	}
	return "";
}

function describeSchedule(job: ManagedSchedulerJobView) {
	return `${job.schedule} · ${job.scheduleTimezone ?? "UTC"}`;
}

function describeScheduleFromForm({
	hourInterval,
	kind,
	minutes,
	time,
	weekdays,
}: {
	hourInterval: number;
	kind: ScheduleKind;
	minutes: number;
	time: string;
	weekdays: number[];
}) {
	if (kind === "minutes") return `Chạy mỗi ${minutes} phút.`;
	if (kind === "hourly") return "Chạy vào đầu mỗi giờ.";
	if (kind === "hours") return `Chạy mỗi ${hourInterval} giờ.`;
	if (kind === "daily") return `Chạy hằng ngày lúc ${time}.`;
	const labels = WEEKDAY_OPTIONS.filter((day) =>
		weekdays.includes(day.value),
	).map((day) => day.label);
	return labels.length
		? `Chạy lúc ${time} vào ${labels.join(", ")}.`
		: "Chọn ít nhất một ngày trong tuần.";
}

function toggleWeekday(days: number[], value: number) {
	if (days.includes(value)) return days.filter((day) => day !== value);
	return [...days, value].sort((left, right) => left - right);
}

function labelForExecution(
	execution: ManagedSchedulerExecutionView,
	jobs: ManagedSchedulerJobView[],
) {
	const job = jobs.find((candidate) => candidate.jobKey === execution.jobKey);
	return job ? labelForJob(job) : execution.jobName || execution.jobKey;
}

function executionFailureInsight(execution: ManagedSchedulerExecutionView) {
	if (execution.status === "success") return null;
	const detail = `${execution.error ?? ""} ${execution.response ?? ""}`.trim();
	const normalized = detail.toLowerCase();

	if (normalized.includes("fetch failed")) {
		return "Tuturuuu runner could not connect to the CS35 callback. The public CS35 URL responds externally, so check Tuturuuu container DNS, TLS, outbound network, or proxy logs.";
	}

	if (execution.httpStatus === 403 || /(^|\s)403(\s|$)|forbidden/iu.test(detail)) {
		return "CS35 rejected the scheduler token. Rotate the managed scheduler token, then retry setup so Tuturuuu stores the new callback secret.";
	}

	if (normalized.includes("cs35_managed_scheduler_callback_failed")) {
		return "The request reached CS35, but the callback failed inside CS35. Check CS35 server logs and the scan database/provider configuration.";
	}

	return null;
}

function SchedulerLoadError({
	message,
	onRetry,
	retrying,
}: {
	message: string;
	onRetry: () => void;
	retrying: boolean;
}) {
	return (
		<div className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-soft)] p-3">
			<p className="text-[13px] font-bold text-[var(--danger-strong)]">
				Không thể kiểm tra managed scheduler
			</p>
			<p className="mt-1 text-[12px] leading-5 text-[var(--muted-strong)]">
				{message ||
					"Không thể tải trạng thái lịch tự động. Thử lại sau khi kiểm tra quyền hoặc triển khai."}
			</p>
			<button
				type="button"
				onClick={onRetry}
				disabled={retrying}
				className="mt-3 inline-flex h-8 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--foreground)] transition hover:bg-[var(--surface-soft)] disabled:opacity-60"
			>
				{retrying ? (
					<Loader2 size={13} className="animate-spin" />
				) : (
					<RefreshCw size={13} />
				)}
				Thử lại
			</button>
		</div>
	);
}

function labelForJob(job: ManagedSchedulerJobView) {
	if (job.jobKey === "process-queue") return "Xử lý hàng đợi";
	if (job.jobKey === "enqueue-tracked-sources") return "Tạo scan theo dõi";
	return job.name;
}

function formatDate(value: string | null) {
	if (!value) return "Chưa có";

	try {
		return new Intl.DateTimeFormat("vi-VN", {
			dateStyle: "short",
			timeStyle: "short",
		}).format(new Date(value));
	} catch {
		return value;
	}
}

function formatDuration(value: number | null) {
	if (value == null) return "Chưa có";
	if (value < 1000) return `${value}ms`;
	return `${(value / 1000).toFixed(1)}s`;
}

async function setupManagedScheduler() {
	const response = await fetch("/api/workspace/cron/setup", {
		credentials: "same-origin",
		headers: { Accept: "application/json" },
		method: "POST",
	});
	return parseManagedSchedulerStatusResponse(response);
}

async function runJobNow(jobKey: string) {
	const response = await fetch(
		`/api/workspace/cron/jobs/${encodeURIComponent(jobKey)}/run-now`,
		{
			credentials: "same-origin",
			headers: { Accept: "application/json" },
			method: "POST",
		},
	);
	const payload = await response.json().catch(() => null);
	if (!response.ok) throw new Error(managedSchedulerErrorMessage(payload));
	return payload;
}

async function patchJob({
	enabled,
	jobKey,
	schedule,
	scheduleTimezone,
}: {
	enabled?: boolean;
	jobKey: string;
	schedule?: string;
	scheduleTimezone?: string;
}) {
	const response = await fetch(
		`/api/workspace/cron/jobs/${encodeURIComponent(jobKey)}`,
		{
			body: JSON.stringify({ enabled, schedule, scheduleTimezone }),
			credentials: "same-origin",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
			method: "PATCH",
		},
	);
	const payload = await response.json().catch(() => null);
	if (!response.ok) throw new Error(managedSchedulerErrorMessage(payload));
	return payload;
}
