"use client";

import {
	AlertTriangle,
	ArrowRight,
	CalendarClock,
	CheckCircle2,
	ChevronRight,
	Clock3,
	Database,
	Edit3,
	ExternalLink,
	FileBarChart,
	FileText,
	Layers3,
	MessageSquareText,
	Play,
	Plus,
	Radar,
	RefreshCw,
	ScrollText,
	ShieldCheck,
	Sparkles,
	Trash2,
	type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import {
	AlertPanel,
	EvidencePanel,
	RiskFlagPanel,
	SentimentAndStance,
	TopicDetailPanel,
	TopicPanel,
} from "@/components/dashboard/analysis-widgets";
import {
	DraftReview,
	SourceDetail,
} from "@/components/dashboard/counter-argument-widgets";
import { SocialLogoGrid } from "@/components/dashboard/social-logo-grid";
import {
	ExecutiveIntelligenceDashboard,
	IntelligenceActivityStream,
	IntelligenceClaimsWorkspace,
	IntelligenceEvidenceVault,
	IntelligenceReportsWorkbench,
	IntelligenceSourcesWorkspace,
	IntelligenceTopicsWorkspace,
} from "@/components/dashboard/intelligence-widgets";
import {
	AnalysisSummary,
	PageHeader,
	QueueCard,
} from "@/components/dashboard/page-widgets";
import type {
	AnalysisView,
	AuthViewState,
	ChatMessage,
	DashboardScan,
	DraftShape,
	EvidenceView,
	ReportSpec,
	ScanDetail,
	ManagedSchedulerJobView,
	TrackedSourceView,
	TopicCluster,
	WorkspaceMembersResponse,
} from "@/components/dashboard/types";
import {
	DashboardTooltip,
	Panel,
	PanelHeader,
	SecondaryButton,
} from "@/components/dashboard/ui-primitives";
import { WorkspaceMembersPage } from "@/components/dashboard/workspace-members-page";
import { managedSchedulerQueryOptions } from "@/lib/dashboard/client-queries";
import {
	classifyTrackedSourceAutomation,
	type TrackedSourceAutomationDecision,
} from "@/lib/domain/tracked-source-automation";

export type DashboardPageProps = {
	scans: DashboardScan[];
	selectedScan?: DashboardScan;
	selectedScanId: string;
	detail: ScanDetail | null;
	analysis: AnalysisView;
	topics: TopicCluster[];
	evidence: EvidenceView;
	draft: DraftShape | null;
	chatMessages: ChatMessage[];
	isChatting: boolean;
	isCreating: boolean;
	initialWorkspaceMembers?: WorkspaceMembersResponse;
	trackedSources: TrackedSourceView[];
	auth: AuthViewState;
	onSelectScan: (id: string) => void;
	onOpenScan: () => void;
	onOpenDraft: () => void;
	onOpenChatComposer: (preset?: string) => void;
	onPrepareReport: (report: ReportSpec) => void;
	onCreateReport: () => void;
	onEditReport: (report: ReportSpec) => void;
	onDeleteReport: (report: ReportSpec) => void;
	onCreateEvidence: () => void;
	onEditEvidence: (evidence: EvidenceView[number]) => void;
	onDeleteEvidence: (evidence: EvidenceView[number]) => Promise<void>;
	onEditScan: (scan: DashboardScan) => void;
	onDeleteScan: (scan: DashboardScan) => Promise<void>;
	onRunScan: (scan: DashboardScan) => Promise<void>;
	onCreateTrackedSource: (input: {
		displayName: string;
		url: string;
	}) => Promise<boolean>;
	onUpdateTrackedSource: (
		source: TrackedSourceView,
		input: { displayName?: string; isActive?: boolean },
	) => Promise<boolean>;
	onDeleteTrackedSource: (source: TrackedSourceView) => Promise<boolean>;
	onScanTrackedSource: (source: TrackedSourceView) => Promise<void>;
	onRunSchedulerJob: (
		jobKey: "enqueue-tracked-sources" | "process-queue",
	) => Promise<void>;
	onReview: (status: "needs_review" | "approved" | "rejected") => Promise<void>;
	reports: ReportSpec[];
};

export function OverviewPage(props: DashboardPageProps) {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={ShieldCheck}
				title="Tổng quan tình báo điều hành"
				description="Tư thế rủi ro, động lượng chủ đề, độ mạnh bằng chứng, sức khỏe nguồn và độ sẵn sàng báo cáo."
				actions={
					<>
						<SecondaryButton onClick={props.onOpenScan}>
							<Plus size={14} /> Tạo scan
						</SecondaryButton>
						<SecondaryButton onClick={props.onOpenDraft}>
							<Sparkles size={14} /> Tạo phản hồi
						</SecondaryButton>
					</>
				}
			/>
			<ExecutiveIntelligenceDashboard
				onCreateReport={props.onCreateReport}
				onOpenScan={props.onOpenScan}
			/>
			<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)]">
				<QueueCard
					enableInfinite
					scans={props.scans}
					selectedScanId={props.selectedScanId}
					onSelectScan={props.onSelectScan}
					onEditScan={props.onEditScan}
					onDeleteScan={props.onDeleteScan}
					onRunScan={props.onRunScan}
					limit={4}
				/>
			</div>
		</div>
	);
}

export function SourcesPage(props: DashboardPageProps) {
	const [activeTab, setActiveTab] = useState<SourceTabKey>("automation");
	const activeSourceCount = props.trackedSources.filter(
		(source) => source.isActive,
	).length;
	const queueCount = props.scans.filter((scan) =>
		["queued", "retrying"].includes(scan.status),
	).length;

	return (
		<div className="space-y-5">
			<PageHeader
				icon={Radar}
				title="Nguồn & Quét"
				description="Theo dõi nguồn, lịch tự động, hàng đợi scan và trạng thái provider trong một nơi."
				actions={
					<SecondaryButton onClick={props.onOpenScan}>
						<Plus size={14} /> Tạo scan mới
					</SecondaryButton>
				}
			/>
			<SourceTabs
				activeTab={activeTab}
				onTabChange={setActiveTab}
				queueCount={queueCount}
				sourceCount={activeSourceCount}
			/>
			<div className="space-y-5">
				{activeTab === "automation" ? (
					<>
						<SourceAutomationPanel
							onRunSchedulerJob={props.onRunSchedulerJob}
							scans={props.scans}
							sources={props.trackedSources}
						/>
						<IntelligenceSourcesWorkspace onOpenScan={props.onOpenScan} />
					</>
				) : null}
				{activeTab === "tracked" ? (
					<>
						<TrackedSourcesPanel
							isCreating={props.isCreating}
							onCreateTrackedSource={props.onCreateTrackedSource}
							onDeleteTrackedSource={props.onDeleteTrackedSource}
							onScanTrackedSource={props.onScanTrackedSource}
							onUpdateTrackedSource={props.onUpdateTrackedSource}
							sources={props.trackedSources}
						/>
						<SupportedSourcesPanel />
					</>
				) : null}
				{activeTab === "queue" ? (
					<QueueCard
						enableInfinite
						scans={props.scans}
						selectedScanId={props.selectedScanId}
						onSelectScan={props.onSelectScan}
						onEditScan={props.onEditScan}
						onDeleteScan={props.onDeleteScan}
						onRunScan={props.onRunScan}
					/>
				) : null}
			</div>
		</div>
	);
}

