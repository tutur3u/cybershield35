"use client";

import {
	ArrowRight,
	CheckCircle2,
	CircleAlert,
	Edit3,
	Layers3,
	Link2,
	Quote,
	Trash2,
} from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";

import { IntentPrefetchLink } from "@/components/dashboard/intent-prefetch-link";
import type {
	AnalysisView,
	AnalysisProofView,
	ClaimView,
	EvidenceView,
	RiskFlagView,
	TopicCluster,
} from "./types";
import {
	scanEvidenceInfiniteQueryOptions,
	topicDetailInfiniteQueryOptions,
	topicsInfiniteQueryOptions,
} from "@/lib/dashboard/client-queries";
import { buildTopicInsights, type TopicInsight } from "@/lib/dashboard/insights";
import { assessEvidenceRisk } from "@/lib/domain/evidence-risk";
import { resolveRiskFlagEvidence } from "@/lib/domain/analysis-evidence";
import {
	DashboardTooltip,
	Panel,
	PanelHeader,
	ProgressBar,
	RiskPill,
} from "./ui-primitives";

export function SentimentAndStance({
	analysis,
	className = "",
}: {
	analysis: AnalysisView;
	className?: string;
}) {
	const sentimentRows = sentimentPercentages(analysis.sentiment);
	const total = analysis.sentiment.total;
	return (
		<Panel className={className}>
			<PanelHeader title="Cảm xúc & lập trường" />
			<div className="grid items-center gap-5 p-4 sm:grid-cols-[170px_minmax(0,1fr)]">
				<div
					className="mx-auto size-32 rounded-full"
					style={{
						background: sentimentGradient(sentimentRows),
					}}
				>
					<div className="m-6 grid size-20 place-items-center rounded-full bg-[var(--surface)] text-[13px] font-bold text-[var(--muted-strong)] shadow-[inset_0_0_0_1px_var(--border)]">
						{total.toLocaleString("vi-VN")}
					</div>
				</div>
				<div className="space-y-4">
					{sentimentRows.map((slice) => (
						<ProgressRow
							key={slice.label}
							label={slice.label}
							value={slice.value}
							color={slice.color}
						/>
					))}
					<ProgressRow label="Lập trường" value={total ? 100 : 0} />
				</div>
			</div>
		</Panel>
	);
}

export function TopicPanel({
	className = "",
	evidence = [],
	topics,
}: {
	className?: string;
	evidence?: EvidenceView;
	topics: TopicCluster[];
}) {
	const topicInsights = buildTopicInsights({ evidence, topics }).slice(0, 7);

	return (
		<Panel className={`flex flex-col ${className}`}>
			<PanelHeader
				title="Cụm chủ đề nổi bật"
				action={
										<IntentPrefetchLink
						href="/topics"
						className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition whitespace-nowrap hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
					>
						Mở chủ đề <ArrowRight size={14} />
										</IntentPrefetchLink>
				}
			/>
			<div
				className="grid flex-1 divide-y divide-[var(--divider)] p-4"
				style={{
					gridTemplateRows: topicInsights.length
						? `repeat(${topicInsights.length}, minmax(58px, 1fr))`
						: undefined,
				}}
			>
				{topicInsights.length ? (
					topicInsights.map((topic) => (
						<div
							key={topic.key}
							className="grid min-h-14 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(82px,auto)_minmax(74px,auto)_auto] sm:items-center"
						>
								<IntentPrefetchLink
								href={topic.href}
								className="min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
							>
								<span className="block truncate text-[13px] font-bold text-[var(--foreground)]">
									{topic.name}
								</span>
								<span className="mt-0.5 block truncate text-[11px] font-semibold text-[var(--muted)]">
									{topic.recommendation}
								</span>
								</IntentPrefetchLink>
							<span className="text-[12px] text-[var(--muted)] sm:text-right">
								{topic.count.toLocaleString("vi-VN")} mẫu
							</span>
							<span className="text-[12px] font-semibold text-[var(--muted-strong)] sm:text-right">
								{topic.trend}
							</span>
							<RiskPill risk={topic.riskLevel} />
						</div>
					))
				) : (
					<EmptyPanelText>Chưa có cụm chủ đề từ phân tích live.</EmptyPanelText>
				)}
			</div>
		</Panel>
	);
}

