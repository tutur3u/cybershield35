import { ArrowRight } from "lucide-react";

import { IntentPrefetchLink } from "@/components/dashboard/intent-prefetch-link";
import {
	formatIntelligenceDate,
	intelligenceProviderLabel,
} from "@/components/dashboard/intelligence-workspace-shared";
import type { IntelligenceEvidenceRow } from "@/components/dashboard/types";
import { RiskPill } from "@/components/dashboard/ui-primitives";

export function IntelligenceEvidenceRowView({
	compact = false,
	evidence,
}: {
	compact?: boolean;
	evidence: IntelligenceEvidenceRow;
}) {
	return (
		<div
			className={`grid min-w-0 gap-3 px-4 py-3 ${
				compact ? "" : "sm:grid-cols-[minmax(0,1fr)_120px_90px]"
			} sm:items-center`}
		>
			<div className="min-w-0">
				<IntentPrefetchLink
					href={evidence.href}
					className="line-clamp-2 text-[13px] font-bold leading-5 text-[var(--foreground)] hover:text-[var(--accent-strong)]"
				>
					{evidence.quote}
				</IntentPrefetchLink>
				<p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[var(--muted)]">
					{evidence.summary}
				</p>
				<p className="mt-2 truncate text-[11px] font-semibold text-[var(--muted)]">
					{evidence.facebookUsername
						? `Fanpage @${evidence.facebookUsername}`
						: evidence.sourceLabel ??
							intelligenceProviderLabel(evidence.provider)}
					{evidence.facebookPageId
						? ` - Facebook ID ${evidence.facebookPageId}`
						: ""}
				</p>
				<div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
					{evidence.topicSlugs.slice(0, 3).map((slug) => (
						<IntentPrefetchLink
							key={slug}
							href={`/topics/${slug}`}
							className="max-w-full truncate rounded-md bg-[var(--accent-soft)] px-2 py-1 text-[11px] font-bold text-[var(--accent-strong)]"
						>
							{slug}
						</IntentPrefetchLink>
					))}
					<IntentPrefetchLink
						href={evidence.scanHref}
						className="max-w-full truncate rounded-md bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-bold text-[var(--accent-strong)]"
					>
						Mở lượt quét
					</IntentPrefetchLink>
					{evidence.originalPostHref ? (
						<a
							href={evidence.originalPostHref}
							target="_blank"
							rel="noreferrer"
							className="max-w-full truncate rounded-md bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-bold text-[var(--accent-strong)]"
						>
							Bài gốc
						</a>
					) : null}
				</div>
			</div>
			{compact ? null : (
				<div className="min-w-0 text-[11px] font-semibold text-[var(--muted)]">
					<p className="truncate">
						{evidence.sourceLabel ??
							intelligenceProviderLabel(evidence.provider)}
					</p>
					<p className="mt-1 truncate">
						{formatIntelligenceDate(evidence.createdAt)}
					</p>
					<IntentPrefetchLink
						href={evidence.scanHref}
						className="mt-1 inline-flex text-[var(--accent-strong)]"
					>
						Chi tiết lượt quét <ArrowRight size={12} />
					</IntentPrefetchLink>
				</div>
			)}
			<RiskPill risk={evidence.riskLevel} />
		</div>
	);
}