export function MembersPage({
	initialData,
}: {
	initialData?: WorkspaceMembersResponse;
}) {
	return <WorkspaceMembersPage initialData={initialData} />;
}

type SourceTabKey = "automation" | "queue" | "tracked";

function SourceTabs({
	activeTab,
	onTabChange,
	queueCount,
	sourceCount,
}: {
	activeTab: SourceTabKey;
	onTabChange: (tab: SourceTabKey) => void;
	queueCount: number;
	sourceCount: number;
}) {
	const tabs: Array<{
		help: string;
		icon: LucideIcon;
		key: SourceTabKey;
		label: string;
		value: string;
	}> = [
		{
			help: "Xem lịch Vercel Cron, nguồn đến hạn và chạy xếp hàng/xử lý thủ công.",
			icon: CalendarClock,
			key: "automation",
			label: "Tự động",
			value: "Vercel Cron",
		},
		{
			help: "Quản lý fanpage/URL được theo dõi và bật tắt tái quét hằng ngày.",
			icon: Radar,
			key: "tracked",
			label: "Nguồn theo dõi",
			value: `${sourceCount.toLocaleString("vi-VN")} bật`,
		},
		{
			help: "Xem toàn bộ scan, trạng thái xử lý và chạy lại các scan đang chờ/thử lại.",
			icon: ScrollText,
			key: "queue",
			label: "Hàng đợi scan",
			value: `${queueCount.toLocaleString("vi-VN")} đang chờ`,
		},
	];

	return (
		<div className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow-soft)] md:grid-cols-3">
			{tabs.map((tab) => {
				const Icon = tab.icon;
				const active = activeTab === tab.key;
				return (
					<DashboardTooltip key={tab.key} content={tab.help}>
						<button
							type="button"
							onClick={() => onTabChange(tab.key)}
							className={`flex min-h-16 min-w-0 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition ${
								active
									? "border-[var(--accent)] bg-[var(--accent-soft)]"
									: "border-transparent hover:border-[var(--border)] hover:bg-[var(--surface-soft)]"
							}`}
						>
							<span className="flex min-w-0 items-center gap-3">
								<span className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--surface-elevated)] text-[var(--accent-strong)]">
									<Icon size={17} />
								</span>
								<span className="min-w-0">
									<span className="block truncate text-[13px] font-bold text-[var(--foreground)]">
										{tab.label}
									</span>
									<span className="mt-0.5 block truncate text-[11px] font-semibold text-[var(--muted)]">
										{tab.value}
									</span>
								</span>
							</span>
							<ChevronRight
								size={15}
								className={`shrink-0 text-[var(--muted)] transition ${
									active ? "rotate-90" : ""
								}`}
							/>
						</button>
					</DashboardTooltip>
				);
			})}
		</div>
	);
}

