import { Edit3, Trash2 } from "lucide-react";
import Link from "next/link";

import type { AnalysisView, EvidenceView, RiskFlagView, TopicCluster } from "./types";
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
	topics,
}: {
	className?: string;
	topics: TopicCluster[];
}) {
	return (
		<Panel className={`flex flex-col ${className}`}>
			<PanelHeader title="Cụm chủ đề nổi bật" />
			<div
				className="grid flex-1 divide-y divide-[var(--divider)] p-4"
				style={{
					gridTemplateRows: topics.length
						? `repeat(${topics.length}, minmax(58px, 1fr))`
						: undefined,
				}}
			>
				{topics.length ? (
					topics.map((topic) => (
						<div
							key={topic.name}
							className="grid min-h-14 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_96px_84px_auto] sm:items-center"
						>
							<span className="min-w-0 truncate text-[13px] font-bold text-[var(--foreground)]">
								{topic.name}
							</span>
							<span className="text-[12px] text-[var(--muted)]">
								{topic.count.toLocaleString("vi-VN")} mẫu
							</span>
							<span className="text-[12px] font-semibold text-[var(--muted-strong)]">
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
	evidence,
	limit,
	onDeleteEvidence,
	onEditEvidence,
	scanId,
}: {
	className?: string;
	evidence: EvidenceView;
	limit?: number;
	onDeleteEvidence?: (evidence: EvidenceView[number]) => Promise<void>;
	onEditEvidence?: (evidence: EvidenceView[number]) => void;
	scanId?: string;
}) {
	const visible = limit ? evidence.slice(0, limit) : evidence;

	return (
		<Panel className={className}>
			<PanelHeader title={`Bằng chứng (${evidence.length})`} />
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
		</Panel>
	);
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
