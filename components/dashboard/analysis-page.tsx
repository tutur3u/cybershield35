"use client";

import { ArrowRight, Database, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
	AlertPanel,
	EvidencePanel,
	RiskFlagPanel,
	SentimentAndStance,
	TopicPanel,
} from "@/components/dashboard/analysis-widgets";
import type { DashboardPageProps } from "@/components/dashboard/dashboard-pages";
import { AnalysisSummary, PageHeader } from "@/components/dashboard/page-widgets";

export function AnalysisPage(props: DashboardPageProps) {
	const [isConfirmingRevision, setIsConfirmingRevision] = useState(false);
	const [isRevising, setIsRevising] = useState(false);

	async function reviseAnalysis() {
		setIsConfirmingRevision(false);
		setIsRevising(true);
		try {
			await props.onReviseAnalysis();
		} finally {
			setIsRevising(false);
		}
	}

	return (
		<div className="space-y-5">
			<PageHeader
				icon={Database}
				title="Phân tích thảo luận"
				description="Mỗi nhận định rủi ro đi kèm lý do và bằng chứng hỗ trợ trực tiếp để kiểm tra."
				actions={
					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							disabled={isRevising || !props.selectedScanId}
							onClick={() =>
								isConfirmingRevision
									? void reviseAnalysis()
									: setIsConfirmingRevision(true)
							}
							className="inline-flex h-10 max-w-full items-center justify-center gap-2 whitespace-nowrap rounded-md bg-[var(--accent)] px-3 text-[12px] font-bold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
						>
							<RefreshCw size={14} className={isRevising ? "animate-spin" : ""} />
							{isRevising
								? "Đang kiểm chứng..."
								: isConfirmingRevision
									? "Xác nhận phân tích lại"
									: "Phân tích lại"}
						</button>
						{isConfirmingRevision && !isRevising ? (
							<>
								<span className="max-w-64 text-[11px] leading-4 text-[var(--muted)]">
									Dùng bằng chứng đã lưu và thay thế kết quả hiện tại.
								</span>
								<button
									type="button"
									onClick={() => setIsConfirmingRevision(false)}
									className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]"
								>
									Hủy
								</button>
							</>
						) : null}
						<Link
							href="/evidence"
							className="inline-flex h-10 max-w-full items-center justify-center gap-2 whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
						>
							Kho bằng chứng <ArrowRight size={14} />
						</Link>
					</div>
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
