"use client";

import {
	Clock3,
	ExternalLink,
	Loader2,
	Pause,
	Play,
	RefreshCw,
	RotateCw,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
	ManagedSchedulerJobView,
} from "@/components/dashboard/types";
import { Panel, PanelHeader } from "@/components/dashboard/ui-primitives";
import { managedSchedulerQueryOptions } from "@/lib/dashboard/client-queries";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";
import {
	managedSchedulerErrorMessage,
	parseManagedSchedulerStatusResponse,
} from "@/lib/managed-scheduler/client";

export function ManagedSchedulerPanel({
	autoRetryToken,
}: {
	autoRetryToken?: number;
}) {
	const queryClient = useQueryClient();
	const handledAutoRetry = useRef<number | undefined>(undefined);
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
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: dashboardQueryKeys.managedScheduler(),
			}),
	});
	const patchMutation = useMutation({
		mutationFn: patchJob,
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: dashboardQueryKeys.managedScheduler(),
			}),
	});

	useEffect(() => {
		if (!autoRetryToken || handledAutoRetry.current === autoRetryToken) return;
		handledAutoRetry.current = autoRetryToken;
		setupMutation.mutate();
	}, [autoRetryToken, setupMutation]);

	const status = setupMutation.data ?? query.data;
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
	const error =
		setupMutation.error instanceof Error
			? setupMutation.error.message
			: queryUnavailable && query.error instanceof Error
				? query.error.message
				: !storageNotReady && status?.error
					? status.error
				: "";

	return (
		<Panel>
			<PanelHeader
				title="Managed scheduler"
				description="Tự động tạo lịch quét định kỳ và xử lý hàng đợi khi worker riêng chưa chạy."
				action={
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
							Cần duyệt quyền managed scheduler
						</p>
						<p className="mt-1 text-[12px] leading-5 text-[var(--muted-strong)]">
							Thiết lập sẽ tự thử lại khi bạn quay về màn hình này.
						</p>
						<a
							href={status.approvalHref}
							className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--foreground)] transition hover:bg-[var(--surface-soft)]"
						>
							<ExternalLink size={14} />
							Duyệt thiết lập
						</a>
					</div>
				) : null}
				{status && !query.isLoading ? (
					<>
						<div className="grid gap-3 sm:grid-cols-3">
							<Metric label="Trạng thái" value={status.enabled ? "Đang bật" : "Tạm dừng"} />
							<Metric
								label="Token"
								value={status.tokenLastFour ? `...${status.tokenLastFour}` : "Chưa có"}
							/>
							<Metric label="Cập nhật" value={formatDate(status.updatedAt)} />
						</div>
						{status.jobs.length > 0 ? (
							<div className="space-y-2">
								{status.jobs.map((job) => (
									<SchedulerJobRow
										key={job.jobKey}
										job={job}
										onPatch={(enabled) =>
											patchMutation.mutate({ enabled, jobKey: job.jobKey })
										}
										onRun={() => runMutation.mutate(job.jobKey)}
										pending={
											runMutation.isPending ||
											patchMutation.isPending ||
											Boolean(status.setupDisabled)
										}
									/>
								))}
							</div>
						) : (
							<EmptyState configured={status.configured} />
						)}
					</>
				) : null}
			</div>
		</Panel>
	);
}

function SchedulerJobRow({
	job,
	onPatch,
	onRun,
	pending,
}: {
	job: ManagedSchedulerJobView;
	onPatch: (enabled: boolean) => void;
	onRun: () => void;
	pending: boolean;
}) {
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
				</div>
				<p className="mt-1 text-[11px] text-[var(--muted)]">
					{job.schedule} · chạy gần nhất {formatDate(job.lastRunAt)} · lần tới{" "}
					{formatDate(job.nextRunAt)}
				</p>
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
					disabled={pending}
					onClick={onRun}
					title="Chạy ngay"
					className="grid size-9 place-items-center rounded-md border border-[var(--border)] text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)] disabled:opacity-60"
				>
					<Play size={14} />
				</button>
				<button
					type="button"
					disabled={pending}
					onClick={() => onPatch(!job.active)}
					title={job.active ? "Tạm dừng" : "Bật lại"}
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

function EmptyState({ configured }: { configured: boolean }) {
	return (
		<div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-center">
			<p className="text-[13px] font-bold text-[var(--foreground)]">
				{configured ? "Chưa có job nào" : "Chưa thiết lập managed scheduler"}
			</p>
			<p className="mt-1 text-[12px] text-[var(--muted)]">
				Thiết lập sẽ tạo lịch xử lý hàng đợi mỗi 5 phút và tạo scan theo dõi mỗi giờ.
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
}: {
	enabled: boolean;
	jobKey: string;
}) {
	const response = await fetch(
		`/api/workspace/cron/jobs/${encodeURIComponent(jobKey)}`,
		{
			body: JSON.stringify({ enabled }),
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