export function TopicExplorer({
	evidence,
	topics,
}: {
	evidence: EvidenceView;
	topics: TopicCluster[];
}) {
	const topicsQuery = useInfiniteQuery(topicsInfiniteQueryOptions(12));
	const persistedTopics =
		topicsQuery.data?.pages.flatMap((page) => page.items) ?? [];
	const topicInsights = buildTopicInsights({
		evidence,
		topics: persistedTopics.length ? persistedTopics : topics,
	});
	const leadTopic = topicInsights[0];

	return (
		<div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
			<Panel>
				<PanelHeader
					title="Danh mục chủ đề"
					description="Mỗi chủ đề là một nhóm nội dung cần theo dõi, đọc mẫu và quyết định bước tiếp theo."
				/>
				<div className="divide-y divide-[var(--divider)] p-4">
					{topicInsights.length ? (
						topicInsights.map((topic) => (
							<TopicInsightRow key={topic.key} topic={topic} />
						))
					) : (
						<EmptyPanelText>Chưa có chủ đề. Chạy hoặc chọn một scan đã phân tích.</EmptyPanelText>
					)}
				</div>
				{topicsQuery.hasNextPage ? (
					<div className="border-t border-[var(--border)] p-3">
						<button
							type="button"
							disabled={topicsQuery.isFetchingNextPage}
							onClick={() => void topicsQuery.fetchNextPage()}
							className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-60"
						>
							{topicsQuery.isFetchingNextPage
								? "Đang tải thêm..."
								: "Tải thêm chủ đề"}
						</button>
					</div>
				) : null}
			</Panel>
			<Panel>
				<PanelHeader
					title="Cách đọc nhanh"
					description="Dành cho người vận hành không cần hiểu cron, provider hay thuật ngữ kỹ thuật."
				/>
				<div className="space-y-4 p-4">
					{leadTopic ? (
						<>
							<div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
								<div className="flex min-w-0 flex-wrap items-center gap-2">
									<Layers3 size={17} className="text-[var(--accent)]" />
									<h2 className="min-w-0 break-words text-[16px] font-bold text-[var(--foreground)]">
										{leadTopic.name}
									</h2>
									<RiskPill risk={leadTopic.riskLevel} />
								</div>
								<p className="mt-3 text-[13px] leading-6 text-[var(--muted-strong)]">
									{leadTopic.recommendation}
								</p>
							</div>
							<div className="space-y-3">
								{leadTopic.evidence.slice(0, 3).map((item) => (
								<IntentPrefetchLink
										key={item.id}
										href={`/evidence/${item.id}${item.scanJobId ? `?scanId=${item.scanJobId}` : ""}`}
										className="block rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
									>
										<p className="overflow-hidden text-[13px] leading-5 break-words text-[var(--foreground)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">
											"{item.quote}"
										</p>
										<p className="mt-2 truncate text-[11px] font-semibold text-[var(--muted)]">
											{item.sourceLabel ?? "Nguồn công khai"}
										</p>
								</IntentPrefetchLink>
								))}
							</div>
						</>
					) : (
						<EmptyPanelText>Chọn scan đã hoàn tất để xem cách đọc chủ đề.</EmptyPanelText>
					)}
				</div>
			</Panel>
		</div>
	);
}

