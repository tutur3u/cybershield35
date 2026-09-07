"use client";

import { CalendarClock, Radar, ScrollText, ShieldCheck } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { WorkspaceTabs } from "../workspace-tabs";

import type { DashboardPageProps } from "@/components/dashboard/dashboard-pages";
import { IntelligenceSourcesWorkspace } from "@/components/dashboard/intelligence-widgets";
import { PageHeader, QueueCard } from "@/components/dashboard/page-widgets";

import { SourceAutomationPanel } from "./automation-panel";
import { FacebookPageTrustPanel } from "./facebook-page-panel";
import { TrackedSourcesPanel } from "./tracked-sources-panel";

type SourceTabKey = "automation" | "pages" | "queue" | "tracked";

export function SourcesPage(props: DashboardPageProps) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const requestedTab = searchParams.get("view");
	const activeTab: SourceTabKey =
		requestedTab === "pages" ||
		requestedTab === "automation" ||
		requestedTab === "queue"
			? requestedTab
			: "tracked";
	function setActiveTab(tab: SourceTabKey) {
		const params = new URLSearchParams(searchParams);
		params.set("view", tab);
		window.history.pushState(null, "", `${pathname}?${params}`);
	}
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
			<WorkspaceTabs
				label="Chế độ xem nguồn"
				value={activeTab}
				onChange={setActiveTab}
				items={[
					{ id: "tracked", label: "Nguồn theo dõi", icon: Radar },
					{ id: "pages", label: "Phân loại trang", icon: ShieldCheck },
					{ id: "automation", label: "Tự động", icon: CalendarClock },
					{ id: "queue", label: "Lượt quét", icon: ScrollText },
				]}
			>
				<p className="text-sm text-[var(--muted)]">
					{activeSourceCount} nguồn đang bật · {queueCount} lượt đang chờ xử lý
				</p>
				{activeTab === "tracked" ? (
					<>
						<TrackedSourcesPanel
							isCreating={props.isCreating}
							onCreateTrackedSource={props.onCreateTrackedSource}
							onDeleteTrackedSource={props.onDeleteTrackedSource}
							onUpdateTrackedSource={props.onUpdateTrackedSource}
							sources={props.trackedSources}
						/>
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
						<IntelligenceSourcesWorkspace
							onOpenScan={props.onOpenScan}
							standalone
						/>
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
			</WorkspaceTabs>
		</div>
	);
}
