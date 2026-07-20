"use client";

import {
	CalendarClock,
	CheckCircle2,
	ChevronRight,
	Edit3,
	ExternalLink,
	LoaderCircle,
	Play,
	Plus,
	Radar,
	RefreshCw,
	Search,
	ScrollText,
	ShieldAlert,
	ShieldCheck,
	Sparkles,
	Trash2,
	type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import type { DashboardPageProps } from "@/components/dashboard/dashboard-pages";
import { IntelligenceSourcesWorkspace } from "@/components/dashboard/intelligence-widgets";
import { PageHeader, QueueCard } from "@/components/dashboard/page-widgets";
import { SocialLogoGrid } from "@/components/dashboard/social-logo-grid";
import type {
	DashboardScan,
	FacebookPageClassification,
	IntelligenceFacebookPageOption,
	ManagedSchedulerJobView,
	TrackedSourceView,
} from "@/components/dashboard/types";
import {
	DashboardTooltip,
	Panel,
	PanelHeader,
	SecondaryButton,
} from "@/components/dashboard/ui-primitives";
import {
	intelligenceFacebookPagesQueryOptions,
	managedSchedulerQueryOptions,
} from "@/lib/dashboard/client-queries";
import {
	classifyTrackedSourceAutomation,
	type TrackedSourceAutomationDecision,
} from "@/lib/domain/tracked-source-automation";

export function SourcesPage(props: DashboardPageProps) {
	const [activeTab, setActiveTab] = useState<SourceTabKey>("pages");
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
				{activeTab === "pages" ? <FacebookPageTrustPanel /> : null}
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
type SourceTabKey = "automation" | "pages" | "queue" | "tracked";

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
			help: "Phân loại fanpage là Đáng tin cậy hoặc Có rủi ro và kiểm soát bản nháp tự động.",
			icon: ShieldCheck,
			key: "pages",
			label: "Phân loại fanpage",
			value: "Tin cậy & rủi ro",
		},
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
		<div className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow-soft)] sm:grid-cols-2 xl:grid-cols-4">
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

