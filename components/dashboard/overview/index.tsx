"use client";

import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Plus, Radar, Sparkles } from "lucide-react";
import Link from "next/link";

import { IntelligenceActivityStream } from "@/components/dashboard/intelligence-activity-stream";
import { PageHeader } from "@/components/dashboard/page-header";
import { QueueCard } from "@/components/dashboard/page-widgets";
import type { DashboardScan } from "@/components/dashboard/types";
import { SecondaryButton } from "@/components/dashboard/ui-primitives";
import { useIntelligenceFiltersFromUrl } from "@/components/dashboard/intelligence-workspace-shared";
import { workflowPipelineQueryOptions } from "@/lib/dashboard/client-queries";

import { AttentionPanel } from "./attention-panel";
import { WorkflowStrip } from "./workflow-strip";

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
	const [filters] = useIntelligenceFiltersFromUrl();
	const pipelineQuery = useQuery(workflowPipelineQueryOptions());

	return (
		<div className="space-y-5">
			<PageHeader
				icon={LayoutDashboard}
				title="Tổng quan"
				description="Tình trạng công việc hôm nay: nguồn đang quét, nội dung mới, bài chờ duyệt và bài sẵn sàng xuất bản."
				actions={
					<>
						<Link
							href="/sources"
							className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]"
						>
							<Radar size={15} /> Thêm nguồn
						</Link>
						<SecondaryButton onClick={onOpenScan}>
							<Plus size={14} /> Quét nội dung
						</SecondaryButton>
						<SecondaryButton onClick={onOpenDraft}>
							<Sparkles size={14} /> Soạn phản hồi
						</SecondaryButton>
					</>
				}
			/>

			<WorkflowStrip pipeline={pipelineQuery.data} />

			<div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
				<AttentionPanel filters={filters} />
				<IntelligenceActivityStream compact limit={8} />
			</div>

			<QueueCard
				enableInfinite
				limit={6}
				onDeleteScan={onDeleteScan}
				onEditScan={onEditScan}
				onRunScan={onRunScan}
				onSelectScan={onSelectScan}
				scans={scans}
				selectedScanId={selectedScanId}
			/>
		</div>
	);
}
