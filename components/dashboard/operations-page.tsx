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
	Play,
	RefreshCw,
	RotateCcw,
	Trash2,
	TriangleAlert,
	Workflow,
	type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { IntentPrefetchLink } from "@/components/dashboard/intent-prefetch-link";
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
	{ description: "Ưu tiên và khóa an toàn", icon: Clock3, key: "queue", label: "Hàng đợi" },
	{ description: "Thu thập từ nguồn", icon: FileSearch, key: "provider", label: "Provider" },
	{ description: "Chuẩn hóa bản ghi", icon: Database, key: "evidence", label: "Bằng chứng" },
	{ description: "Rủi ro và lập trường", icon: Bot, key: "analysis", label: "Phân tích AI" },
	{ description: "Nhóm và liên kết", icon: Layers3, key: "topics", label: "Chủ đề" },
	{ description: "Sẵn sàng sử dụng", icon: CheckCircle2, key: "complete", label: "Hoàn tất" },
];

export function OperationsPage() {
	const queryClient = useQueryClient();
	const [notice, setNotice] = useState("");
	const overviewQuery = useQuery(operationsOverviewQueryOptions());
	const schedulerQuery = useQuery(managedSchedulerQueryOptions());
	const runMutation = useMutation({
		mutationFn: runSchedulerJob,
		onError: (error) => setNotice(error.message),
		onMutate: () => setNotice(""),
		onSuccess: async (result) => {
			setNotice(result.message);
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.operationsOverview() }),
				queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.managedScheduler() }),
			]);
		},
	});
	const cleanupMutation = useMutation({
		mutationFn: async () => {
			const response = await fetch("/api/operations/chat-cleanup", { method: "POST" });
			const payload = await response.json().catch(() => null);
			if (!response.ok) throw new Error(payload?.error ?? "Không thể dọn tệp Drive.");
			return payload as { attempted: number; completed: number };
		},
		onError: (error) => setNotice(error.message),
		onSuccess: async (result) => {
			setNotice(`Đã kiểm tra ${result.attempted} Chat và hoàn tất ${result.completed} tác vụ dọn Drive.`);
			await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.operationsOverview() });
		},
	});
	const overview = overviewQuery.data;
	const health = useMemo(() => operationsHealth(overview), [overview]);

	return (
		<div className="space-y-5">
			<PageHeader
				icon={MonitorCog}
				title="Vận hành hệ thống"
				description="Quan sát hàng đợi, worker, provider và từng bước xử lý trong thời gian gần thực."
					actions={
					<>
						<button type="button" disabled={cleanupMutation.isPending} onClick={() => cleanupMutation.mutate()} className={secondaryButtonClass}>
							<Trash2 size={14} /> Dọn Drive
						</button>
						<button type="button" onClick={() => void overviewQuery.refetch()} className={secondaryButtonClass}>
							<RefreshCw size={14} className={overviewQuery.isFetching ? "animate-spin" : ""} /> Làm mới
						</button>
						<button type="button" disabled={runMutation.isPending} onClick={() => runMutation.mutate("process-queue")} className={primaryButtonClass}>
							<Play size={14} /> Xử lý hàng đợi
						</button>
					</>
				}
			/>

			{overview ? (
				<>
					<HealthBanner health={health} overview={overview} />
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						<MetricCard icon={Clock3} label="Đang chờ / thử lại" value={`${overview.queue.queued} / ${overview.queue.retrying}`} help={overview.oldestQueuedAgeSeconds === null ? "Hàng đợi đang trống" : `Mục cũ nhất đã chờ ${formatDuration(overview.oldestQueuedAgeSeconds * 1000)}`} tone={overview.queue.retrying ? "warning" : "neutral"} />
						<MetricCard icon={Activity} label="Đang xử lý" value={overview.queue.running.toLocaleString("vi-VN")} help="Scan đã được worker khóa và đang chạy" tone={overview.queue.running ? "accent" : "neutral"} />
						<MetricCard icon={Gauge} label="Hoàn tất 24 giờ" value={overview.throughput24h.completed.toLocaleString("vi-VN")} help={`Thời gian trung bình ${formatDuration(overview.throughput24h.averageDurationMs)}`} tone="success" />
						<MetricCard icon={CheckCircle2} label="Tỷ lệ thành công" value={`${overview.throughput24h.successRate}%`} help={`${overview.throughput24h.failed} lỗi trong 24 giờ`} tone={overview.throughput24h.successRate < 90 ? "warning" : "success"} />
					</div>
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						<MetricCard icon={Bot} label="Model runs" value={overview.chat.runningRuns.toLocaleString("vi-VN")} help={`${overview.chat.failedRuns24h} lỗi trong 24 giờ · TB ${formatDuration(overview.chat.averageLatencyMs24h)}`} tone={overview.chat.failedRuns24h ? "warning" : "accent"} />
						<MetricCard icon={FileSearch} label="Tệp đang xử lý" value={overview.chat.attachmentsProcessing.toLocaleString("vi-VN")} help="Tệp đang được trích xuất và chia đoạn" tone={overview.chat.attachmentsProcessing ? "accent" : "neutral"} />
						<MetricCard icon={TriangleAlert} label="Tệp xử lý lỗi" value={overview.chat.attachmentsFailed.toLocaleString("vi-VN")} help="Có thể thử lại trong ngữ cảnh Chat" tone={overview.chat.attachmentsFailed ? "warning" : "success"} />
						<MetricCard icon={Trash2} label="Drive chờ dọn" value={overview.chat.attachmentsDeleting.toLocaleString("vi-VN")} help="Tệp được xóa trước khi dữ liệu Chat bị xóa cứng" tone={overview.chat.attachmentsDeleting ? "warning" : "success"} />
					</div>

					<Panel>
						<PanelHeader title="Pipeline xử lý" description="Mỗi scan đi qua sáu bước. Số bên dưới là sự kiện ghi nhận trong phiên quan sát gần nhất." action={<span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--success-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--success-strong)]"><CircleDot size={11} /> Tự làm mới 15 giây</span>} />
						<div className="grid gap-2 p-4 md:grid-cols-3 xl:grid-cols-6">
							{stages.map((stage, index) => <PipelineStage key={stage.key} stage={stage} count={overview.pipelineEvents.filter((event) => event.stage === stage.key).length} isLast={index === stages.length - 1} />)}
						</div>
					</Panel>

					<div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
						<RecentJobsPanel jobs={overview.recentJobs} />
						<div className="space-y-5">
							<ServicePanel overview={overview} schedulerReady={Boolean(schedulerQuery.data?.enabled)} />
							<ProviderPanel overview={overview} />
						</div>
					</div>

					<EventStream events={overview.pipelineEvents} />
				</>
			) : overviewQuery.isError ? (
				<ErrorPanel message={overviewQuery.error.message} onRetry={() => void overviewQuery.refetch()} />
			) : null}

			<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs font-semibold text-[var(--muted)]">
				<span>{overview ? `Ảnh chụp lúc ${formatDate(overview.generatedAt)}` : "Đang tải dữ liệu vận hành…"}</span>
				<div className="flex gap-2">
					<button type="button" disabled={runMutation.isPending} onClick={() => runMutation.mutate("enqueue-tracked-sources")} className={secondaryButtonClass}><RotateCcw size={14} /> Xếp nguồn đến hạn</button>
				</div>
			</div>
			<p aria-live="polite" className={`text-xs font-semibold ${runMutation.isError ? "text-[var(--danger-strong)]" : "text-[var(--success-strong)]"}`}>{notice}</p>
		</div>
	);
}