export function TopicDetailPanel({ slug }: { slug?: string }) {
	const topicQuery = useInfiniteQuery(topicDetailInfiniteQueryOptions(slug ?? "", 12));
	const firstPage = topicQuery.data?.pages[0];
	const evidence = uniqueEvidence(
		topicQuery.data?.pages.flatMap((page) => page.evidence) ?? [],
	);

	return (
		<div className="space-y-5">
			<Panel>
				<PanelHeader
					title={firstPage?.name ?? "Chủ đề"}
					description={
						firstPage
							? "Bài viết và bằng chứng đã được gắn với chủ đề này."
							: "Đang tải bài viết liên quan."
					}
					action={firstPage ? <RiskPill risk={firstPage.riskLevel} /> : null}
				/>
				<div className="grid gap-3 p-4 sm:grid-cols-3">
					<TopicMetric
						label="Bài viết liên quan"
						value={(firstPage?.evidenceCount ?? evidence.length).toLocaleString("vi-VN")}
					/>
					<TopicMetric label="Xu hướng" value={firstPage?.trend ?? "Đang tải"} />
					<TopicMetric
						label="Cập nhật"
						value={formatTopicDate(firstPage?.updatedAt)}
					/>
				</div>
			</Panel>

			<Panel>
				<PanelHeader
					title="Bài viết liên quan"
					description={`${evidence.length.toLocaleString("vi-VN")} bài đã tải · mở từng bài để xem nguồn và ngữ cảnh xử lý.`}
				/>
				<div className="divide-y divide-[var(--divider)] p-4">
					{topicQuery.isPending ? (
						<EmptyPanelText>Đang tải bài viết liên quan.</EmptyPanelText>
					) : topicQuery.isError ? (
						<div className="py-8 text-center">
							<EmptyPanelText>{topicQuery.error.message || "Không thể tải chủ đề này."}</EmptyPanelText>
							<button type="button" onClick={() => void topicQuery.refetch()} className="mt-3 inline-flex h-9 items-center rounded-md border border-[var(--border)] px-3 text-xs font-bold text-[var(--muted-strong)] hover:bg-[var(--surface-soft)]">Thử lại</button>
						</div>
					) : evidence.length ? (
						evidence.map((item) => (
						<IntentPrefetchLink
								key={item.id}
								href={`/evidence/${item.id}${item.scanJobId ? `?scanId=${item.scanJobId}` : ""}`}
								className="grid min-w-0 gap-3 py-4 transition hover:bg-[var(--surface-soft)] sm:grid-cols-[minmax(0,1fr)_100px_auto] sm:items-start"
							>
								<div className="min-w-0">
									<p className="overflow-hidden text-[13px] leading-6 break-words text-[var(--foreground)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4]">
										"{item.quote}"
									</p>
									<p className="mt-2 break-words text-[12px] leading-5 text-[var(--muted)]">
										{item.summary}
									</p>
									<p className="mt-2 truncate text-[11px] font-semibold text-[var(--muted)]">
										{item.sourceLabel ?? "Nguồn công khai"}
									</p>
								</div>
								<span className="text-[12px] font-semibold text-[var(--muted)] sm:text-right">
									Khớp {item.topicConfidence ?? 0}%
								</span>
								<RiskPill risk={item.riskLevel ?? "medium"} />
						</IntentPrefetchLink>
						))
					) : (
						<EmptyPanelText>Chủ đề này chưa có bài viết được gắn.</EmptyPanelText>
					)}
				</div>
				<div className="border-t border-[var(--border)] p-3">
					<button
						type="button"
						disabled={!topicQuery.hasNextPage || topicQuery.isFetchingNextPage}
						onClick={() => void topicQuery.fetchNextPage()}
						className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-60"
					>
						{topicQuery.isFetchingNextPage
							? "Đang tải thêm..."
							: topicQuery.hasNextPage
								? "Tải thêm bài viết"
								: "Đã tải hết bài viết"}
					</button>
				</div>
			</Panel>
		</div>
	);
}

