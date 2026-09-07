"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Activity,
	Bot,
	CheckCircle2,
	ChevronRight,
	CircleDot,
	Clock3,
	Database,
	FileSearch,
	Gauge,
	Layers3,
	MonitorCog,
	Coins,
	Search,
	RefreshCw,
	Trash2,
	TriangleAlert,
	Workflow,
	type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { WorkspaceTabs } from "./workspace-tabs";
import { useConfirmDialog } from "./confirm-dialog";

import { IntentPrefetchLink } from "@/components/dashboard/intent-prefetch-link";
import { ProviderCostPanel } from "./provider-cost-panel";
import { PageHeader } from "@/components/dashboard/page-header";
import type {
	OperationsJobView,
	OperationsOverview,
	OperationsPipelineEventView,
} from "@/components/dashboard/types";
import {
	Panel,
	PanelHeader,
	StatusPill,
} from "@/components/dashboard/ui-primitives";
import {
	managedSchedulerQueryOptions,
	operationsOverviewQueryOptions,
} from "@/lib/dashboard/client-queries";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";
import { intelligenceProviderLabel } from "@/components/dashboard/intelligence-workspace-shared";

const stages: Array<{
	description: string;
	icon: LucideIcon;
	key: string;
	label: string;
}> = [
	{
		description: "Ưu tiên và khóa an toàn",
		icon: Clock3,
		key: "queue",
		label: "Hàng đợi",
	},
	{
		description: "Thu thập từ nguồn",
		icon: FileSearch,
		key: "provider",
		label: "Thu thập",
	},
	{
		description: "Chuẩn hóa bản ghi",
		icon: Database,
		key: "evidence",
		label: "Bằng chứng",
	},
	{
		description: "Rủi ro và lập trường",
		icon: Bot,
		key: "analysis",
		label: "Phân tích AI",
	},
	{
		description: "Nhóm và liên kết",
		icon: Layers3,
		key: "topics",
		label: "Chủ đề",
	},
	{
		description: "Sẵn sàng sử dụng",
		icon: CheckCircle2,
		key: "complete",
		label: "Hoàn tất",
	},
];

