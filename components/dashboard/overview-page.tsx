"use client";

import { Plus, ShieldCheck, Sparkles } from "lucide-react";

import { ExecutiveIntelligenceDashboard } from "@/components/dashboard/intelligence-widgets";
import { PageHeader } from "@/components/dashboard/page-header";
import { QueueCard } from "@/components/dashboard/page-widgets";
import type { DashboardScan } from "@/components/dashboard/types";
import { SecondaryButton } from "@/components/dashboard/ui-primitives";

export function OverviewPage({
	onDeleteScan,
	onEditScan,
	onOpenDraft,
	onOpenScan,
	onRunScan,
	onSelectScan,
	scans,
	selectedScanId,
}: {
	onDeleteScan: (scan: DashboardScan) => Promise<void>;
	onEditScan: (scan: DashboardScan) => void;
	onOpenDraft: () => void;
	onOpenScan: () => void;
	onRunScan: (scan: DashboardScan) => Promise<void>;
	onSelectScan: (id: string) => void;
	scans: DashboardScan[];
	selectedScanId: string;
}) {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={ShieldCheck}
				title="Tổng quan tình báo điều hành"
				description="Tư thế rủi ro, động lượng chủ đề, độ mạnh bằng chứng, sức khỏe nguồn và độ sẵn sàng báo cáo."
				actions={
					<>
						<SecondaryButton onClick={onOpenScan}>
							<Plus size={14} /> Tạo scan
						</SecondaryButton>
						<SecondaryButton onClick={onOpenDraft}>
							<Sparkles size={14} /> Tạo phản hồi
						</SecondaryButton>
					</>
				}
			/>
			<ExecutiveIntelligenceDashboard onOpenScan={onOpenScan} />
			<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)]">
				<QueueCard
					enableInfinite
					limit={4}
					onDeleteScan={onDeleteScan}
					onEditScan={onEditScan}
					onRunScan={onRunScan}
					onSelectScan={onSelectScan}
					scans={scans}
					selectedScanId={selectedScanId}
				/>
			</div>
		</div>
	);
}