function FacebookPageTrustPanel() {
	const pagesQuery = useQuery(intelligenceFacebookPagesQueryOptions());
	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<FacebookPageClassification | "all">("all");
	const [savingKey, setSavingKey] = useState<string | null>(null);
	const [notice, setNotice] = useState("");
	const pages = pagesQuery.data ?? [];
	const filteredPages = pages.filter((page) => {
		if (filter !== "all" && page.classification !== filter) return false;
		const value = query.trim().toLowerCase();
		return (
			!value ||
			page.label.toLowerCase().includes(value) ||
			page.username?.toLowerCase().includes(value) ||
			page.facebookId?.toLowerCase().includes(value)
		);
	});
	const counts = pages.reduce(
		(result, page) => {
			result[page.classification] += 1;
			return result;
		},
		{ at_risk: 0, trusted: 0, uncategorized: 0 },
	);

	async function savePolicy(
		page: IntelligenceFacebookPageOption,
		patch: Partial<
			Pick<IntelligenceFacebookPageOption, "autoDraftEnabled" | "classification">
		>,
	) {
		setSavingKey(page.pageKey);
		setNotice("");
		try {
			const response = await fetch(
				"/api/intelligence/facebook-pages/classification",
				{
					body: JSON.stringify({
						autoDraftEnabled:
							patch.autoDraftEnabled ?? page.autoDraftEnabled,
						classification: patch.classification ?? page.classification,
						displayName: page.label,
						facebookPageId: page.facebookId,
						pageKey: page.pageKey,
						username: page.username,
					}),
					cache: "no-store",
					headers: { "Content-Type": "application/json" },
					method: "PATCH",
				},
			);
			const payload = await response.json().catch(() => null);
			if (!response.ok) {
				throw new Error(payload?.error ?? "Không thể lưu phân loại fanpage.");
			}
			setNotice(
				payload.enqueued
					? `Đã lưu và xếp hàng ${payload.enqueued} bản nháp cần duyệt.`
					: "Đã lưu quy tắc fanpage.",
			);
			await pagesQuery.refetch();
		} catch (error) {
			setNotice(
				error instanceof Error
					? error.message
					: "Không thể lưu phân loại fanpage.",
			);
		} finally {
			setSavingKey(null);
		}
	}

	return (
		<Panel>
			<PanelHeader
				title="Phân loại fanpage"
				description="Một quy tắc rõ ràng cho mỗi trang: hỗ trợ nội dung hữu ích từ nguồn đáng tin cậy, hoặc chuẩn bị phản biện có căn cứ cho nguồn có rủi ro. Mọi bản nháp đều chờ con người duyệt."
				action={
					<span className="inline-flex h-8 items-center gap-2 rounded-md bg-[var(--accent-soft)] px-3 text-[11px] font-bold text-[var(--accent-strong)]">
						<Sparkles size={14} /> {pages.reduce((sum, page) => sum + page.automation.pending, 0)} đang chờ
					</span>
				}
			/>
			<div className="grid gap-3 border-b border-[var(--border)] p-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
				<label className="relative min-w-0">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={15} />
					<input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Tìm tên trang, username hoặc Facebook ID…"
						className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] pl-9 pr-3 text-[12px] font-semibold outline-none focus:border-[var(--accent)]"
					/>
				</label>
				<div className="flex flex-wrap gap-2">
					<PagePolicyFilter active={filter === "all"} label="Tất cả" value={pages.length} onClick={() => setFilter("all")} />
					<PagePolicyFilter active={filter === "trusted"} label="Đáng tin" value={counts.trusted} onClick={() => setFilter("trusted")} />
					<PagePolicyFilter active={filter === "at_risk"} label="Có rủi ro" value={counts.at_risk} onClick={() => setFilter("at_risk")} />
					<PagePolicyFilter active={filter === "uncategorized"} label="Chưa phân loại" value={counts.uncategorized} onClick={() => setFilter("uncategorized")} />
				</div>
			</div>
			{notice ? (
				<p aria-live="polite" className="border-b border-[var(--border)] bg-[var(--surface-soft)] px-4 py-2 text-[12px] font-semibold text-[var(--muted-strong)]">
					{notice}
				</p>
			) : null}
			{pagesQuery.isPending ? (
				<div className="grid min-h-48 place-items-center"><LoaderCircle className="animate-spin text-[var(--accent)]" /></div>
			) : pagesQuery.isError ? (
				<div className="p-8 text-center"><p className="text-sm font-bold text-[var(--danger-strong)]">Không thể tải danh sách fanpage.</p><button type="button" onClick={() => void pagesQuery.refetch()} className="mt-3 text-xs font-bold text-[var(--accent-strong)]">Thử lại</button></div>
			) : filteredPages.length ? (
				<div className="divide-y divide-[var(--divider)]">
					{filteredPages.map((page) => (
						<FacebookPagePolicyRow
							key={page.pageKey}
							page={page}
							saving={savingKey === page.pageKey}
							onSave={(patch) => savePolicy(page, patch)}
						/>
					))}
				</div>
			) : (
				<div className="p-10 text-center text-sm font-semibold text-[var(--muted)]">Không có fanpage phù hợp với bộ lọc.</div>
			)}
		</Panel>
	);
}