export function OperationsPage() {
	const queryClient = useQueryClient();
	const [notice, setNotice] = useState("");
	const [noticeIsError, setNoticeIsError] = useState(false);
	const { confirm, dialog } = useConfirmDialog();
	const params = useSearchParams();
	const pathname = usePathname();
	const requestedView = params.get("view");
	const view =
		operationViews.find((item) => item.id === requestedView)?.id ?? "overview";
	const selectView = (next: string) => {
		const search = new URLSearchParams(params);
		search.set("view", next);
		window.history.pushState(null, "", `${pathname}?${search}`);
	};
	const overviewQuery = useQuery(operationsOverviewQueryOptions());
	const schedulerQuery = useQuery(managedSchedulerQueryOptions());
	const runMutation = useMutation({
		mutationFn: runSchedulerJob,
		onError: (error) => {
			setNoticeIsError(true);
			setNotice(error.message);
		},
		onMutate: () => {
			setNoticeIsError(false);
			setNotice("");
		},
		onSuccess: async (result) => {
			setNoticeIsError(false);
			setNotice(result.message);
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: dashboardQueryKeys.operationsOverview(),
				}),
				queryClient.invalidateQueries({
					queryKey: dashboardQueryKeys.managedScheduler(),
				}),
			]);
		},
	});
	const cleanupMutation = useMutation({
		mutationFn: async () => {
			const response = await fetch("/api/operations/chat-cleanup", {
				method: "POST",
			});
			const payload = await response.json().catch(() => null);
			if (!response.ok)
				throw new Error(payload?.error ?? "Không thể dọn tệp Drive.");
			return payload as { attempted: number; completed: number };
		},
		onError: (error) => {
			setNoticeIsError(true);
			setNotice(error.message);
		},
		onSuccess: async (result) => {
			setNoticeIsError(false);
			setNotice(
				`Đã kiểm tra ${result.attempted} Chat và hoàn tất ${result.completed} tác vụ dọn Drive.`,
			);
			await queryClient.invalidateQueries({
				queryKey: dashboardQueryKeys.operationsOverview(),
			});
		},
	});
	const overview = overviewQuery.data;
	const health = useMemo(() => operationsHealth(overview), [overview]);

	return (
		<div className="space-y-6">
			{dialog}
			<PageHeader
				icon={MonitorCog}
				title="Vận hành hệ thống"
				description="Theo dõi tiến độ thu thập, kiểm tra kết nối và đối soát chi phí tại một nơi."
				actions={
					<>
						<button
							type="button"
							disabled={overviewQuery.isFetching}
							onClick={() => {
								void overviewQuery.refetch();
								void schedulerQuery.refetch();
							}}
							className={secondaryButtonClass}
						>
							<RefreshCw
								size={15}
								className={overviewQuery.isFetching ? "animate-spin" : ""}
							/>{" "}
							Làm mới
						</button>
						<button
							type="button"
							disabled={runMutation.isPending}
							onClick={() => runMutation.mutate("daily-scans")}
							className={primaryButtonClass}
						>
							<RefreshCw
								size={15}
								className={runMutation.isPending ? "animate-spin" : ""}
							/>
							{runMutation.isPending ? "Đang xếp lịch…" : "Quét nguồn ngay"}
						</button>
					</>
				}
			/>
			{notice ? (
				<p
					role={noticeIsError ? "alert" : "status"}
					className={`rounded-xl border px-4 py-3 text-sm ${noticeIsError ? "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger-strong)]" : "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success-strong)]"}`}
				>
					{notice}
				</p>
			) : null}
			{overviewQuery.isError && overview ? (
				<p
					role="alert"
					className="rounded-xl bg-[var(--warning-soft)] p-4 text-sm text-[var(--warning-strong)]"
				>
					Không thể làm mới. Dữ liệu bên dưới là lần tải thành công gần nhất.{" "}
					<button
						type="button"
						className="underline"
						onClick={() => void overviewQuery.refetch()}
					>
						Thử lại
					</button>
				</p>
			) : null}
			<WorkspaceTabs
				label="Khu vực vận hành"
				items={operationViews}
				value={view}
				onChange={selectView}
			>
				{view === "costs" ? (
					<ProviderCostPanel />
				) : overview ? (
					<>
						{view === "overview" ? (
							<>
								<HealthBanner health={health} overview={overview} />
								<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
									<MetricCard
										icon={Clock3}
										label="Chờ xử lý"
										value={(
											overview.queue.queued + overview.queue.retrying
										).toLocaleString("vi-VN")}
										help={
											overview.oldestQueuedAgeSeconds === null
												? "Không có lượt quét đang chờ"
												: `Lượt cũ nhất: ${formatDuration(overview.oldestQueuedAgeSeconds * 1000)}`
										}
										tone={overview.queue.retrying ? "warning" : "neutral"}
									/>
									<MetricCard
										icon={Activity}
										label="Đang xử lý"
										value={overview.queue.running.toLocaleString("vi-VN")}
										help="Lượt quét đang thu thập hoặc phân tích"
										tone={overview.queue.running ? "accent" : "neutral"}
									/>
									<MetricCard
										icon={Gauge}
										label="Hoàn tất 24 giờ"
										value={overview.throughput24h.completed.toLocaleString(
											"vi-VN",
										)}
										help={`Thời gian trung bình ${formatDuration(overview.throughput24h.averageDurationMs)}`}
										tone="success"
									/>
									<MetricCard
										icon={CheckCircle2}
										label="Tỷ lệ thành công"
										value={
											overview.throughput24h.completed +
											overview.throughput24h.failed
												? `${overview.throughput24h.successRate}%`
												: "—"
										}
										help={`${overview.throughput24h.failed} lượt lỗi trong 24 giờ`}
										tone={overview.throughput24h.failed ? "warning" : "neutral"}
									/>
								</div>
								<RecentJobsPanel jobs={overview.recentJobs} />
								<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
									<div>
										<h2 className="text-sm font-semibold">
											Quản lý lịch thu thập
										</h2>
										<p className="mt-1 text-sm text-[var(--muted)]">
											Chọn nguồn và tần suất trong Nguồn & Quét. Quét thủ công
											có thể phát sinh chi phí nhà cung cấp.
										</p>
									</div>
									<IntentPrefetchLink
										href="/sources"
										className={secondaryButtonClass}
									>
										Quản lý nguồn <ChevronRight size={15} />
									</IntentPrefetchLink>
								</div>
							</>
						) : null}
						{view === "services" ? (
							<>
								<div className="grid items-start gap-5 xl:grid-cols-2">
									<ServicePanel
										overview={overview}
										schedulerReady={Boolean(schedulerQuery.data?.enabled)}
									/>
									<ProviderPanel overview={overview} />
								</div>
								{schedulerQuery.isError ? (
									<p
										role="alert"
										className="text-sm text-[var(--danger-strong)]"
									>
										Không thể kiểm tra lịch tự động.{" "}
										<button
											type="button"
											className="underline"
											onClick={() => void schedulerQuery.refetch()}
										>
											Thử lại
										</button>
									</p>
								) : null}
								<Panel>
									<PanelHeader
										title="Các bước xử lý"
										description="Mỗi lượt quét đi qua sáu bước. Số đếm là sự kiện gần đây, không phải số lượt đang chạy."
									/>
									<div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
										{stages.map((stage) => (
											<PipelineStage
												key={stage.key}
												stage={stage}
												count={
													overview.pipelineEvents.filter(
														(event) => event.stage === stage.key,
													).length
												}
												isLast
											/>
										))}
									</div>
								</Panel>
								<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
									<MetricCard
										icon={Bot}
										label="Lượt Chat đang xử lý"
										value={String(overview.chat.runningRuns)}
										help={`${overview.chat.failedRuns24h} lỗi trong 24 giờ`}
										tone={overview.chat.failedRuns24h ? "warning" : "neutral"}
									/>
									<MetricCard
										icon={FileSearch}
										label="Tệp đang xử lý"
										value={String(overview.chat.attachmentsProcessing)}
										help="Đang trích xuất nội dung tệp"
										tone="neutral"
									/>
									<MetricCard
										icon={TriangleAlert}
										label="Tệp cần kiểm tra"
										value={String(overview.chat.attachmentsFailed)}
										help="Mở cuộc trò chuyện để thử lại"
										tone={
											overview.chat.attachmentsFailed ? "warning" : "neutral"
										}
									/>
									<MetricCard
										icon={Trash2}
										label="Tệp chờ dọn"
										value={String(overview.chat.attachmentsDeleting)}
										help="Tệp đã được đánh dấu xóa"
										tone="neutral"
									/>
								</div>
								<Panel>
									<PanelHeader
										title="Bảo trì tệp"
										description="Hoàn tất việc xóa tệp của các cuộc trò chuyện đã được đánh dấu xóa."
										action={
											<button
												type="button"
												disabled={cleanupMutation.isPending}
												className={secondaryButtonClass}
												onClick={async () => {
													if (
														await confirm({
															title: "Dọn tệp đã đánh dấu xóa?",
															description:
																"Tệp chờ xóa sẽ được gỡ khỏi Drive. Thao tác này không thể khôi phục tệp đã xóa.",
															confirmLabel: "Dọn tệp",
															tone: "danger",
														})
													)
														cleanupMutation.mutate();
												}}
											>
												<Trash2 size={15} />
												{cleanupMutation.isPending
													? "Đang dọn…"
													: "Dọn tệp Drive"}
											</button>
										}
									/>
								</Panel>
							</>
						) : null}
						{view === "activity" ? (
							<EventStream events={overview.pipelineEvents} />
						) : null}
					</>
				) : overviewQuery.isError ? (
					<ErrorPanel
						message={overviewQuery.error.message}
						onRetry={() => void overviewQuery.refetch()}
					/>
				) : (
					<div
						role="status"
						aria-label="Đang tải vận hành"
						className="space-y-4"
					>
						<div className="h-24 animate-pulse rounded-xl bg-[var(--surface)]" />
						<div className="h-64 animate-pulse rounded-xl bg-[var(--surface)]" />
						<p className="text-sm text-[var(--muted)]">
							Đang tải dữ liệu vận hành…
						</p>
					</div>
				)}
			</WorkspaceTabs>
			<div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
				<span>
					{overview
						? `Cập nhật ${formatDate(overview.generatedAt)} · giờ Việt Nam`
						: "Chưa có dữ liệu"}
				</span>
				<span className="inline-flex items-center gap-2">
					<CircleDot size={12} /> Tự làm mới 15 giây
				</span>
			</div>
		</div>
	);
}