export function AlertPanel({
	className = "",
	evidence = [],
	flags,
	scanId,
}: {
	className?: string;
	evidence?: EvidenceView;
	flags: RiskFlagView[];
	scanId?: string;
}) {
	return (
		<Panel className={`flex flex-col ${className}`}>
			<PanelHeader
				title="Cảnh báo ưu tiên"
				description="Chỉ hiện bài hỗ trợ trực tiếp; trùng mức rủi ro hoặc từ ngữ tình cờ không được tính."
			/>
			<div
				className="grid flex-1 gap-3 p-4"
				style={{
					gridTemplateRows: flags.length
						? `repeat(${flags.length}, minmax(84px, auto))`
						: undefined,
				}}
			>
				{flags.length ? (
					flags.map((row) => {
						const resolution = resolveRiskFlagEvidence(row, evidence);
						const relatedEvidence = resolution.evidence;
						return (
							<div
								key={row.label}
								className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3"
							>
								<div className="flex min-w-0 items-start justify-between gap-3">
									<div className="min-w-0">
										<p className="break-words text-[13px] font-bold leading-5 text-[var(--foreground)]">
											{row.label}
										</p>
										<p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">
											{relatedEvidence.length
												? `${relatedEvidence.length} bằng chứng hỗ trợ trực tiếp`
												: "Không có bằng chứng hỗ trợ trực tiếp"}
										</p>
										{row.rationale ? (
											<p className="mt-2 text-[11px] leading-5 text-[var(--muted-strong)]">
												{row.rationale}
											</p>
										) : null}
									</div>
									<DashboardTooltip content="Số bằng chứng trực tiếp còn lại sau khi kiểm tra liên kết ngữ nghĩa.">
										<span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--danger-soft)] text-[11px] font-bold text-[var(--danger-strong)]">
											{relatedEvidence.length}
										</span>
									</DashboardTooltip>
								</div>
								<EvidenceLinkStatus
									proofCount={row.proofs?.length ?? 0}
									resolution={resolution}
								/>
								<EvidenceDeepLinks
									evidence={relatedEvidence}
									proofs={row.proofs}
									scanId={scanId}
								/>
							</div>
						);
					})
				) : (
					<EmptyPanelText>Chưa có cảnh báo ưu tiên.</EmptyPanelText>
				)}
			</div>
		</Panel>
	);
}

export function RiskFlagPanel({
	analysis,
	evidence = [],
	scanId,
}: {
	analysis: AnalysisView;
	evidence?: EvidenceView;
	scanId?: string;
}) {
	return (
		<Panel>
			<PanelHeader
				title="Vấn đề cần ưu tiên"
				description="Mở nội dung và lý do liên kết trước khi ưu tiên xử lý."
			/>
			<div className="space-y-3 p-4">
				{analysis.riskFlags.length ? (
					analysis.riskFlags.map((flag) => {
						const resolution = resolveRiskFlagEvidence(flag, evidence);
						const relatedEvidence = resolution.evidence;
						return (
							<div
								key={flag.label}
								className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3"
							>
								<div className="flex min-w-0 items-start justify-between gap-3">
									<div className="min-w-0">
										<p className="break-words text-[13px] font-bold leading-5 text-[var(--foreground)]">
											{flag.label}
										</p>
										<p className="mt-1 text-[11px] text-[var(--muted)]">
											{relatedEvidence.length
												? `${relatedEvidence.length} bằng chứng hỗ trợ trực tiếp`
												: "Chưa có bằng chứng đủ phù hợp để liên kết"}
										</p>
										{flag.rationale ? (
											<p className="mt-2 text-[11px] leading-5 text-[var(--muted-strong)]">
												{flag.rationale}
											</p>
										) : null}
									</div>
									<RiskPill risk={flag.severity} />
								</div>
								<EvidenceLinkStatus
									proofCount={flag.proofs?.length ?? 0}
									resolution={resolution}
								/>
								<EvidenceDeepLinks
									evidence={relatedEvidence}
									proofs={flag.proofs}
									scanId={scanId}
								/>
							</div>
						);
					})
				) : (
					<EmptyPanelText>Chưa phát hiện vấn đề cần ưu tiên.</EmptyPanelText>
				)}
			</div>
		</Panel>
	);
}

