import { IntentPrefetchLink } from "@/components/dashboard/intent-prefetch-link";
import type { IntelligenceTopicRow } from "@/components/dashboard/types";
import {
	DashboardTooltip,
	RiskPill,
} from "@/components/dashboard/ui-primitives";

export function IntelligenceTopicRowView({
	compact = false,
	topic,
}: {
	compact?: boolean;
	topic: IntelligenceTopicRow;
}) {
	return (
		<IntentPrefetchLink
			href={topic.href}
			className={`grid min-w-0 gap-3 px-4 py-3 transition hover:bg-[var(--surface-soft)] ${
				compact
					? "sm:grid-cols-[minmax(0,1fr)_90px_80px]"
					: "sm:grid-cols-[minmax(0,1fr)_110px_110px_80px]"
			} sm:items-center`}
		>
			<div className="min-w-0">
				<p className="truncate text-[13px] font-bold text-[var(--foreground)]">
					{topic.name}
				</p>
				<p className="mt-1 truncate text-[11px] font-semibold text-[var(--muted)]">
					{topic.evidenceCount} bằng chứng - {topic.claimCount} claim - {topic.scanCount} scan
				</p>
			</div>
			<DashboardTooltip content="Động lượng kết hợp khối lượng bằng chứng, độ phủ scan và bằng chứng rủi ro cao.">
				<span className="min-w-0 rounded-md bg-[var(--surface-soft)] px-2 py-1 text-center text-[11px] font-bold text-[var(--foreground)]">
					{topic.momentumScore}/100
				</span>
			</DashboardTooltip>
			{compact ? null : (
				<span className="min-w-0 truncate text-[11px] font-bold text-[var(--muted-strong)]">
					{topic.trend}
				</span>
			)}
			<RiskPill risk={topic.riskLevel} />
		</IntentPrefetchLink>
	);
}