const operationViews = [
	{ id: "overview", label: "Tổng quan", icon: Activity },
	{ id: "services", label: "Kết nối & bảo trì", icon: MonitorCog },
	{ id: "costs", label: "Chi phí & AI", icon: Coins },
	{ id: "activity", label: "Nhật ký xử lý", icon: Workflow },
] as const;

function HealthBanner({
	health,
	overview,
}: {
	health: ReturnType<typeof operationsHealth>;
	overview: OperationsOverview;
}) {
	const Icon =
		health.tone === "danger"
			? TriangleAlert
			: health.tone === "warning"
				? Clock3
				: CheckCircle2;
	return (
		<section
			className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${health.tone === "danger" ? "border-[var(--danger-strong)] bg-[var(--danger-soft)]" : health.tone === "warning" ? "border-[var(--warning-border)] bg-[var(--warning-soft)]" : "border-[var(--success-border)] bg-[var(--success-soft)]"}`}
		>
			<div className="flex items-start gap-3">
				<Icon
					className={
						health.tone === "danger"
							? "text-[var(--danger-strong)]"
							: health.tone === "warning"
								? "text-[var(--warning-strong)]"
								: "text-[var(--success-strong)]"
					}
				/>
				<div>
					<h2 className="text-sm font-semibold text-[var(--foreground)]">
						{health.title}
					</h2>
					<p className="mt-1 text-xs font-semibold leading-5 text-[var(--muted-strong)]">
						{health.description}
					</p>
				</div>
			</div>
			<div className="flex shrink-0 gap-4 text-center text-xs">
				<div>
					<strong className="block text-base text-[var(--foreground)]">
						{overview.queue.failed}
					</strong>
					Lỗi tổng
				</div>
				<div>
					<strong className="block text-base text-[var(--foreground)]">
						{
							overview.services.filter(
								(service) => service.health === "healthy",
							).length
						}
						/
						{
							overview.services.filter(
								(service) => service.health !== "inactive",
							).length
						}
					</strong>
					Dịch vụ khỏe
				</div>
			</div>
		</section>
	);
}

function MetricCard({
	help,
	icon: Icon,
	label,
	tone,
	value,
}: {
	help: string;
	icon: LucideIcon;
	label: string;
	tone: "accent" | "neutral" | "success" | "warning";
	value: string;
}) {
	const colors = {
		accent: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
		neutral: "bg-[var(--neutral-soft)] text-[var(--muted-strong)]",
		success: "bg-[var(--success-soft)] text-[var(--success-strong)]",
		warning: "bg-[var(--warning-soft)] text-[var(--warning-strong)]",
	};
	return (
		<article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
			<div className="flex items-center justify-between gap-3">
				<span
					className={`grid size-9 place-items-center rounded-md ${colors[tone]}`}
				>
					<Icon size={17} />
				</span>
				<strong className="text-2xl font-semibold text-[var(--foreground)]">
					{value}
				</strong>
			</div>
			<h2 className="mt-3 text-xs font-bold text-[var(--foreground)]">
				{label}
			</h2>
			<p className="mt-1 text-xs font-semibold leading-4 text-[var(--muted)]">
				{help}
			</p>
		</article>
	);
}

function PipelineStage({
	count,
	isLast,
	stage,
}: {
	count: number;
	isLast: boolean;
	stage: (typeof stages)[number];
}) {
	const Icon = stage.icon;
	return (
		<div className="relative flex min-w-0 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
			<span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)]">
				<Icon size={16} />
			</span>
			<div className="min-w-0">
				<div className="flex items-center gap-2">
					<h3 className="truncate text-xs font-semibold text-[var(--foreground)]">
						{stage.label}
					</h3>
					<span className="rounded-full bg-[var(--surface)] px-1.5 text-xs font-bold text-[var(--muted)]">
						{count}
					</span>
				</div>
				<p className="mt-1 truncate text-xs font-semibold text-[var(--muted)]">
					{stage.description}
				</p>
			</div>
			{isLast ? null : (
				<ChevronRight
					size={14}
					className="absolute -right-2.5 z-10 hidden text-[var(--muted)] xl:block"
				/>
			)}
		</div>
	);
}

function RecentJobsPanel({ jobs }: { jobs: OperationsJobView[] }) {
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState("all");
	const visible = jobs.filter(
		(job) =>
			(status === "all" || job.status === status) &&
			job.sourceLabel
				.toLocaleLowerCase("vi")
				.includes(search.toLocaleLowerCase("vi").trim()),
	);
	return (
		<Panel>
			<PanelHeader
				title="Lượt quét gần đây"
				description="Tìm nguồn, lọc trạng thái hoặc mở một lượt để kiểm tra kết quả."
				action={
					<span className="text-xs text-[var(--muted)]">
						{visible.length} / {jobs.length} lượt
					</span>
				}
			/>
			<div className="flex flex-col gap-3 border-b border-[var(--divider)] p-4 sm:flex-row">
				<label className="relative min-w-0 flex-1">
					<Search
						size={16}
						className="absolute left-3 top-3 text-[var(--muted)]"
					/>
					<input
						aria-label="Tìm lượt quét"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Tìm theo tên nguồn…"
						className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] pl-10 pr-3 text-sm"
					/>
				</label>
				<select
					aria-label="Trạng thái lượt quét"
					value={status}
					onChange={(event) => setStatus(event.target.value)}
					className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
				>
					<option value="all">Tất cả trạng thái</option>
					<option value="running">Đang xử lý</option>
					<option value="queued">Đang chờ</option>
					<option value="retrying">Đang thử lại</option>
					<option value="failed">Lỗi</option>
					<option value="completed">Hoàn tất</option>
				</select>
			</div>
			<div className="divide-y divide-[var(--divider)]">
				{visible.map((job) => (
					<IntentPrefetchLink
						key={job.id}
						href={`/scans/${job.id}`}
						className="grid gap-3 p-5 transition hover:bg-[var(--surface-soft)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
					>
						<div className="min-w-0">
							<h3 className="truncate text-sm font-semibold">
								{job.sourceLabel}
							</h3>
							<p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
								{intelligenceProviderLabel(job.provider)} ·{" "}
								{formatDate(job.createdAt)}
							</p>
							{job.errorMessage ? (
								<p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--danger-strong)]">
									{job.errorMessage}
								</p>
							) : null}
						</div>
						<div className="flex flex-wrap items-center gap-3">
							<div className="text-xs leading-5 text-[var(--muted)]">
								<p>
									{job.latestEvent
										? stageLabel(job.latestEvent.stage)
										: "Chờ xử lý"}
								</p>
								<p>
									{job.attempts}/{job.maxAttempts} lần thử ·{" "}
									{job.durationMs === null
										? "Chưa hoàn tất"
										: formatDuration(job.durationMs)}
								</p>
							</div>
							<StatusPill status={job.status} detail={job.errorMessage} />
							<ChevronRight size={15} aria-hidden="true" />
						</div>
					</IntentPrefetchLink>
				))}
				{!visible.length ? (
					<div className="p-8 text-center text-sm text-[var(--muted)]">
						<p>
							{jobs.length
								? "Không có lượt quét phù hợp bộ lọc."
								: "Chưa có lượt quét. Thêm nguồn để bắt đầu thu thập."}
						</p>
						{jobs.length ? (
							<button
								type="button"
								className="mt-3 underline"
								onClick={() => {
									setSearch("");
									setStatus("all");
								}}
							>
								Xóa bộ lọc
							</button>
						) : (
							<IntentPrefetchLink
								className="mt-3 inline-block underline"
								href="/sources"
							>
								Thêm nguồn
							</IntentPrefetchLink>
						)}
					</div>
				) : null}
			</div>
		</Panel>
	);
}

function ServicePanel({
	overview,
	schedulerReady,
}: {
	overview: OperationsOverview;
	schedulerReady: boolean;
}) {
	return (
		<Panel>
			<PanelHeader
				title="Tình trạng kết nối"
				description="Theo dõi lịch cron đang triển khai; heartbeat của bộ lập lịch cũ được giữ để đối chiếu."
				action={
					<span
						className={`rounded-full px-2 py-1 text-xs font-bold ${schedulerReady ? "bg-[var(--success-soft)] text-[var(--success-strong)]" : "bg-[var(--warning-soft)] text-[var(--warning-strong)]"}`}
					>
						{schedulerReady ? "Cron sẵn sàng" : "Cron cần cấu hình"}
					</span>
				}
			/>
			<div className="divide-y divide-[var(--divider)]">
				{overview.services.map((service) => (
					<div
						key={service.serviceName}
						className="flex items-center justify-between gap-3 px-4 py-3"
					>
						<div className="flex min-w-0 items-center gap-3">
							<span
								className={`size-2.5 shrink-0 rounded-full ${service.health === "healthy" ? "bg-[var(--success-strong)]" : service.health === "inactive" ? "bg-[var(--muted)]" : "bg-[var(--danger-strong)]"}`}
							/>
							<div className="min-w-0">
								<p className="truncate text-xs font-bold text-[var(--foreground)]">
									{service.label}
									{service.health === "inactive" ? " · Lịch sử" : ""}
								</p>
								<p className="mt-1 truncate text-xs font-semibold text-[var(--muted)]">
									{service.lastSeenAt
										? formatDate(service.lastSeenAt)
										: "Chưa có heartbeat"}
								</p>
							</div>
						</div>
						<span className="text-xs font-bold text-[var(--muted-strong)]">
							{service.ageSeconds === null
								? "—"
								: `${formatDuration(service.ageSeconds * 1000)} trước`}
						</span>
					</div>
				))}
				{overview.services.length ? null : (
					<div className="px-4 py-6 text-xs font-semibold text-[var(--muted)]">
						Chưa ghi nhận heartbeat. Chạy một job để khởi tạo tín hiệu.
					</div>
				)}
			</div>
		</Panel>
	);
}

function ProviderPanel({ overview }: { overview: OperationsOverview }) {
	return (
		<Panel>
			<PanelHeader
				title="Nhà cung cấp · 24 giờ"
				description="Tỷ lệ hoàn tất và độ trễ trung bình theo adapter thu thập."
			/>
			<div className="space-y-4 p-4">
				{overview.providers.map((provider) => (
					<div key={provider.provider}>
						<div className="flex items-center justify-between gap-3 text-xs">
							<span className="truncate font-bold text-[var(--foreground)]">
								{intelligenceProviderLabel(provider.provider)}
							</span>
							<span className="font-semibold text-[var(--muted-strong)]">
								{provider.successRate}%
							</span>
						</div>
						<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--neutral-soft)]">
							<div
								className={`h-full rounded-full ${provider.successRate < 90 ? "bg-[var(--warning-strong)]" : "bg-[var(--success-strong)]"}`}
								style={{ width: `${provider.successRate}%` }}
							/>
						</div>
						<p className="mt-1.5 text-xs font-semibold text-[var(--muted)]">
							{provider.completed} hoàn tất · {provider.failed} lỗi · TB{" "}
							{formatDuration(provider.averageDurationMs)}
						</p>
					</div>
				))}
				{overview.providers.length ? null : (
					<p className="text-xs font-semibold text-[var(--muted)]">
						Chưa có provider run trong 24 giờ.
					</p>
				)}
			</div>
		</Panel>
	);
}

function EventStream({ events }: { events: OperationsPipelineEventView[] }) {
	return (
		<Panel>
			<PanelHeader
				title="Nhật ký xử lý"
				description="Theo dõi bước xử lý gần nhất. Mở một sự kiện để xem chi tiết lượt quét."
				action={<Workflow size={17} className="text-[var(--accent-strong)]" />}
			/>
			<div className="grid gap-0 md:grid-cols-2 xl:grid-cols-3">
				{events.slice(0, 18).map((event) => (
					<IntentPrefetchLink
						key={event.id}
						href={event.scanHref}
						className="group flex gap-3 border-b border-[var(--divider)] p-4 transition hover:bg-[var(--surface-soft)] md:border-r"
					>
						<span
							className={`mt-1 size-2.5 shrink-0 rounded-full ${event.status === "failed" ? "bg-[var(--danger-strong)]" : event.status === "running" ? "bg-[var(--accent-strong)]" : "bg-[var(--success-strong)]"}`}
						/>
						<div className="min-w-0">
							<div className="flex items-center gap-2">
								<span className="rounded bg-[var(--neutral-soft)] px-1.5 py-0.5 text-xs font-bold uppercase text-[var(--muted-strong)]">
									{stageLabel(event.stage)}
								</span>
								<time className="text-xs font-semibold text-[var(--muted)]">
									{formatDate(event.occurredAt)}
								</time>
							</div>
							<p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-[var(--foreground)] group-hover:text-[var(--accent-strong)]">
								{event.message}
							</p>
						</div>
					</IntentPrefetchLink>
				))}
				{events.length ? null : (
					<div className="col-span-full px-4 py-8 text-center text-xs font-semibold text-[var(--muted)]">
						Sự kiện mới sẽ xuất hiện khi scan tiếp theo chạy.
					</div>
				)}
			</div>
		</Panel>
	);
}

function ErrorPanel({
	message,
	onRetry,
}: {
	message: string;
	onRetry: () => void;
}) {
	return (
		<Panel>
			<div className="p-8 text-center">
				<TriangleAlert className="mx-auto text-[var(--danger-strong)]" />
				<h2 className="mt-3 font-bold text-[var(--foreground)]">
					Không thể tải vận hành hệ thống
				</h2>
				<p className="mt-2 text-xs text-[var(--muted)]">{message}</p>
				<button
					type="button"
					onClick={onRetry}
					className={`${secondaryButtonClass} mt-4`}
				>
					<RefreshCw size={14} /> Thử lại
				</button>
			</div>
		</Panel>
	);
}

function operationsHealth(overview?: OperationsOverview) {
	if (!overview)
		return {
			description: "Đang tổng hợp tín hiệu vận hành.",
			title: "Đang kiểm tra hệ thống",
			tone: "neutral" as const,
		};
	const staleServices = overview.services.filter(
		(service) => service.health === "stale",
	).length;
	if (overview.throughput24h.failed > 0 || staleServices > 0)
		return {
			description: `${staleServices} dịch vụ mất tín hiệu và ${overview.throughput24h.failed} lượt quét lỗi trong 24 giờ cần kiểm tra.`,
			title: "Hệ thống cần chú ý",
			tone: "danger" as const,
		};
	if (
		overview.services.length === 0 ||
		overview.services.some(
			(service) =>
				service.health === "inactive" || service.health === "unknown",
		)
	)
		return {
			description:
				"Một dịch vụ chưa gửi tín hiệu hoạt động. Kiểm tra mục Kết nối & bảo trì.",
			title: "Thiếu tín hiệu dịch vụ",
			tone: "warning" as const,
		};
	if (
		overview.queue.retrying > 0 ||
		(overview.oldestQueuedAgeSeconds ?? 0) > 60 * 60
	)
		return {
			description: "Có lượt quét đang thử lại hoặc chờ lâu hơn dự kiến.",
			title: "Xử lý chậm hơn dự kiến",
			tone: "warning" as const,
		};
	return {
		description: "Hàng đợi, scheduler và worker đang trong ngưỡng bình thường.",
		title: "Hệ thống hoạt động ổn định",
		tone: "success" as const,
	};
}

async function runSchedulerJob(jobKey: "daily-scans") {
	const response = await fetch(`/api/workspace/cron/jobs/${jobKey}/run-now`, {
		credentials: "same-origin",
		method: "POST",
	});
	const payload = await response.json().catch(() => null);
	if (!response.ok) throw new Error(payload?.error ?? "Không thể chạy job.");
	return {
		message: `Đã xếp hàng ${payload.enqueued ?? 0} và xử lý ${payload.processed ?? 0} scan.`,
	};
}

function formatDate(value: string) {
	return new Intl.DateTimeFormat("vi-VN", {
		dateStyle: "short",
		timeStyle: "short",
		timeZone: "Asia/Ho_Chi_Minh",
	}).format(new Date(value));
}
function formatDuration(ms: number) {
	if (!Number.isFinite(ms) || ms <= 0) return "0 giây";
	if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))} giây`;
	if (ms < 3_600_000) return `${Math.round(ms / 60_000)} phút`;
	return `${Math.round(ms / 3_600_000)} giờ`;
}
function stageLabel(stage: string) {
	return stages.find((item) => item.key === stage)?.label ?? stage;
}

const primaryButtonClass =
	"inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent-fill)] px-3 text-xs font-bold text-white transition hover:bg-[var(--accent-fill-hover)] disabled:opacity-50";
const secondaryButtonClass =
	"inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)] disabled:opacity-50";