export function ClaimEvidencePanel({
	claims,
	className = "",
	evidence,
	scanId,
}: {
	claims: ClaimView[];
	className?: string;
	evidence: EvidenceView;
	scanId?: string;
}) {
	const evidenceById = new Map(evidence.map((item) => [item.id, item]));

	return (
		<Panel className={className}>
			<PanelHeader
				title="Nhận định có bằng chứng"
				description="Mỗi nhận định chỉ được hiển thị khi có bằng chứng liên quan để kiểm tra."
			/>
			<div className="divide-y divide-[var(--divider)] p-4">
				{claims.length ? (
					claims.map((claim) => {
						const citedEvidence = claim.evidenceIds
							.map((id) => evidenceById.get(id))
							.filter((item): item is EvidenceView[number] => Boolean(item));
						return (
							<div key={`${claim.claim}-${claim.stance}`} className="min-w-0 py-4">
								<div className="flex min-w-0 flex-wrap items-center gap-2">
									<Quote size={15} className="shrink-0 text-[var(--accent)]" />
									<DashboardTooltip content={stanceTooltip(claim.stance)}>
										<span className="rounded-md bg-[var(--surface-soft)] px-2 py-1 text-[10px] font-bold uppercase leading-none text-[var(--muted-strong)]">
											{claim.stance}
										</span>
									</DashboardTooltip>
									<DashboardTooltip content="Mức độ bằng chứng hiện có hỗ trợ trực tiếp cho nhận định này.">
										<span className="rounded-md bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-bold leading-none text-[var(--accent-strong)]">
											{Math.round(claim.confidence * 100)}%
										</span>
									</DashboardTooltip>
								</div>
								<p className="mt-2 break-words text-[13px] leading-6 text-[var(--foreground)]">
									{claim.claim}
								</p>
								{claim.rationale ? (
									<p className="mt-2 rounded-md bg-[var(--surface-soft)] px-3 py-2 text-[11px] leading-5 text-[var(--muted-strong)]">
										<span className="font-bold text-[var(--foreground)]">Vì sao: </span>
										{claim.rationale}
									</p>
								) : null}
								<EvidenceDeepLinks
									evidence={citedEvidence}
									emptyLabel="Bằng chứng trích dẫn chưa có trong dữ liệu đã tải."
									proofs={claim.proofs}
									scanId={scanId}
								/>
							</div>
						);
					})
				) : (
					<EmptyPanelText>Chưa có nhận định đủ bằng chứng.</EmptyPanelText>
				)}
			</div>
		</Panel>
	);
}