function HealthBanner({ health, overview }: { health: ReturnType<typeof operationsHealth>; overview: OperationsOverview }) {
	const Icon = health.tone === "danger" ? TriangleAlert : health.tone === "warning" ? Clock3 : CheckCircle2;
	return <section className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ${health.tone === "danger" ? "border-[var(--danger-strong)] bg-[var(--danger-soft)]" : health.tone === "warning" ? "border-[var(--warning-border)] bg-[var(--warning-soft)]" : "border-[var(--success-border)] bg-[var(--success-soft)]"}`}><div className="flex items-start gap-3"><Icon className={health.tone === "danger" ? "text-[var(--danger-strong)]" : health.tone === "warning" ? "text-[var(--warning-strong)]" : "text-[var(--success-strong)]"} /><div><h2 className="text-sm font-extrabold text-[var(--foreground)]">{health.title}</h2><p className="mt-1 text-xs font-semibold leading-5 text-[var(--muted-strong)]">{health.description}</p></div></div><div className="flex shrink-0 gap-4 text-center text-xs"><div><strong className="block text-base text-[var(--foreground)]">{overview.queue.failed}</strong>Lỗi tổng</div><div><strong className="block text-base text-[var(--foreground)]">{overview.services.filter((service) => service.health === "healthy").length}/{overview.services.length}</strong>Dịch vụ khỏe</div></div></section>;
}

function MetricCard({ help, icon: Icon, label, tone, value }: { help: string; icon: LucideIcon; label: string; tone: "accent" | "neutral" | "success" | "warning"; value: string }) {
	const colors = { accent: "bg-[var(--accent-soft)] text-[var(--accent-strong)]", neutral: "bg-[var(--neutral-soft)] text-[var(--muted-strong)]", success: "bg-[var(--success-soft)] text-[var(--success-strong)]", warning: "bg-[var(--warning-soft)] text-[var(--warning-strong)]" };
	return <article className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]"><div className="flex items-center justify-between gap-3"><span className={`grid size-9 place-items-center rounded-md ${colors[tone]}`}><Icon size={17} /></span><strong className="text-2xl font-extrabold text-[var(--foreground)]">{value}</strong></div><h2 className="mt-3 text-xs font-bold text-[var(--foreground)]">{label}</h2><p className="mt-1 text-[11px] font-semibold leading-4 text-[var(--muted)]">{help}</p></article>;
}

function PipelineStage({ count, isLast, stage }: { count: number; isLast: boolean; stage: (typeof stages)[number] }) {
	const Icon = stage.icon;
	return <div className="relative flex min-w-0 items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Icon size={16} /></span><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="truncate text-xs font-extrabold text-[var(--foreground)]">{stage.label}</h3><span className="rounded-full bg-[var(--surface)] px-1.5 text-[10px] font-bold text-[var(--muted)]">{count}</span></div><p className="mt-1 truncate text-[10px] font-semibold text-[var(--muted)]">{stage.description}</p></div>{isLast ? null : <ChevronRight size={14} className="absolute -right-2.5 z-10 hidden text-[var(--muted)] xl:block" />}</div>;
}

function RecentJobsPanel({ jobs }: { jobs: OperationsJobView[] }) {
	return <Panel><PanelHeader title="Scan gần đây" description="Trạng thái hàng đợi, bước xử lý cuối cùng, số lần thử và thời gian thực thi." /><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="border-b border-[var(--border)] bg-[var(--surface-soft)] text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-4 py-2.5">Scan</th><th className="px-3 py-2.5">Trạng thái</th><th className="px-3 py-2.5">Bước hiện tại</th><th className="px-3 py-2.5">Lần thử</th><th className="px-4 py-2.5 text-right">Thời gian</th></tr></thead><tbody className="divide-y divide-[var(--divider)]">{jobs.map((job) => <tr key={job.id} className="hover:bg-[var(--surface-soft)]"><td className="max-w-[300px] px-4 py-3"><IntentPrefetchLink href={`/scans/${job.id}`} className="block truncate text-xs font-bold text-[var(--foreground)] hover:text-[var(--accent-strong)]">{job.sourceLabel}</IntentPrefetchLink><p className="mt-1 truncate text-[10px] font-semibold text-[var(--muted)]">{intelligenceProviderLabel(job.provider)} · {formatDate(job.createdAt)}</p>{job.errorMessage ? <p className="mt-1 line-clamp-1 text-[10px] font-semibold text-[var(--danger-strong)]">{job.errorMessage}</p> : null}</td><td className="px-3 py-3"><StatusPill status={job.status} /></td><td className="px-3 py-3 text-xs font-semibold text-[var(--muted-strong)]">{job.latestEvent ? stageLabel(job.latestEvent.stage) : job.status === "queued" ? "Chờ worker" : "Chưa có telemetry"}</td><td className="px-3 py-3 text-xs font-bold text-[var(--foreground)]">{job.attempts}/{job.maxAttempts}</td><td className="px-4 py-3 text-right text-xs font-semibold text-[var(--muted)]">{job.durationMs === null ? "—" : formatDuration(job.durationMs)}</td></tr>)}{jobs.length ? null : <tr><td colSpan={5} className="px-4 py-8 text-center text-xs font-semibold text-[var(--muted)]">Chưa có scan.</td></tr>}</tbody></table></div></Panel>;
}

function ServicePanel({ overview, schedulerReady }: { overview: OperationsOverview; schedulerReady: boolean }) {
	return <Panel><PanelHeader title="Dịch vụ & heartbeat" description="Một dịch vụ chuyển sang cũ khi không phát tín hiệu trong cửa sổ dự kiến." action={<span className={`rounded-full px-2 py-1 text-[10px] font-bold ${schedulerReady ? "bg-[var(--success-soft)] text-[var(--success-strong)]" : "bg-[var(--warning-soft)] text-[var(--warning-strong)]"}`}>{schedulerReady ? "Cron sẵn sàng" : "Cron cần cấu hình"}</span>} /><div className="divide-y divide-[var(--divider)]">{overview.services.map((service) => <div key={service.serviceName} className="flex items-center justify-between gap-3 px-4 py-3"><div className="flex min-w-0 items-center gap-3"><span className={`size-2.5 shrink-0 rounded-full ${service.health === "healthy" ? "bg-[var(--success-strong)]" : "bg-[var(--danger-strong)]"}`} /><div className="min-w-0"><p className="truncate text-xs font-bold text-[var(--foreground)]">{service.label}</p><p className="mt-1 truncate text-[10px] font-semibold text-[var(--muted)]">{service.lastSeenAt ? formatDate(service.lastSeenAt) : "Chưa có heartbeat"}</p></div></div><span className="text-[10px] font-bold text-[var(--muted-strong)]">{service.ageSeconds === null ? "—" : `${formatDuration(service.ageSeconds * 1000)} trước`}</span></div>)}{overview.services.length ? null : <div className="px-4 py-6 text-xs font-semibold text-[var(--muted)]">Chưa ghi nhận heartbeat. Chạy một job để khởi tạo tín hiệu.</div>}</div></Panel>;
}

function ProviderPanel({ overview }: { overview: OperationsOverview }) {
	return <Panel><PanelHeader title="Độ tin cậy provider · 24 giờ" description="Tỷ lệ hoàn tất và độ trễ trung bình theo adapter thu thập." /><div className="space-y-4 p-4">{overview.providers.map((provider) => <div key={provider.provider}><div className="flex items-center justify-between gap-3 text-xs"><span className="truncate font-bold text-[var(--foreground)]">{intelligenceProviderLabel(provider.provider)}</span><span className="font-extrabold text-[var(--muted-strong)]">{provider.successRate}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--neutral-soft)]"><div className={`h-full rounded-full ${provider.successRate < 90 ? "bg-[var(--warning-strong)]" : "bg-[var(--success-strong)]"}`} style={{ width: `${provider.successRate}%` }} /></div><p className="mt-1.5 text-[10px] font-semibold text-[var(--muted)]">{provider.completed} hoàn tất · {provider.failed} lỗi · TB {formatDuration(provider.averageDurationMs)}</p></div>)}{overview.providers.length ? null : <p className="text-xs font-semibold text-[var(--muted)]">Chưa có provider run trong 24 giờ.</p>}</div></Panel>;
}

function EventStream({ events }: { events: OperationsPipelineEventView[] }) {
	return <Panel><PanelHeader title="Dòng sự kiện pipeline" description="Telemetry append-only giúp xác định scan đang dừng ở bước nào mà không đọc payload nhạy cảm." action={<Workflow size={17} className="text-[var(--accent-strong)]" />} /><div className="grid gap-0 md:grid-cols-2 xl:grid-cols-3">{events.slice(0, 18).map((event) => <IntentPrefetchLink key={event.id} href={event.scanHref} className="group flex gap-3 border-b border-[var(--divider)] p-4 transition hover:bg-[var(--surface-soft)] md:border-r"><span className={`mt-1 size-2.5 shrink-0 rounded-full ${event.status === "failed" ? "bg-[var(--danger-strong)]" : event.status === "running" ? "bg-[var(--accent-strong)]" : "bg-[var(--success-strong)]"}`} /><div className="min-w-0"><div className="flex items-center gap-2"><span className="rounded bg-[var(--neutral-soft)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--muted-strong)]">{stageLabel(event.stage)}</span><time className="text-[9px] font-semibold text-[var(--muted)]">{formatDate(event.occurredAt)}</time></div><p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-[var(--foreground)] group-hover:text-[var(--accent-strong)]">{event.message}</p></div></IntentPrefetchLink>)}{events.length ? null : <div className="col-span-full px-4 py-8 text-center text-xs font-semibold text-[var(--muted)]">Sự kiện mới sẽ xuất hiện khi scan tiếp theo chạy.</div>}</div></Panel>;
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) { return <Panel><div className="p-8 text-center"><TriangleAlert className="mx-auto text-[var(--danger-strong)]" /><h2 className="mt-3 font-bold text-[var(--foreground)]">Không thể tải vận hành hệ thống</h2><p className="mt-2 text-xs text-[var(--muted)]">{message}</p><button type="button" onClick={onRetry} className={`${secondaryButtonClass} mt-4`}><RefreshCw size={14} /> Thử lại</button></div></Panel>; }

function operationsHealth(overview?: OperationsOverview) {
	if (!overview) return { description: "Đang tổng hợp tín hiệu vận hành.", title: "Đang kiểm tra hệ thống", tone: "neutral" as const };
	const staleServices = overview.services.filter((service) => service.health === "stale").length;
	if (overview.throughput24h.failed > 0 || staleServices > 0) return { description: `${staleServices} dịch vụ cũ và ${overview.throughput24h.failed} scan lỗi trong 24 giờ cần kiểm tra.`, title: "Hệ thống cần chú ý", tone: "danger" as const };
	if (overview.services.length === 0) return { description: "Chưa nhận được heartbeat từ worker hoặc scheduler.", title: "Thiếu tín hiệu dịch vụ", tone: "warning" as const };
	if (overview.queue.retrying > 0 || (overview.oldestQueuedAgeSeconds ?? 0) > 60 * 60) return { description: "Có scan đang thử lại hoặc chờ lâu hơn dự kiến.", title: "Pipeline đang chậm", tone: "warning" as const };
	return { description: "Hàng đợi, scheduler và worker đang trong ngưỡng bình thường.", title: "Pipeline hoạt động ổn định", tone: "success" as const };
}

async function runSchedulerJob(jobKey: "enqueue-tracked-sources" | "process-queue") {
	const response = await fetch(`/api/workspace/cron/jobs/${jobKey}/run-now`, { credentials: "same-origin", method: "POST" });
	const payload = await response.json().catch(() => null);
	if (!response.ok) throw new Error(payload?.error ?? "Không thể chạy job.");
	return { message: jobKey === "process-queue" ? `Đã xử lý ${payload.processed ?? 0} scan.` : `Đã xếp hàng ${payload.enqueued ?? 0} scan.` };
}

function formatDate(value: string) { return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)); }
function formatDuration(ms: number) { if (!Number.isFinite(ms) || ms <= 0) return "0 giây"; if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))} giây`; if (ms < 3_600_000) return `${Math.round(ms / 60_000)} phút`; return `${Math.round(ms / 3_600_000)} giờ`; }
function stageLabel(stage: string) { return stages.find((item) => item.key === stage)?.label ?? stage; }

const primaryButtonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-3 text-xs font-bold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-50";
const secondaryButtonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)] disabled:opacity-50";