function FacebookPagePolicyRow({
	onSave,
	page,
	saving,
}: {
	onSave: (
		patch: Partial<
			Pick<IntelligenceFacebookPageOption, "autoDraftEnabled" | "classification">
		>,
	) => Promise<void>;
	page: IntelligenceFacebookPageOption;
	saving: boolean;
}) {
	return (
		<div className="grid gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)] xl:items-center">
			<div className="min-w-0">
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					<p className="truncate text-[13px] font-extrabold text-[var(--foreground)]">{page.label}</p>
					<PageClassificationBadge classification={page.classification} />
				</div>
				<p className="mt-1 truncate text-[11px] font-semibold text-[var(--muted)]">
					{page.username ? `@${page.username}` : page.facebookId ? `Facebook ID ${page.facebookId}` : "Chưa có định danh Facebook"}
				</p>
				<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-[var(--muted)]">
					<span>{page.evidenceCount} bằng chứng</span>
					<span>{page.automation.pending} đang chờ</span>
					<span>{page.automation.completed} đã tạo</span>
					{page.automation.failed ? <span className="text-[var(--danger-strong)]">{page.automation.failed} lỗi</span> : null}
				</div>
			</div>
			<div className="space-y-2">
				<div className="grid grid-cols-3 gap-2" aria-label={`Phân loại ${page.label}`}>
					<PagePolicyButton active={page.classification === "trusted"} disabled={saving || page.pageKey.startsWith("tracked:")} icon={ShieldCheck} label="Đáng tin" tone="success" onClick={() => onSave({ autoDraftEnabled: true, classification: "trusted" })} />
					<PagePolicyButton active={page.classification === "at_risk"} disabled={saving || page.pageKey.startsWith("tracked:")} icon={ShieldAlert} label="Có rủi ro" tone="danger" onClick={() => onSave({ autoDraftEnabled: true, classification: "at_risk" })} />
					<PagePolicyButton active={page.classification === "uncategorized"} disabled={saving || page.pageKey.startsWith("tracked:")} icon={Radar} label="Chưa rõ" tone="neutral" onClick={() => onSave({ autoDraftEnabled: false, classification: "uncategorized" })} />
				</div>
				<label className="flex min-h-9 items-center justify-between gap-3 rounded-md border border-[var(--border)] px-3 text-[11px] font-bold text-[var(--muted-strong)]">
					<span>Tự động tạo bản nháp cần duyệt</span>
					<input type="checkbox" checked={page.autoDraftEnabled} disabled={saving || page.classification === "uncategorized"} onChange={(event) => void onSave({ autoDraftEnabled: event.target.checked })} />
				</label>
				{saving ? <p className="flex items-center justify-end gap-2 text-[10px] font-bold text-[var(--muted)]"><LoaderCircle className="animate-spin" size={12} /> Đang lưu và xếp hàng…</p> : null}
			</div>
		</div>
	);
}

function PageClassificationBadge({ classification }: { classification: FacebookPageClassification }) {
	const styles = classification === "trusted" ? "bg-[var(--success-soft)] text-[var(--success-strong)]" : classification === "at_risk" ? "bg-[var(--danger-soft)] text-[var(--danger-strong)]" : "bg-[var(--neutral-soft)] text-[var(--muted-strong)]";
	const label = classification === "trusted" ? "Đáng tin cậy" : classification === "at_risk" ? "Có rủi ro" : "Chưa phân loại";
	return <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${styles}`}>{label}</span>;
}

function PagePolicyButton({ active, disabled, icon: Icon, label, onClick, tone }: { active: boolean; disabled: boolean; icon: LucideIcon; label: string; onClick: () => void; tone: "danger" | "neutral" | "success" }) {
	const activeClass = tone === "success" ? "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success-strong)]" : tone === "danger" ? "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger-strong)]" : "border-[var(--border-strong)] bg-[var(--surface-soft)] text-[var(--foreground)]";
	return <button type="button" aria-pressed={active} disabled={disabled} onClick={onClick} className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border px-2 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-55 ${active ? activeClass : "border-[var(--border)] text-[var(--muted-strong)] hover:bg-[var(--surface-soft)]"}`}><Icon size={14} />{label}</button>;
}

function PagePolicyFilter({ active, label, onClick, value }: { active: boolean; label: string; onClick: () => void; value: number }) {
	return <button type="button" aria-pressed={active} onClick={onClick} className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-[11px] font-bold ${active ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "border-[var(--border)] text-[var(--muted-strong)]"}`}><span>{label}</span><span className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-[10px]">{value}</span></button>;
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
											className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${
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
				className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${styles[state.tone]}`}
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