export function EvidencePanel({
	className = "",
	enableInfinite = false,
	evidence,
	limit,
	onDeleteEvidence,
	onEditEvidence,
	scanId,
}: {
	className?: string;
	enableInfinite?: boolean;
	evidence: EvidenceView;
	limit?: number;
	onDeleteEvidence?: (evidence: EvidenceView[number]) => Promise<void>;
	onEditEvidence?: (evidence: EvidenceView[number]) => void;
	scanId?: string;
}) {
	const pageSize = limit ?? 10;
	const evidenceQuery = useInfiniteQuery({
		...scanEvidenceInfiniteQueryOptions(scanId ?? "", pageSize),
		enabled: enableInfinite && Boolean(scanId),
		initialData:
			enableInfinite && scanId && evidence.length
				? initialEvidencePage(evidence, pageSize, scanId)
				: undefined,
	});
	const loadedEvidence = enableInfinite
		? uniqueEvidence(evidenceQuery.data?.pages.flatMap((page) => page.items) ?? evidence)
		: evidence;
	const visible = enableInfinite
		? loadedEvidence
		: limit
			? evidence.slice(0, limit)
			: evidence;

	return (
		<Panel className={className}>
			<PanelHeader
				title={`Bằng chứng cùng scan (${loadedEvidence.length})`}
				description="Danh sách được tải theo từng trang để giữ màn hình nhanh và dễ theo dõi."
			/>
			<div className="divide-y divide-[var(--divider)] p-4">
				{visible.length ? (
					visible.map((item, index) => (
						<div
							key={item.id}
							className="grid min-h-16 gap-3 py-3 transition hover:bg-[var(--surface-soft)] sm:grid-cols-[32px_minmax(0,1fr)_auto_auto] sm:items-center"
						>
							<span className="text-[12px] font-semibold text-[var(--muted)]">
								{index + 1}.
							</span>
								<IntentPrefetchLink
									href={`/evidence/${item.id}${scanId ? `?scanId=${scanId}` : ""}`}
								className="min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
							>
								<p className="break-words text-[13px] leading-6 text-[var(--foreground)]">
									"{item.quote}"
								</p>
								<p className="mt-1 truncate text-[11px] text-[var(--muted)]">
									{item.sourceLabel ?? "Nguồn công khai"} - {item.author ?? "Public"}
								</p>
								</IntentPrefetchLink>
							<RiskPill
								reasons={evidenceRiskReasons(item)}
								risk={item.riskLevel ?? "medium"}
							/>
							{onEditEvidence || onDeleteEvidence ? (
								<div className="flex gap-2 sm:justify-end">
									{onEditEvidence ? (
										<button
											type="button"
											onClick={() => onEditEvidence(item)}
											className="grid size-9 place-items-center rounded-md border border-[var(--border)] text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]"
											aria-label="Chỉnh bằng chứng"
										>
											<Edit3 size={14} />
										</button>
									) : null}
									{onDeleteEvidence ? (
										<button
											type="button"
											onClick={() => void onDeleteEvidence(item)}
											className="grid size-9 place-items-center rounded-md border border-[var(--danger-border)] text-[var(--danger-strong)] transition hover:bg-[var(--danger-soft)]"
											aria-label="Xóa bằng chứng"
										>
											<Trash2 size={14} />
										</button>
									) : null}
								</div>
							) : null}
						</div>
					))
				) : evidenceQuery.isPending && enableInfinite ? (
					<EmptyPanelText>Đang tải bằng chứng liên quan…</EmptyPanelText>
				) : evidenceQuery.isError && enableInfinite ? (
					<div className="py-6 text-center">
						<EmptyPanelText>{evidenceQuery.error.message || "Không thể tải bằng chứng liên quan."}</EmptyPanelText>
						<button type="button" onClick={() => void evidenceQuery.refetch()} className="mt-3 inline-flex h-9 items-center rounded-md border border-[var(--border)] px-3 text-xs font-bold text-[var(--muted-strong)] hover:bg-[var(--surface-soft)]">Thử lại</button>
					</div>
				) : (
					<EmptyPanelText>Chưa có bằng chứng. Hãy quét một nguồn để bắt đầu.</EmptyPanelText>
				)}
			</div>
			{enableInfinite && scanId ? (
				<div className="border-t border-[var(--border)] p-3">
					<button
						type="button"
						disabled={!evidenceQuery.hasNextPage || evidenceQuery.isFetchingNextPage}
						onClick={() => void evidenceQuery.fetchNextPage()}
						className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-60"
					>
						{evidenceQuery.isFetchingNextPage
							? "Đang tải thêm..."
						: evidenceQuery.hasNextPage
							? `Tải thêm · ${loadedEvidence.length} đã hiển thị`
							: `Đã tải toàn bộ ${loadedEvidence.length} bằng chứng`}
					</button>
				</div>
			) : null}
		</Panel>
	);
}

function evidenceRiskReasons(item: EvidenceView[number]) {
	const storedReasons = item.metadata?.riskReasons;
	if (
		Array.isArray(storedReasons) &&
		storedReasons.every((reason): reason is string => typeof reason === "string")
	) {
		return storedReasons;
	}
	const engagement = item.engagement as
		| { comments?: number; shares?: number }
		| undefined;
	return assessEvidenceRisk({
		comments: engagement?.comments,
		shares: engagement?.shares,
		storedRisk: item.riskLevel,
		text: item.quote,
	}).reasons;
}

