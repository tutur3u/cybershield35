"use client";

import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Plus, Radar, Sparkles } from "lucide-react";
import Link from "next/link";

import { IntelligenceActivityStream } from "@/components/dashboard/intelligence-activity-stream";
import { QueryFeedback } from "@/components/dashboard/query-feedback";
import { UsageSummary } from "@/components/dashboard/usage-page";
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
		<div className="space-y-5 [&_.workspace-panel]:[content-visibility:visible]">
			<PageHeader
				icon={LayoutDashboard}
				title="Tổng quan"
				description="Nắm tình hình, ưu tiên việc cần làm và theo dõi chi phí trong một không gian."
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

			<QueryFeedback
				pending={pipelineQuery.isPending}
				failed={pipelineQuery.isError}
				onRetry={() => void pipelineQuery.refetch()}
			/>
			<WorkflowStrip pipeline={pipelineQuery.data} />

			<div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
				<div className="space-y-5">
					<AttentionPanel filters={filters} />
					<IntelligenceActivityStream compact limit={4} />
					<Link
						href="/audit"
						className="inline-flex text-sm font-semibold text-[var(--accent-strong)]"
					>
						Xem thêm hoạt động →
					</Link>
				</div>
				<div className="space-y-5">
					<UsageSummary />
					<section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
						<h2 className="font-semibold">Lối tắt công việc</h2>
						<div className="mt-4 grid gap-3 text-sm">
							<Link
								className="rounded-lg bg-[var(--surface-soft)] p-3 hover:text-[var(--accent-strong)]"
								href="/articles?review=needs_review"
							>
								Duyệt bài viết →
							</Link>
							<Link
								className="rounded-lg bg-[var(--surface-soft)] p-3 hover:text-[var(--accent-strong)]"
								href="/sources?view=queue"
							>
								Theo dõi hàng đợi quét →
							</Link>
							<Link
								className="rounded-lg bg-[var(--surface-soft)] p-3 hover:text-[var(--accent-strong)]"
								href="/operations"
							>
								Kiểm tra vận hành →
							</Link>
						</div>
					</section>
				</div>
			</div>

			<QueueCard
				limit={4}
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