function SourceAutomationPanel({
	onRunSchedulerJob,
	scans,
	sources,
}: {
	onRunSchedulerJob: (
		jobKey: "enqueue-tracked-sources" | "process-queue",
	) => Promise<void>;
	scans: DashboardScan[];
	sources: TrackedSourceView[];
}) {
	const schedulerQuery = useQuery(managedSchedulerQueryOptions());
	const [detailsOpen, setDetailsOpen] = useState(false);
	const [runningJob, setRunningJob] = useState<
		"enqueue-tracked-sources" | "process-queue" | null
	>(null);
	const sourceStates = useMemo(
		() => sources.map((source) => ({ source, state: sourceAutomationState(source) })),
		[sources],
	);
	const activeSources = sourceStates.filter((item) => item.source.isActive);
	const dueSources = sourceStates.filter((item) =>
		["due", "stale_active"].includes(item.state.kind),
	);
	const recoverySources = sourceStates.filter(
		(item) => item.state.kind === "stale_active",
	);
	const blockedSources = sourceStates.filter((item) =>
		["inactive", "in_progress", "recent"].includes(item.state.kind),
	);
	const queuedScans = scans.filter((scan) =>
		["queued", "retrying"].includes(scan.status),
	);
	const runningScans = scans.filter((scan) => scan.status === "running");
	const status = schedulerQuery.data;
	const enqueueJob = status?.jobs.find(
		(job) => job.jobKey === "enqueue-tracked-sources",
	);
	const processJob = status?.jobs.find((job) => job.jobKey === "process-queue");
	const schedulerBlocked = Boolean(status?.setupDisabledReason);

	async function runJob(jobKey: "enqueue-tracked-sources" | "process-queue") {
		setRunningJob(jobKey);
		try {
			await onRunSchedulerJob(jobKey);
			await schedulerQuery.refetch();
		} finally {
			setRunningJob(null);
		}
	}

	return (
		<Panel>
			<PanelHeader
				title="Tự động tái quét"
				description="Vercel Cron xếp hàng nguồn theo dõi hằng ngày và xử lý hàng đợi mỗi 30 phút."
				action={
					<button
						type="button"
						onClick={() => setDetailsOpen(true)}
						className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]"
					>
						<CalendarClock size={14} /> Chi tiết lịch
					</button>
				}
			/>
			<div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
				<div className="grid gap-3 sm:grid-cols-2">
					<AutomationMetric
						help="Nguồn đang bật sẽ được xét tái xếp hàng trong job hằng ngày."
						label="Nguồn đang bật"
						value={activeSources.length.toLocaleString("vi-VN")}
					/>
					<AutomationMetric
						help="Đến hạn gồm nguồn sẵn sàng quét và nguồn có scan cũ bị kẹt quá lâu cần được xếp hàng lại."
						label="Đến hạn xếp hàng"
						tone={dueSources.length ? "warning" : "success"}
						value={dueSources.length.toLocaleString("vi-VN")}
					/>
					<AutomationMetric
						help="Nguồn cần khôi phục sẽ được job xếp hàng đánh dấu scan cũ là lỗi rồi tạo scan mới."
						label="Cần khôi phục"
						tone={recoverySources.length ? "warning" : "neutral"}
						value={recoverySources.length.toLocaleString("vi-VN")}
					/>
					<AutomationMetric
						help="Scan đang chờ, thử lại hoặc đang được worker xử lý."
						label="Hàng đợi / chạy"
						tone={runningScans.length ? "accent" : "neutral"}
						value={`${queuedScans.length.toLocaleString("vi-VN")} / ${runningScans.length.toLocaleString("vi-VN")}`}
					/>
				</div>
				<div className="grid gap-3">
					<CronJobRow job={enqueueJob} label="Xếp hàng nguồn theo dõi" />
					<CronJobRow job={processJob} label="Xử lý hàng đợi scan" />
					{schedulerBlocked ? (
						<div className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-[12px] font-semibold leading-5 text-[var(--warning-strong)]">
							{status?.setupDisabledReason}
						</div>
					) : null}
					<div className="grid gap-2 sm:grid-cols-2">
						<button
							type="button"
							disabled={runningJob !== null}
							onClick={() => void runJob("enqueue-tracked-sources")}
							className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-3 text-[12px] font-bold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
						>
							<RefreshCw
								size={14}
								className={runningJob === "enqueue-tracked-sources" ? "animate-spin" : ""}
							/>
							Xếp hàng ngay
						</button>
						<button
							type="button"
							disabled={runningJob !== null}
							onClick={() => void runJob("process-queue")}
							className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-60"
						>
							<Play
								size={14}
								className={runningJob === "process-queue" ? "animate-pulse" : ""}
							/>
							Xử lý ngay
						</button>
					</div>
				</div>
			</div>
			<div className="grid gap-3 border-t border-[var(--border)] p-4 lg:grid-cols-3">
				<AutomationAccordion
					title="Nguồn đến hạn"
					description={`${dueSources.length.toLocaleString("vi-VN")} nguồn sẽ được xếp hàng khi chạy job.`}
				>
					<SourceStateList items={dueSources} emptyText="Không có nguồn đến hạn." />
				</AutomationAccordion>
				<AutomationAccordion
					title="Nguồn đang được bỏ qua"
					description="Các nguồn tắt, mới quét hoặc đang có scan chưa xong."
				>
					<SourceStateList
						items={blockedSources}
						emptyText="Không có nguồn nào bị bỏ qua."
					/>
				</AutomationAccordion>
				<AutomationAccordion
					title="Quy tắc tự động"
					description="Cách CS35 quyết định nguồn nào được tái xếp hàng."
				>
					<ul className="space-y-2 text-[12px] font-semibold leading-5 text-[var(--muted-strong)]">
						<li>Nguồn phải đang bật theo dõi.</li>
						<li>Không tạo scan trùng nếu nguồn đã quét trong vòng 1 giờ.</li>
						<li>Không tạo scan mới khi nguồn còn scan đang chờ, chạy hoặc thử lại.</li>
						<li>Scan cũ bị kẹt quá 12 giờ sẽ được đánh dấu lỗi và xếp hàng lại.</li>
						<li>Job xử lý hàng đợi chạy mỗi 30 phút và lấy tối đa 3 scan mỗi lượt.</li>
					</ul>
				</AutomationAccordion>
			</div>
			{detailsOpen ? (
				<AutomationDetailsDialog
					onClose={() => setDetailsOpen(false)}
					enqueueJob={enqueueJob}
					processJob={processJob}
				/>
			) : null}
		</Panel>
	);
}

function SupportedSourcesPanel() {
	return (
		<Panel>
			<PanelHeader
				title="Nguồn được hỗ trợ"
				description="Chỉ nhận Facebook công khai và liên kết website tùy chỉnh trong giai đoạn này."
			/>
			<div className="p-4">
				<SocialLogoGrid />
			</div>
		</Panel>
	);
}

