"use client";

import { ArrowRight, Database } from "lucide-react";
import Link from "next/link";

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
	return (
		<div className="space-y-5">
			<PageHeader
				icon={Database}
				title="Phân tích thảo luận"
				description="Chủ đề, lập trường, cảm xúc, rủi ro và bằng chứng chuẩn hóa."
				actions={
					<Link
						href="/evidence"
						className="inline-flex h-10 max-w-full items-center justify-center gap-2 whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
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
