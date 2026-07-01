import { ArrowRight, Edit3, Layers3, Trash2 } from "lucide-react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";

import type { AnalysisView, EvidenceView, RiskFlagView, TopicCluster } from "./types";
import { scanEvidenceInfiniteQueryOptions } from "@/lib/dashboard/client-queries";
import { buildTopicInsights, type TopicInsight } from "@/lib/dashboard/insights";
import { Panel, PanelHeader, ProgressBar, RiskPill } from "./ui-primitives";

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
					<Link
						href="/topics"
						className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition whitespace-nowrap hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
					>
						Mở chủ đề <ArrowRight size={14} />
					</Link>
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
							<Link
								href={topic.href}
								className="min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
							>
								<span className="block truncate text-[13px] font-bold text-[var(--foreground)]">
									{topic.name}
								</span>
								<span className="mt-0.5 block truncate text-[11px] font-semibold text-[var(--muted)]">
									{topic.recommendation}
								</span>
							</Link>
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
	const topicInsights = buildTopicInsights({ evidence, topics });
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
									<Link
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
									</Link>
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

export function AlertPanel({
	className = "",
	flags,
}: {
	className?: string;
	flags: RiskFlagView[];
}) {
	return (
		<Panel className={`flex flex-col ${className}`}>
			<PanelHeader title="Cảnh báo ưu tiên" />
			<div
				className="grid flex-1 gap-3 p-4"
				style={{
					gridTemplateRows: flags.length
						? `repeat(${flags.length}, minmax(48px, 1fr))`
						: undefined,
				}}
			>
				{flags.length ? (
					flags.map((row) => (
						<div
							key={row.label}
							className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3"
						>
							<span className="min-w-0 truncate text-[13px] font-bold text-[var(--foreground)]">
								{row.label}
							</span>
							<span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--danger-soft)] text-[11px] font-bold text-[var(--danger-strong)]">
								{row.count}
							</span>
						</div>
					))
				) : (
					<EmptyPanelText>Chưa có cảnh báo ưu tiên.</EmptyPanelText>
				)}
			</div>
		</Panel>
	);
}

export function RiskFlagPanel({ analysis }: { analysis: AnalysisView }) {
	return (
		<Panel>
			<PanelHeader title="Cờ rủi ro từ LLM" />
			<div className="space-y-3 p-4">
				{analysis.riskFlags.length ? (
					analysis.riskFlags.map((flag) => (
						<div
							key={flag.label}
							className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3"
						>
							<div className="flex items-center justify-between gap-3">
								<p className="min-w-0 truncate text-[13px] font-bold text-[var(--foreground)]">
									{flag.label}
								</p>
								<RiskPill risk={flag.severity} />
							</div>
							<p className="mt-1 text-[11px] text-[var(--muted)]">
								{flag.count} bằng chứng liên quan
							</p>
						</div>
					))
				) : (
					<EmptyPanelText>Chưa có cờ rủi ro từ phân tích live.</EmptyPanelText>
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
		? (evidenceQuery.data?.pages.flatMap((page) => page.items) ?? evidence)
		: evidence;
	const visible = enableInfinite
		? loadedEvidence
		: limit
			? evidence.slice(0, limit)
			: evidence;

	return (
		<Panel className={className}>
			<PanelHeader title={`Bằng chứng (${loadedEvidence.length})`} />
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
							<Link
								href={`/evidence/${item.id}${scanId ? `?scanId=${scanId}` : ""}`}
								className="min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
							>
								<p className="break-words text-[13px] leading-6 text-[var(--foreground)]">
									"{item.quote}"
								</p>
								<p className="mt-1 truncate text-[11px] text-[var(--muted)]">
									{item.sourceLabel ?? "Nguồn công khai"} - {item.author ?? "Public"}
								</p>
							</Link>
							<RiskPill risk={item.riskLevel ?? "medium"} />
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
				) : (
					<EmptyPanelText>Chưa có bằng chứng. Tạo hoặc xử lý một scan live.</EmptyPanelText>
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
								? "Tải thêm bằng chứng"
								: "Đã tải hết bằng chứng"}
					</button>
				</div>
			) : null}
		</Panel>
	);
}

function TopicInsightRow({ topic }: { topic: TopicInsight }) {
	return (
		<Link
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
		</Link>
	);
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