function TrackedSourcesPanel({
	isCreating,
	onCreateTrackedSource,
	onDeleteTrackedSource,
	onScanTrackedSource,
	onUpdateTrackedSource,
	sources,
}: {
	isCreating: boolean;
	onCreateTrackedSource: (input: {
		displayName: string;
		url: string;
	}) => Promise<boolean>;
	onDeleteTrackedSource: (source: TrackedSourceView) => Promise<boolean>;
	onScanTrackedSource: (source: TrackedSourceView) => Promise<void>;
	onUpdateTrackedSource: (
		source: TrackedSourceView,
		input: { displayName?: string; isActive?: boolean },
	) => Promise<boolean>;
	sources: TrackedSourceView[];
}) {
	const [displayName, setDisplayName] = useState("");
	const [editingName, setEditingName] = useState("");
	const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const [sourceFilter, setSourceFilter] = useState<SourceFilterKey>("all");
	const [url, setUrl] = useState("");
	const sourceStates = useMemo(
		() => sources.map((source) => ({ source, state: sourceAutomationState(source) })),
		[sources],
	);
	const filteredSourceStates = sourceStates.filter((item) => {
		const normalizedQuery = query.trim().toLowerCase();
		const identity = facebookIdentity(item.source);
		const matchesQuery =
			!normalizedQuery ||
			item.source.displayName.toLowerCase().includes(normalizedQuery) ||
			item.source.normalizedUrl.toLowerCase().includes(normalizedQuery) ||
			identity.username?.toLowerCase().includes(normalizedQuery) ||
			identity.facebookId?.toLowerCase().includes(normalizedQuery);

		if (!matchesQuery) return false;
		if (sourceFilter === "active") return item.source.isActive;
		if (sourceFilter === "due")
			return ["due", "stale_active"].includes(item.state.kind);
		if (sourceFilter === "paused") return !item.source.isActive;
		return true;
	});
	const dueCount = sourceStates.filter((item) =>
		["due", "stale_active"].includes(item.state.kind),
	).length;
	const activeCount = sourceStates.filter((item) => item.source.isActive).length;

	async function createSource() {
		if (!url.trim()) return;
		const created = await onCreateTrackedSource({ displayName, url });
		if (created) {
			setDisplayName("");
			setUrl("");
		}
	}

	async function saveSourceName(source: TrackedSourceView) {
		if (!editingName.trim()) return;
		const saved = await onUpdateTrackedSource(source, {
			displayName: editingName.trim(),
		});
		if (saved) {
			setEditingSourceId(null);
			setEditingName("");
		}
	}

	return (
		<Panel>
			<PanelHeader
				title="Nguồn theo dõi"
				description="Fanpage/URL công khai được tái xếp hàng hằng ngày nếu đang bật và đến hạn."
			/>
			<div className="grid gap-3 border-b border-[var(--border)] p-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
				<input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Tìm theo tên trang, username, Facebook ID hoặc URL..."
					className="h-10 min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-[12px] font-semibold text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
				/>
				<div className="flex min-w-0 flex-wrap gap-2">
					<SourceFilterButton
						active={sourceFilter === "all"}
						label="Tất cả"
						onClick={() => setSourceFilter("all")}
						value={sources.length}
					/>
					<SourceFilterButton
						active={sourceFilter === "active"}
						label="Đang bật"
						onClick={() => setSourceFilter("active")}
						value={activeCount}
					/>
					<SourceFilterButton
						active={sourceFilter === "due"}
						label="Đến hạn"
						onClick={() => setSourceFilter("due")}
						value={dueCount}
					/>
					<SourceFilterButton
						active={sourceFilter === "paused"}
						label="Đã tắt"
						onClick={() => setSourceFilter("paused")}
						value={sources.length - activeCount}
					/>
				</div>
			</div>
			<div className="grid gap-2 border-b border-[var(--border)] p-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_auto]">
				<input
					value={url}
					onChange={(event) => setUrl(event.target.value)}
					placeholder="https://facebook.com/page"
					className="h-10 min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-[12px] font-semibold text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
				/>
				<input
					value={displayName}
					onChange={(event) => setDisplayName(event.target.value)}
					placeholder="Tên hiển thị"
					className="h-10 min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-[12px] font-semibold text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
				/>
				<SecondaryButton onClick={createSource}>
					<Plus size={14} /> Thêm
				</SecondaryButton>
			</div>
			<div className="divide-y divide-[var(--divider)]">
				{filteredSourceStates.length ? (
					filteredSourceStates.map(({ source, state }) => {
						const identity = facebookIdentity(source);
						return (
						<div
							key={source.id}
							className="grid gap-3 px-4 py-3 xl:grid-cols-[minmax(0,1fr)_minmax(160px,0.42fr)_300px] xl:items-center"
						>
							<div className="min-w-0">
								{editingSourceId === source.id ? (
									<div className="flex gap-2">
										<input
											value={editingName}
											onChange={(event) => setEditingName(event.target.value)}
											className="h-9 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-[12px] font-semibold text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
										/>
										<button
											type="button"
											onClick={() => void saveSourceName(source)}
											className="grid size-9 shrink-0 place-items-center rounded-md border border-[var(--border)] text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]"
											aria-label="Lưu nguồn"
										>
											<CheckCircle2 size={14} />
										</button>
									</div>
								) : (
									<div className="flex min-w-0 flex-wrap items-center gap-2">
										<p className="min-w-0 truncate text-[13px] font-bold text-[var(--foreground)]">
											{source.displayName}
										</p>
										<span
											className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-black ${
												source.isActive
													? "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success-strong)]"
													: "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning-strong)]"
											}`}
										>
											{source.isActive ? "Đang theo dõi" : "Đã tắt"}
										</span>
										<SourceStateBadge state={state} />
									</div>
								)}
								<a
									href={source.normalizedUrl}
									target="_blank"
									rel="noreferrer"
									className="mt-1 inline-flex max-w-full items-center gap-1 text-[11px] font-semibold text-[var(--muted)] transition hover:text-[var(--accent-strong)]"
								>
									<span className="truncate">{source.normalizedUrl}</span>
									<ExternalLink size={12} className="shrink-0" />
								</a>
								<div className="mt-1 flex min-w-0 flex-wrap gap-2 text-[11px] font-semibold text-[var(--muted)]">
									{identity.username ? <span>@{identity.username}</span> : null}
									{identity.facebookId ? (
										<span>Facebook ID {identity.facebookId}</span>
									) : (
										<span>Facebook ID: chưa có</span>
									)}
								</div>
							</div>
							<div className="min-w-0 text-[11px] font-semibold text-[var(--muted)] xl:text-right">
								<p className="truncate">{providerLabel(source.provider)}</p>
								<p className="mt-1 truncate">
									{source.lastScanStatus
										? `Lần cuối: ${scanStatusLabel(source.lastScanStatus)}`
										: "Chưa quét"}
								</p>
								<p className="mt-1 truncate">
									{source.lastScannedAt
										? formatDate(source.lastScannedAt)
										: "Chưa có thời điểm quét"}
								</p>
							</div>
							<div className="flex flex-wrap justify-start gap-2 xl:justify-end">
								<button
									type="button"
									disabled={isCreating || !source.isActive}
									onClick={() => onScanTrackedSource(source)}
									className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition whitespace-nowrap hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-60"
								>
									<Play size={14} /> Quét
								</button>
								<button
									type="button"
									onClick={() =>
										void onUpdateTrackedSource(source, {
											isActive: !source.isActive,
										})
									}
									className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition whitespace-nowrap hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
									aria-label={source.isActive ? "Tắt nguồn" : "Bật nguồn"}
									title={
										source.isActive
											? "Tắt tự động quét hằng ngày"
											: "Bật tự động quét hằng ngày"
									}
								>
									<ShieldCheck size={14} />
									{source.isActive ? "Tắt" : "Bật"}
								</button>
								<button
									type="button"
									onClick={() => {
										setEditingSourceId(source.id);
										setEditingName(source.displayName);
									}}
									className="grid size-9 place-items-center rounded-md border border-[var(--border)] text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]"
									aria-label="Chỉnh nguồn"
								>
									<Edit3 size={14} />
								</button>
								<button
									type="button"
									onClick={() => void onDeleteTrackedSource(source)}
									className="grid size-9 place-items-center rounded-md border border-[var(--danger-border)] text-[var(--danger-strong)] transition hover:bg-[var(--danger-soft)]"
									aria-label="Xóa nguồn"
								>
									<Trash2 size={14} />
								</button>
							</div>
						</div>
					);
				})
				) : (
					<p className="px-4 py-5 text-[12px] font-semibold text-[var(--muted)]">
						{sources.length
							? "Không có nguồn phù hợp bộ lọc hiện tại."
							: "Chưa tải được danh sách nguồn theo dõi."}
					</p>
				)}
			</div>
		</Panel>
	);
}

type SourceFilterKey = "active" | "all" | "due" | "paused";

type SourceAutomationState = TrackedSourceAutomationDecision;

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
				<p className={`text-[24px] font-bold ${metricToneClass(tone)}`}>
					{value}
				</p>
				<p className="mt-1 text-[12px] font-semibold text-[var(--muted)]">
					{label}
				</p>
			</div>
		</DashboardTooltip>
	);
}

function CronJobRow({
	job,
	label,
}: {
	job?: ManagedSchedulerJobView;
	label: string;
}) {
	const status = job?.lastStatus ?? "unknown";
	const failed = status === "failed";
	return (
		<div className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
			<div className="min-w-0">
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					<p className="min-w-0 truncate text-[13px] font-bold text-[var(--foreground)]">
						{label}
					</p>
					<span
						className={`inline-flex h-6 items-center rounded-md px-2 text-[10px] font-black ${
							failed
								? "bg-[var(--danger-soft)] text-[var(--danger-strong)]"
								: "bg-[var(--success-soft)] text-[var(--success-strong)]"
						}`}
					>
						{cronStatusLabel(status)}
					</span>
				</div>
				<p className="mt-1 truncate text-[11px] font-semibold text-[var(--muted)]">
					{job?.scheduleDescription ?? "Chưa tải lịch"} · lần cuối{" "}
					{formatDate(job?.lastRunAt ?? null)}
				</p>
			</div>
			<div className="text-[11px] font-semibold text-[var(--muted)] sm:text-right">
				<p>Lần tới</p>
				<p className="mt-1 text-[var(--muted-strong)]">
					{formatDate(job?.nextRunAt ?? null)}
				</p>
			</div>
		</div>
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
			<div className="border-t border-[var(--divider)] px-3 py-3">
				{children}
			</div>
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
		return (
			<p className="text-[12px] font-semibold text-[var(--muted)]">
				{emptyText}
			</p>
		);
	}

	return (
		<div className="space-y-2">
			{items.slice(0, 6).map(({ source, state }) => {
				const identity = facebookIdentity(source);
				return (
					<div
						key={source.id}
						className="rounded-md bg-[var(--surface-soft)] px-3 py-2"
					>
						<div className="flex min-w-0 items-center justify-between gap-2">
							<p className="min-w-0 truncate text-[12px] font-bold text-[var(--foreground)]">
								{source.displayName}
							</p>
							<SourceStateBadge state={state} />
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

function SourceFilterButton({
	active,
	label,
	onClick,
	value,
}: {
	active: boolean;
	label: string;
	onClick: () => void;
	value: number;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-[12px] font-bold transition ${
				active
					? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
					: "border-[var(--border)] bg-[var(--surface)] text-[var(--muted-strong)] hover:bg-[var(--surface-soft)]"
			}`}
		>
			{label}
			<span className="rounded bg-[var(--surface-elevated)] px-1.5 py-0.5 text-[10px]">
				{value.toLocaleString("vi-VN")}
			</span>
		</button>
	);
}

function SourceStateBadge({ state }: { state: SourceAutomationState }) {
	const styles = {
		accent: "border-[var(--border-strong)] bg-[var(--accent-soft)] text-[var(--accent-strong)]",
		neutral: "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted-strong)]",
		success: "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success-strong)]",
		warning: "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning-strong)]",
	};

	return (
		<DashboardTooltip content={state.help}>
			<span
				className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-black ${styles[state.tone]}`}
			>
				{state.label}
			</span>
		</DashboardTooltip>
	);
}

function AutomationDetailsDialog({
	enqueueJob,
	onClose,
	processJob,
}: {
	enqueueJob?: ManagedSchedulerJobView;
	onClose: () => void;
	processJob?: ManagedSchedulerJobView;
}) {
	return (
		<div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="automation-details-title"
				className="w-full max-w-2xl overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_80px_rgb(0_0_0/0.45)]"
			>
				<div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
					<div className="min-w-0">
						<h2
							id="automation-details-title"
							className="text-[15px] font-bold text-[var(--foreground)]"
						>
							Lịch tự động của nguồn theo dõi
						</h2>
						<p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
							Lịch được quản lý trong vercel.json và chạy bằng Vercel Cron.
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="grid size-9 shrink-0 place-items-center rounded-md border border-[var(--border)] text-[var(--muted-strong)] hover:bg-[var(--surface-soft)]"
						aria-label="Đóng"
					>
						×
					</button>
				</div>
				<div className="grid gap-3 p-4">
					<CronJobRow job={enqueueJob} label="Xếp hàng nguồn theo dõi" />
					<CronJobRow job={processJob} label="Xử lý hàng đợi scan" />
					<div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
						<h3 className="text-[13px] font-bold text-[var(--foreground)]">
							Vì sao có thể chưa thấy scan mới?
						</h3>
						<ul className="mt-2 space-y-2 text-[12px] font-semibold leading-5 text-[var(--muted-strong)]">
							<li>Job xếp hàng chỉ chạy tự động một lần mỗi ngày lúc 00:00 UTC.</li>
							<li>Nguồn mới quét trong vòng 1 giờ sẽ được bỏ qua để chống trùng.</li>
							<li>Nếu scan cũ vẫn đang chờ, chạy hoặc thử lại, nguồn sẽ không tạo scan mới.</li>
							<li>Scan cũ bị kẹt quá 12 giờ sẽ được tự khôi phục ở lần xếp hàng kế tiếp.</li>
							<li>
								Nút “Xếp hàng ngay” kiểm tra cùng quy tắc nhưng chạy tức thì cho
								người vận hành.
							</li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	);
}

function sourceAutomationState(source: TrackedSourceView): SourceAutomationState {
	return classifyTrackedSourceAutomation({
		isActive: source.isActive,
		lastScannedAt: source.lastScannedAt,
		lastScanStatus: source.lastScanStatus,
	});
}

function facebookIdentity(source: TrackedSourceView) {
	const metadata = source.metadata ?? {};
	const metadataId =
		typeof metadata.facebookId === "string" ? metadata.facebookId : null;
	const metadataLabel =
		typeof metadata.label === "string" ? metadata.label : null;
	return {
		facebookId: metadataId,
		username:
			cleanFacebookHandle(metadataLabel) ??
			usernameFromFacebookUrl(source.normalizedUrl),
	};
}

function usernameFromFacebookUrl(value?: string | null): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		if (!/(^|\.)facebook\.com$/iu.test(url.hostname)) return null;
		return cleanFacebookHandle(url.pathname.split("/").filter(Boolean)[0]);
	} catch {
		return null;
	}
}

function cleanFacebookHandle(value?: string | null): string | null {
	const cleaned = value?.trim().replace(/^@/u, "");
	if (!cleaned || /^\d+$/u.test(cleaned) || /facebook\.com/iu.test(cleaned)) {
		return null;
	}
	return cleaned.slice(0, 160);
}

function metricToneClass(tone: "accent" | "neutral" | "success" | "warning") {
	if (tone === "accent") return "text-[var(--accent-strong)]";
	if (tone === "success") return "text-[var(--success-strong)]";
	if (tone === "warning") return "text-[var(--warning-strong)]";
	return "text-[var(--foreground)]";
}

function cronStatusLabel(status: string) {
	if (status === "success") return "Thành công";
	if (status === "failed") return "Lỗi";
	if (status === "manual") return "Thủ công";
	if (status === "unknown") return "Chưa rõ";
	return status;
}

function formatDate(value?: Date | string | null) {
	if (!value) return "Chưa có";
	try {
		return new Intl.DateTimeFormat("vi-VN", {
			dateStyle: "short",
			timeStyle: "short",
		}).format(new Date(value));
	} catch {
		return String(value);
	}
}

function providerLabel(provider: string) {
	const labels: Record<string, string> = {
		apify_facebook_comments: "Apify bình luận",
		apify_facebook_groups: "Apify nhóm",
		apify_facebook_posts: "Apify bài viết",
		firecrawl: "Firecrawl",
		firecrawl_parse: "Firecrawl parse",
		local_text: "Văn bản nội bộ",
		browser_use: "Browser Use",
	};

	return labels[provider] ?? provider;
}

function scanStatusLabel(status: string) {
	const labels: Record<string, string> = {
		queued: "đang chờ",
		running: "đang quét",
		completed: "hoàn tất",
		failed: "lỗi",
		retrying: "thử lại",
	};

	return labels[status] ?? status;
}

export function AnalysisPage(props: DashboardPageProps) {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={Database}
				title="Phân tích thảo luận"
				description="Chủ đề, lập trường, cảm xúc, rủi ro và bằng chứng chuẩn hóa."
				actions={
					<Link
						href="/evidence"
						className="inline-flex h-10 max-w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition whitespace-nowrap hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
					>
						Kho bằng chứng <ArrowRight size={14} />
					</Link>
				}
			/>
			<div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
				<div className="space-y-5">
					<AnalysisSummary analysis={props.analysis} />
					<TopicPanel evidence={props.evidence} topics={props.topics} />
					<RiskFlagPanel
						analysis={props.analysis}
						evidence={props.evidence}
						scanId={props.selectedScanId}
					/>
				</div>
				<div className="grid gap-5 xl:grid-rows-[auto_minmax(0,1fr)]">
					<SentimentAndStance analysis={props.analysis} className="h-full" />
					<AlertPanel
						flags={props.analysis.riskFlags}
						evidence={props.evidence}
						scanId={props.selectedScanId}
						className="h-full"
					/>
				</div>
				<div className="xl:col-span-2">
					<EvidencePanel
						enableInfinite
						evidence={props.evidence}
						limit={5}
						scanId={props.selectedScanId}
					/>
				</div>
			</div>
		</div>
	);
}

export function TopicsPage(props: DashboardPageProps) {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={Layers3}
				title="Chủ đề"
				description="Xem các cụm nội dung như mục công việc: mức chú ý, xu hướng, bằng chứng mẫu và bước tiếp theo."
				actions={
					<>
						<Link
							href="/analysis"
							className="inline-flex h-10 max-w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition whitespace-nowrap hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
						>
							Mở phân tích <ArrowRight size={14} />
						</Link>
						<SecondaryButton onClick={props.onOpenDraft}>
							<Sparkles size={14} /> Tạo phản hồi
						</SecondaryButton>
					</>
				}
			/>
			<IntelligenceTopicsWorkspace />
		</div>
	);
}

export function TopicDetailsPage({
	topicSlug,
}: DashboardPageProps & { topicSlug?: string }) {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={Layers3}
				title="Chi tiết chủ đề"
				description="Các bài viết và bằng chứng đã được hệ thống gắn với chủ đề này."
				actions={
					<Link
						href="/topics"
						className="inline-flex h-10 max-w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition whitespace-nowrap hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
					>
						Danh sách chủ đề <ArrowRight size={14} />
					</Link>
				}
			/>
			<TopicDetailPanel slug={topicSlug} />
		</div>
	);
}

export function CounterArgumentsPage(props: DashboardPageProps) {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={MessageSquareText}
				title="Lập luận phản hồi"
				description="Soạn bản nháp có trích dẫn bằng chứng, chờ người vận hành duyệt."
				actions={
					<SecondaryButton onClick={props.onOpenDraft}>
						<Sparkles size={14} /> Tạo bản nháp
					</SecondaryButton>
				}
			/>
			<div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
				<SourceDetail
					selectedScan={props.selectedScan}
					detail={props.detail}
					analysis={props.analysis}
				/>
				<DraftReview
					draft={props.draft}
					onReview={props.onReview}
					scanId={props.selectedScanId}
				/>
				<div className="xl:col-span-2">
					<EvidencePanel
						enableInfinite
						evidence={props.evidence}
						limit={8}
						scanId={props.selectedScanId}
					/>
				</div>
			</div>
		</div>
	);
}

export function EvidencePage({
	onCreateEvidence,
}: Pick<DashboardPageProps, "onCreateEvidence">) {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={Database}
				title="Kho bằng chứng"
				description="Các trích dẫn đã chuẩn hóa dùng cho phân tích và phản hồi nội bộ."
				actions={
					<SecondaryButton onClick={onCreateEvidence}>
						<Plus size={14} /> Thêm bằng chứng
					</SecondaryButton>
				}
			/>
			<IntelligenceEvidenceVault />
		</div>
	);
}

export function AlertsPage() {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={AlertTriangle}
				title="Cảnh báo & Rủi ro"
				description="Đồ thị claim, bằng chứng hỗ trợ và luồng xử lý rủi ro."
			/>
			<IntelligenceClaimsWorkspace />
		</div>
	);
}

export function ReportsPage(props: DashboardPageProps) {
	return (
		<div className="flex min-h-[calc(100vh-7rem)] flex-col gap-5">
			<PageHeader
				icon={FileBarChart}
				title="Báo cáo"
				description="Các chế độ xuất báo cáo phục vụ trao đổi nội bộ và điều phối."
				actions={
					<SecondaryButton onClick={props.onCreateReport}>
						<Plus size={14} /> Tạo preset
					</SecondaryButton>
				}
			/>
			<IntelligenceReportsWorkbench onCreateReport={props.onCreateReport} />
			<div className="grid items-stretch gap-4 md:grid-cols-3">
				{props.reports.map((report) => (
					<Panel key={report.kind} className="h-full">
						<div className="flex h-full flex-col p-4">
							<FileText className="text-[var(--accent)]" size={22} />
							<h2 className="mt-3 text-[14px] font-bold text-[var(--foreground)]">
								{report.title}
							</h2>
							<p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">
								{report.description}
							</p>
							<ul className="mt-3 flex-1 space-y-2 text-[11px] font-semibold text-[var(--muted-strong)]">
								{report.sections.map((section) => (
									<li key={section} className="flex gap-2">
										<span className="mt-1 size-1.5 shrink-0 rounded-sm bg-[var(--accent)]" />
										<span className="min-w-0">{section}</span>
									</li>
								))}
							</ul>
							<div className="mt-4 flex flex-wrap gap-2">
								<SecondaryButton onClick={() => props.onPrepareReport(report)}>
									<FileBarChart size={14} /> Chuẩn bị báo cáo
								</SecondaryButton>
								<button
									type="button"
									onClick={() => props.onEditReport(report)}
									className="grid size-10 place-items-center rounded-md border border-[var(--border)] text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]"
									aria-label="Chỉnh preset báo cáo"
								>
									<Edit3 size={14} />
								</button>
								<button
									type="button"
									onClick={() => props.onDeleteReport(report)}
									className="grid size-10 place-items-center rounded-md border border-[var(--danger-border)] text-[var(--danger-strong)] transition hover:bg-[var(--danger-soft)]"
									aria-label="Xóa preset báo cáo"
								>
									<Trash2 size={14} />
								</button>
							</div>
						</div>
					</Panel>
				))}
			</div>
			<div className="grid min-w-0 flex-1 items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
				<AnalysisSummary analysis={props.analysis} className="h-full" />
				<Panel className="h-full">
					<PanelHeader
						title="Dữ liệu xuất"
						description="Nội dung báo cáo lấy từ scan đang chọn, bằng chứng và bản nháp đã duyệt."
					/>
					<div className="grid min-w-0 content-start gap-3 p-4">
						<ReportReadiness
							label="Scan đang chọn"
							value={props.selectedScan?.title ?? "Chưa chọn"}
						/>
						<ReportReadiness label="Bằng chứng" value={`${props.evidence.length} mục`} />
						<ReportReadiness
							label="Bản nháp"
							value={reportDraftStatus(props.draft?.status)}
						/>
						<ReportReadiness label="Rủi ro" value={reportRiskLabel(props.analysis.riskLevel)} />
					</div>
				</Panel>
			</div>
		</div>
	);
}

function ReportReadiness({ label, value }: { label: string; value: string }) {
	return (
		<div className="grid min-h-12 min-w-0 gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 sm:grid-cols-[minmax(86px,0.8fr)_minmax(0,1.2fr)] sm:items-center sm:gap-3">
			<span className="min-w-0 truncate text-[12px] font-semibold text-[var(--muted)]">
				{label}
			</span>
			<span className="min-w-0 break-words text-left text-[12px] font-bold leading-5 text-[var(--foreground)] sm:text-right">
				{value}
			</span>
		</div>
	);
}

function reportDraftStatus(status?: string) {
	if (status === "approved") return "Đã duyệt";
	if (status === "rejected") return "Từ chối";
	return "Cần duyệt";
}

function reportRiskLabel(risk?: string) {
	if (risk === "high") return "Cao";
	if (risk === "low") return "Thấp";
	return "Trung bình";
}

export function SettingsPage() {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={ShieldCheck}
				title="Cấu hình"
				description="Mở menu tài khoản để xem cấu hình máy chủ trong hộp thoại."
			/>
		</div>
	);
}

export function AuditPage(props: DashboardPageProps) {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={Clock3}
				title="Nhật ký hoạt động"
				description="Theo dõi thao tác scan, provider, phân tích và trạng thái duyệt."
			/>
			<IntelligenceActivityStream />
			<Panel>
				<div className="border-b border-[var(--border)] px-4 py-3">
					<h2 className="text-[15px] font-bold text-[var(--foreground)]">
						Dòng thời gian
					</h2>
				</div>
				<div className="divide-y divide-[var(--divider)] p-4">
					{(props.detail?.audit ?? []).length ? (
						(props.detail?.audit ?? []).map((event) => (
							<div
								key={event.id ?? `${event.action}-${event.createdAt}`}
								className="grid gap-2 py-3 sm:grid-cols-[180px_minmax(0,1fr)]"
							>
								<span className="text-[12px] font-semibold text-[var(--muted)]">
									{formatTime(event.createdAt)}
								</span>
								<div className="min-w-0">
									<p className="text-[13px] font-bold text-[var(--foreground)]">
										{event.action ?? "hoạt động"}
									</p>
									<p className="mt-1 text-[12px] text-[var(--muted)]">
										Bản ghi phục vụ kiểm toán nội bộ và truy vết xử lý.
									</p>
								</div>
							</div>
						))
					) : (
						<p className="py-3 text-[12px] font-semibold text-[var(--muted)]">
							Chưa có sự kiện kiểm toán cho scan đang chọn.
						</p>
					)}
				</div>
			</Panel>
		</div>
	);
}

export function GuidePage({ kind }: { kind: "process" | "user" | "policies" }) {
	const content = guideContent[kind];

	return (
		<div className="space-y-5">
			<PageHeader
				icon={content.icon}
				title={content.title}
				description={content.description}
				actions={
					<Link
						href={content.primaryHref}
						className="inline-flex h-10 max-w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition whitespace-nowrap hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
					>
						{content.primaryAction} <ArrowRight size={14} />
					</Link>
				}
			/>
			<div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
				<Panel>
					<PanelHeader title={content.panelTitle} description={content.panelDescription} />
					<div className="divide-y divide-[var(--divider)] p-4">
						{content.steps.map((step, index) => (
							<div
								key={step.title}
								className="grid gap-3 py-4 sm:grid-cols-[42px_minmax(0,1fr)]"
							>
								<span className="grid size-8 place-items-center rounded-md bg-[var(--accent-soft)] text-[12px] font-bold text-[var(--accent-strong)]">
									{index + 1}
								</span>
								<div className="min-w-0">
									<h2 className="text-[14px] font-bold text-[var(--foreground)]">
										{step.title}
									</h2>
									<p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
										{step.body}
									</p>
								</div>
							</div>
						))}
					</div>
				</Panel>
				<Panel>
					<PanelHeader title="Ghi nhớ vận hành" />
					<div className="space-y-3 p-4">
						{content.notes.map((note) => (
							<div
								key={note}
								className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3"
							>
								<CheckCircle2
									className="mt-0.5 shrink-0 text-[var(--brand)]"
									size={16}
								/>
								<p className="text-[12px] leading-5 text-[var(--muted-strong)]">
									{note}
								</p>
							</div>
						))}
					</div>
				</Panel>
			</div>
		</div>
	);
}

function formatTime(value?: string | Date) {
	if (!value) return "Không rõ thời gian";
	return new Intl.DateTimeFormat("vi-VN", {
		hour: "2-digit",
		minute: "2-digit",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(new Date(value));
}

const guideContent = {
	process: {
		icon: Radar,
		title: "Quy trình 5 bước",
		description: "Luồng chuẩn để tiếp nhận nguồn, phân tích bằng chứng và soạn phản hồi có kiểm duyệt.",
		panelTitle: "Chuỗi xử lý khuyến nghị",
		panelDescription: "Áp dụng cho Facebook công khai, website, tệp và văn bản nhập tay.",
		primaryAction: "Tạo scan mới",
		primaryHref: "/sources",
		steps: [
			{
				title: "Tiếp nhận nguồn",
				body: "Chọn nguồn Facebook hoặc website tùy chỉnh, tải tệp, hoặc dán văn bản trong hộp thoại tạo scan.",
			},
			{
				title: "Tự động chọn adapter",
				body: "Hệ thống chọn adapter dựa trên nguồn và chỉ sử dụng key được cấu hình bằng biến môi trường server-side.",
			},
			{
				title: "Chuẩn hóa bằng chứng",
				body: "Các trích dẫn, nguồn, tác giả công khai và tín hiệu tương tác được lưu để phục vụ phân tích có thể truy vết.",
			},
			{
				title: "Phân tích LLM có cấu trúc",
				body: "Topic, lập trường, cảm xúc và cờ rủi ro được ràng buộc theo schema để người vận hành rà soát nhất quán.",
			},
			{
				title: "Soạn phản hồi cần duyệt",
				body: "Bản nháp lập luận chỉ dùng bằng chứng đã lưu, không tự động đăng tải và phải được duyệt thủ công.",
			},
		],
		notes: [
			"Không nhập khóa bí mật vào Postgres, audit log, metadata nguồn hoặc provider run.",
			"Luôn kiểm tra bằng chứng trước khi phê duyệt bản nháp phản hồi.",
			"Khi dữ liệu live chưa đủ, tạo scan mới hoặc cấu hình provider còn thiếu thay vì suy diễn kết quả.",
		],
	},
	user: {
		icon: FileText,
		title: "Hướng dẫn sử dụng",
		description: "Các thao tác chính cho người vận hành dashboard CyberShield 35.",
		panelTitle: "Thao tác thường dùng",
		panelDescription: "Giữ các form trong hộp thoại và sử dụng từng trang cho một nhiệm vụ rõ ràng.",
		primaryAction: "Mở cấu hình",
		primaryHref: "/settings",
		steps: [
			{
				title: "Phiên đăng nhập",
				body: "Admin cấu hình auth bằng biến môi trường server-side, redeploy ứng dụng, rồi người vận hành mở lại dashboard.",
			},
			{
				title: "Kiểm tra cấu hình server",
				body: "Trong Cấu hình, kiểm tra Google AI, Apify, Firecrawl và Browser Use đã có key server-side trước khi tạo scan.",
			},
			{
				title: "Tạo scan",
				body: "Từ Nguồn & Quét, mở Tạo scan mới và nhập Facebook, website, tệp hoặc văn bản theo đúng mục.",
			},
			{
				title: "Đọc phân tích",
				body: "Dùng trang Phân tích để xem tóm tắt, cụm chủ đề, cảm xúc, cảnh báo và bằng chứng liên quan.",
			},
			{
				title: "Duyệt phản hồi",
				body: "Mở Lập luận phản hồi để tạo hoặc duyệt bản nháp. Chỉ xuất khi nội dung đã được người vận hành phê duyệt.",
			},
		],
		notes: [
			"Không nhập hoặc lưu khóa provider trong trình duyệt.",
			"Nhật ký hoạt động ghi lại các thao tác vận hành quan trọng để truy vết sau mỗi phiên.",
			"Nếu API riêng tư trả 401, hãy kiểm tra phiên đăng nhập và cấu hình server trước khi thao tác.",
		],
	},
	policies: {
		icon: ScrollText,
		title: "Chính sách & Quy định",
		description: "Ranh giới vận hành cho phân tích nguồn công khai và phản hồi nội bộ.",
		panelTitle: "Quy định bắt buộc",
		panelDescription: "Thiết kế cho kiểm duyệt nội bộ, không phải công cụ tự động đăng tải.",
		primaryAction: "Xem nhật ký",
		primaryHref: "/audit",
		steps: [
			{
				title: "Nguồn hợp lệ",
				body: "Chỉ dùng Facebook công khai, website tùy chỉnh, tệp được phép xử lý và văn bản do người vận hành cung cấp.",
			},
			{
				title: "Bảo mật khóa",
				body: "Provider và LLM key chỉ được cấu hình bằng biến môi trường server-side; không nhập khóa vào trình duyệt.",
			},
			{
				title: "Bằng chứng trước lập luận",
				body: "Mỗi phản hồi phải dựa trên evidence item đã lưu; không thêm tuyên bố chưa có trích dẫn hoặc nguồn hỗ trợ.",
			},
			{
				title: "Không nhắm mục tiêu nhạy cảm",
				body: "Không tạo nội dung phân phối theo nhân khẩu học, thuộc tính nhạy cảm hoặc hành vi thao túng người dùng.",
			},
			{
				title: "Duyệt thủ công",
				body: "Mọi bản nháp phản hồi giữ trạng thái cần duyệt cho đến khi người vận hành phê duyệt hoặc từ chối.",
			},
		],
		notes: [
			"Không thêm auto-posting, scheduler đăng bài hoặc tích hợp xuất bản trực tiếp.",
			"Audit trail phải ghi metadata chế độ chạy, không ghi raw key hoặc token.",
			"Chỉ xử lý nội dung theo quyền truy cập hợp lệ và quy định của tổ chức triển khai.",
		],
	},
} as const;