function TopicInsightRow({ topic }: { topic: TopicInsight }) {
	return (
			<IntentPrefetchLink
				href={topic.href}
			className="grid min-w-0 gap-3 py-4 transition hover:bg-[var(--surface-soft)] sm:grid-cols-[minmax(0,1fr)_120px_84px] sm:items-center"
		>
			<div className="min-w-0">
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					<h2 className="min-w-0 break-words text-[14px] font-bold text-[var(--foreground)]">
						{topic.name}
					</h2>
					<span className="rounded-md bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-bold leading-none text-[var(--accent-strong)]">
						{topic.attentionLabel}
					</span>
				</div>
				<p className="mt-1 break-words text-[12px] leading-5 text-[var(--muted)]">
					{topic.recommendation}
				</p>
			</div>
			<div className="text-[12px] font-semibold text-[var(--muted)] sm:text-right">
				{topic.count.toLocaleString("vi-VN")} mẫu
				<p className="mt-1 text-[11px] text-[var(--muted-strong)]">
					{topic.trend}
				</p>
			</div>
			<RiskPill risk={topic.riskLevel} />
			</IntentPrefetchLink>
	);
}

function TopicMetric({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
			<p className="text-[11px] font-bold uppercase text-[var(--muted)]">
				{label}
			</p>
			<p className="mt-2 break-words text-[15px] font-bold text-[var(--foreground)]">
				{value}
			</p>
		</div>
	);
}

