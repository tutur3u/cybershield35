"use client";

import {
	CalendarClock,
	ChevronRight,
	Radar,
	ScrollText,
	ShieldCheck,
	type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import type { DashboardPageProps } from "@/components/dashboard/dashboard-pages";
import { IntelligenceSourcesWorkspace } from "@/components/dashboard/intelligence-widgets";
import { PageHeader, QueueCard } from "@/components/dashboard/page-widgets";
import { SocialLogoGrid } from "@/components/dashboard/social-logo-grid";
import {
	DashboardTooltip,
	Panel,
	PanelHeader,
} from "@/components/dashboard/ui-primitives";

import { SourceAutomationPanel } from "./automation-panel";
import { FacebookPageTrustPanel } from "./facebook-page-panel";
import { TrackedSourcesPanel } from "./tracked-sources-panel";

type SourceTabKey = "automation" | "pages" | "queue" | "tracked";

export function SourcesPage(props: DashboardPageProps) {
	const [activeTab, setActiveTab] = useState<SourceTabKey>("tracked");
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
				description="Thêm nguồn, quét nội dung mới và theo dõi kết quả trong cùng một nơi."
			/>
			<SourceTabs
				activeTab={activeTab}
				onTabChange={setActiveTab}
				queueCount={queueCount}
				sourceCount={activeSourceCount}
			/>
			<div className="space-y-5">
				{activeTab === "tracked" ? (
					<>
						<TrackedSourcesPanel
							isCreating={props.isCreating}
							onCreateTrackedSource={props.onCreateTrackedSource}
							onDeleteTrackedSource={props.onDeleteTrackedSource}
							onUpdateTrackedSource={props.onUpdateTrackedSource}
							sources={props.trackedSources}
						/>
						<SupportedSourcesPanel />
					</>
				) : null}
				{activeTab === "pages" ? <FacebookPageTrustPanel /> : null}
				{activeTab === "automation" ? (
					<>
						<SourceAutomationPanel
							onRunSchedulerJob={props.onRunSchedulerJob}
							scans={props.scans}
							sources={props.trackedSources}
						/>
						<IntelligenceSourcesWorkspace onOpenScan={props.onOpenScan} standalone />
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
			help: "Thêm trang hoặc website cần theo dõi và quét ngay khi cần.",
			icon: Radar,
			key: "tracked",
			label: "Nguồn theo dõi",
			value: `${sourceCount.toLocaleString("vi-VN")} đang bật`,
		},
		{
			help: "Đánh dấu trang là Đáng tin, Trung lập hoặc Có rủi ro để định hướng bản nháp.",
			icon: ShieldCheck,
			key: "pages",
			label: "Phân loại trang",
			value: "Tin cậy & rủi ro",
		},
		{
			help: "Xem lịch quét hằng ngày, nguồn sắp đến hạn và chạy ngay khi cần.",
			icon: CalendarClock,
			key: "automation",
			label: "Tự động",
			value: "Hằng ngày",
		},
		{
			help: "Xem các lượt quét, tiến độ xử lý và chạy lại khi có lỗi.",
			icon: ScrollText,
			key: "queue",
			label: "Lượt quét",
			value: `${queueCount.toLocaleString("vi-VN")} đang chờ`,
		},
	];

	return (
		<div className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow-soft)] sm:grid-cols-2 xl:grid-cols-4">
			{tabs.map((tab) => {
				const Icon = tab.icon;
				const active = activeTab === tab.key;
				return (
					<DashboardTooltip key={tab.key} content={tab.help}>
						<button
							type="button"
							aria-pressed={active}
							onClick={() => onTabChange(tab.key)}
							className={`flex min-h-16 min-w-0 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition ${
								active
									? "border-[var(--accent)] bg-[var(--accent-soft)]"
									: "border-transparent hover:border-[var(--border)] hover:bg-[var(--surface-soft)]"
							}`}
						>
							<span className="flex min-w-0 items-center gap-3">
								<span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-elevated)] text-[var(--accent-strong)]">
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

function SupportedSourcesPanel() {
	return (
		<Panel>
			<PanelHeader
				title="Nguồn được hỗ trợ"
				description="Hiện hỗ trợ trang Facebook công khai và liên kết website tùy chỉnh."
			/>
			<div className="p-4">
				<SocialLogoGrid />
			</div>
		</Panel>
	);
}
