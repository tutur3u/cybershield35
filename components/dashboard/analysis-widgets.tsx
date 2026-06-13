import Link from "next/link";

import { alertRows, sentimentSlices, stanceRows } from "./dashboard-data";
import type { EvidenceView, TopicCluster } from "./types";
import { Panel, PanelHeader, ProgressBar, RiskPill } from "./ui-primitives";
import { demoAnalysis } from "@/lib/domain/fixtures";

export function SentimentAndStance({ className = "" }: { className?: string }) {
	return (
		<Panel className={className}>
			<PanelHeader title="Cảm xúc & lập trường" />
			<div className="grid items-center gap-5 p-4 sm:grid-cols-[170px_minmax(0,1fr)]">
				<div
					className="mx-auto size-32 rounded-full"
					style={{
						background:
							"conic-gradient(#38a169 0 18%, #94a3b8 18% 50%, #ef4444 50% 100%)",
					}}
				>
					<div className="m-6 grid size-20 place-items-center rounded-full bg-[var(--surface)] text-[13px] font-bold text-[var(--muted-strong)] shadow-[inset_0_0_0_1px_var(--border)]">
						1.248
					</div>
				</div>
				<div className="space-y-4">
					{sentimentSlices.map((slice) => (
						<ProgressRow
							key={slice.label}
							label={slice.label}
							value={slice.value}
							color={slice.color}
						/>
					))}
					{stanceRows.map((row) => (
						<ProgressRow key={row.label} label={row.label} value={row.value} />
					))}
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
				{topics.map((topic) => (
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
				))}
			</div>
		</Panel>
	);
}

export function AlertPanel({ className = "" }: { className?: string }) {
	return (
		<Panel className={`flex flex-col ${className}`}>
			<PanelHeader title="Cảnh báo ưu tiên" />
			<div
				className="grid flex-1 gap-3 p-4"
				style={{
					gridTemplateRows: `repeat(${alertRows.length}, minmax(48px, 1fr))`,
				}}
			>
				{alertRows.map((row) => (
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
				))}
			</div>
		</Panel>
	);
}

export function RiskFlagPanel({ analysis }: { analysis: typeof demoAnalysis }) {
	return (
		<Panel>
			<PanelHeader title="Cờ rủi ro từ LLM" />
			<div className="space-y-3 p-4">
				{analysis.riskFlags.map((flag) => (
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
				))}
			</div>
		</Panel>
	);
}

export function EvidencePanel({
	className = "",
	evidence,
	limit,
	scanId,
}: {
	className?: string;
	evidence: EvidenceView;
	limit?: number;
	scanId?: string;
}) {
	const visible = limit ? evidence.slice(0, limit) : evidence;

	return (
		<Panel className={className}>
			<PanelHeader title={`Bằng chứng (${evidence.length})`} />
			<div className="divide-y divide-[var(--divider)] p-4">
				{visible.map((item, index) => (
					<Link
						key={item.id}
						href={`/evidence/${item.id}${scanId ? `?scanId=${scanId}` : ""}`}
						className="grid min-h-16 gap-3 py-3 transition hover:bg-[var(--surface-soft)] sm:grid-cols-[32px_minmax(0,1fr)_auto] sm:items-center"
					>
						<span className="text-[12px] font-semibold text-[var(--muted)]">
							{index + 1}.
						</span>
						<div className="min-w-0">
							<p className="break-words text-[13px] leading-6 text-[var(--foreground)]">
								"{item.quote}"
							</p>
							<p className="mt-1 truncate text-[11px] text-[var(--muted)]">
								{item.sourceLabel ?? "Nguồn công khai"} - {item.author ?? "Public"}
							</p>
						</div>
						<RiskPill risk={item.riskLevel ?? "medium"} />
					</Link>
				))}
			</div>
		</Panel>
	);
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