function formatTopicDate(value?: string | null) {
	if (!value) return "Chưa có";
	return new Intl.DateTimeFormat("vi-VN", {
		hour: "2-digit",
		minute: "2-digit",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(new Date(value));
}

function initialEvidencePage(
	evidence: EvidenceView,
	limit: number,
	scanId: string,
) {
	const hasNextPage = evidence.length > limit;
	return {
		pageParams: [null as string | null],
		pages: [
			{
				hasNextPage,
				items: evidence.slice(0, limit),
				limit,
				nextCursor: hasNextPage ? String(limit) : null,
				scanId,
			},
		],
	};
}

function EvidenceDeepLinks({
	emptyLabel = "Liên kết tự động đã được giữ lại vì chưa có bằng chứng hỗ trợ trực tiếp.",
	evidence,
	proofs = [],
	scanId,
}: {
	emptyLabel?: string;
	evidence: EvidenceView;
	proofs?: AnalysisProofView[];
	scanId?: string;
}) {
	if (!evidence.length) {
		return (
			<p className="mt-3 rounded-md border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-[11px] font-semibold text-[var(--muted)]">
				{emptyLabel}
			</p>
		);
	}

	const proofByEvidenceId = new Map(
		proofs.map((proof) => [proof.evidenceId, proof]),
	);

	return (
		<div className="mt-3 grid min-w-0 gap-2">
			{evidence.slice(0, 3).map((item, index) => {
				const proof = proofByEvidenceId.get(item.id);
				return (
				<IntentPrefetchLink
					key={item.id}
					href={evidenceHref(item, scanId)}
					className="group grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] p-2.5 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
				>
					<span className="grid size-6 shrink-0 place-items-center rounded bg-[var(--accent-soft)] text-[10px] font-bold text-[var(--accent-strong)]">
						{index + 1}
					</span>
					<span className="min-w-0">
						<span className="block truncate text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--muted)]">
							{item.sourceLabel ?? "Nguồn công khai"}
						</span>
						<span className="mt-1 block overflow-hidden text-[11px] leading-4 text-[var(--foreground)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">
							{proof ? `“${proof.excerpt}”` : item.summary || item.quote || "Mở bằng chứng gốc"}
						</span>
						{proof ? (
							<>
								<span className="mt-2 block text-[10px] font-semibold leading-4 text-[var(--accent-strong)]">
									Chứng minh: {proof.support}
								</span>
								<span className="mt-1 block text-[10px] leading-4 text-[var(--muted)]">
									Độ chắc chắn {Math.round(proof.confidence * 100)}%
									{proof.limitation ? ` · Giới hạn: ${proof.limitation}` : " · Không có giới hạn đáng kể"}
								</span>
							</>
						) : null}
					</span>
					<Link2 size={13} className="mt-1 shrink-0 text-[var(--muted)] transition group-hover:text-[var(--accent-strong)]" />
				</IntentPrefetchLink>
				);
			})}
		</div>
	);
}

function evidenceHref(item: EvidenceView[number], scanId?: string) {
	const selectedScanId = scanId ?? item.scanJobId;
	return `/evidence/${item.id}${selectedScanId ? `?scanId=${selectedScanId}` : ""}`;
}

function EvidenceLinkStatus({
	proofCount,
	resolution,
}: {
	proofCount: number;
	resolution: ReturnType<typeof resolveRiskFlagEvidence>;
}) {
	if (resolution.rejectedCitationCount > 0) {
		return (
			<p className="mt-3 flex items-start gap-1.5 rounded-md bg-[var(--warning-soft)] px-2.5 py-2 text-[10px] font-semibold leading-4 text-[var(--warning-strong)]">
				<CircleAlert size={13} className="mt-0.5 shrink-0" />
				Đã loại {resolution.rejectedCitationCount} liên kết không hỗ trợ trực tiếp cho cảnh báo này.
			</p>
		);
	}
	if (resolution.evidence.length) {
		return (
			<p className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-[var(--success-strong)]">
				<CheckCircle2 size={13} />
				{proofCount > 0
					? `Đã xác thực ${proofCount} trích đoạn nguồn`
					: resolution.source === "cited"
					? "Đã kiểm tra trích dẫn trực tiếp"
					: "Liên kết cũ đã được kiểm tra lại theo nội dung"}
			</p>
		);
	}
	return null;
}

function uniqueEvidence(evidence: EvidenceView) {
	const seen = new Set<string>();
	return evidence.filter((item) => {
		if (seen.has(item.id)) return false;
		seen.add(item.id);
		return true;
	});
}

function stanceTooltip(stance: string) {
	const normalized = stance.toLowerCase();
	if (normalized.includes("support")) {
		return "Claim này được phân tích là ủng hộ hoặc củng cố lập luận đang xét.";
	}
	if (normalized.includes("oppose") || normalized.includes("against")) {
		return "Claim này được phân tích là phản bác hoặc đi ngược lập luận đang xét.";
	}
	if (normalized.includes("neutral")) {
		return "Claim này được phân tích là trung lập, chủ yếu cung cấp bối cảnh.";
	}
	return "Nhãn lập trường do LLM gán cho claim này.";
}

function EmptyPanelText({ children }: { children: string }) {
	return <p className="p-3 text-[12px] font-semibold text-[var(--muted)]">{children}</p>;
}

function sentimentPercentages(sentiment: AnalysisView["sentiment"]) {
	const values = [
		{ label: "Tích cực", value: sentiment.positive, color: "#38a169" },
		{ label: "Trung lập", value: sentiment.neutral, color: "#94a3b8" },
		{ label: "Tiêu cực", value: sentiment.negative, color: "#ef4444" },
	];
	const total = values.reduce((sum, row) => sum + row.value, 0);
	if (!total) return values.map((row) => ({ ...row, value: 0 }));
	return values.map((row) => ({
		...row,
		value: Math.round((row.value / total) * 100),
	}));
}

function sentimentGradient(rows: Array<{ color: string; value: number }>) {
	let cursor = 0;
	const stops = rows.map((row) => {
		const start = cursor;
		cursor += row.value;
		return `${row.color} ${start}% ${cursor}%`;
	});
	return `conic-gradient(${stops.join(", ")})`;
}

function ProgressRow({
	color,
	label,
	value,
}: {
	color?: string;
	label: string;
	value: number;
}) {
	return (
		<div className="grid grid-cols-[84px_minmax(0,1fr)_42px] items-center gap-3 text-[12px]">
			<span className="flex min-w-0 items-center gap-2 text-[var(--muted-strong)]">
				{color ? (
					<span
						className="size-2 shrink-0 rounded-sm"
						style={{ backgroundColor: color }}
					/>
				) : null}
				<span className="truncate">{label}</span>
			</span>
			<ProgressBar value={value} />
			<span className="text-right font-bold text-[var(--foreground)]">{value}%</span>
		</div>
	);
}
