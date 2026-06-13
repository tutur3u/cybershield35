import { alertRows, sentimentSlices, stanceRows } from "./dashboard-data";
import type { EvidenceView, TopicCluster } from "./types";
import { Panel, PanelHeader, ProgressBar, RiskPill } from "./ui-primitives";
import { demoAnalysis } from "@/lib/domain/fixtures";

export function SentimentAndStance() {
	return (
		<Panel>
			<PanelHeader title="Cảm xúc & lập trường" />
			<div className="grid gap-5 p-4 sm:grid-cols-[170px_minmax(0,1fr)]">
				<div
					className="mx-auto size-32 rounded-full"
					style={{
						background:
							"conic-gradient(#38a169 0 18%, #94a3b8 18% 50%, #ef4444 50% 100%)",
					}}
				>
					<div className="m-6 grid size-20 place-items-center rounded-full bg-white text-[13px] font-bold text-slate-600">
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

export function TopicPanel({ topics }: { topics: TopicCluster[] }) {
	return (
		<Panel>
			<PanelHeader title="Cụm chủ đề nổi bật" />
			<div className="divide-y divide-slate-100 p-4">
				{topics.map((topic) => (
					<div
						key={topic.name}
						className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_96px_84px_96px] sm:items-center"
					>
						<span className="truncate text-[13px] font-bold text-slate-800">
							{topic.name}
						</span>
						<span className="text-[12px] text-slate-500">
							{topic.count.toLocaleString("vi-VN")} mẫu
						</span>
						<span className="text-[12px] font-semibold text-slate-600">
							{topic.trend}
						</span>
						<RiskPill risk={topic.riskLevel} />
					</div>
				))}
			</div>
		</Panel>
	);
}

export function AlertPanel() {
	return (
		<Panel>
			<PanelHeader title="Cảnh báo ưu tiên" />
			<div className="space-y-3 p-4">
				{alertRows.map((row) => (
					<div
						key={row.label}
						className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3"
					>
						<span className="truncate text-[13px] font-bold text-slate-800">
							{row.label}
						</span>
						<span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700">
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
						className="rounded-lg border border-[var(--border)] bg-white p-3"
					>
						<div className="flex items-center justify-between gap-3">
							<p className="text-[13px] font-bold text-slate-800">{flag.label}</p>
							<RiskPill risk={flag.severity} />
						</div>
						<p className="mt-1 text-[11px] text-slate-500">
							{flag.count} bằng chứng liên quan
						</p>
					</div>
				))}
			</div>
		</Panel>
	);
}

export function EvidencePanel({ evidence, limit }: { evidence: EvidenceView; limit?: number }) {
	const visible = limit ? evidence.slice(0, limit) : evidence;

	return (
		<Panel>
			<PanelHeader title={`Bằng chứng (${evidence.length})`} />
			<div className="divide-y divide-slate-100 p-4">
				{visible.map((item, index) => (
					<div
						key={item.id}
						className="grid gap-3 py-3 sm:grid-cols-[32px_minmax(0,1fr)_120px]"
					>
						<span className="text-[12px] font-semibold text-slate-500">
							{index + 1}.
						</span>
						<div className="min-w-0">
							<p className="text-[13px] leading-6 text-slate-800">
								"{item.quote}"
							</p>
							<p className="mt-1 truncate text-[11px] text-slate-500">
								{item.sourceLabel ?? "Nguồn công khai"} - {item.author ?? "Public"}
							</p>
						</div>
						<RiskPill risk={item.riskLevel ?? "medium"} />
					</div>
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
			<span className="flex items-center gap-2 text-slate-600">
				{color ? (
					<span className="size-2 rounded-sm" style={{ backgroundColor: color }} />
				) : null}
				{label}
			</span>
			<ProgressBar value={value} />
			<span className="text-right font-bold text-slate-800">{value}%</span>
		</div>
	);
}
