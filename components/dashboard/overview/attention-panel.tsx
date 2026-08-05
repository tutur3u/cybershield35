"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";

import { IntentPrefetchLink } from "@/components/dashboard/intent-prefetch-link";
import type { IntelligenceFilters } from "@/components/dashboard/types";
import {
	Panel,
	PanelHeader,
	RiskPill,
} from "@/components/dashboard/ui-primitives";
import { intelligenceOverviewQueryOptions } from "@/lib/dashboard/client-queries";

/**
 * The single "what should I do next" queue. Each row is an exception with a
 * destination, ordered by severity.
 */
export function AttentionPanel({ filters }: { filters: IntelligenceFilters }) {
	const overviewQuery = useQuery(intelligenceOverviewQueryOptions(filters));
	const actions = overviewQuery.data?.actions ?? [];

	return (
		<Panel className="h-full">
			<PanelHeader
				title="Việc cần xử lý"
				description="Những mục có ảnh hưởng lớn hoặc đang bị chặn, xếp theo mức ưu tiên."
			/>
			<div className="divide-y divide-[var(--divider)]">
				{actions.map((action) => (
					<IntentPrefetchLink
						key={action.id}
						href={action.href}
						className="grid min-w-0 gap-2 px-4 py-3 transition hover:bg-[var(--surface-soft)]"
					>
						<div className="flex min-w-0 items-start justify-between gap-3">
							<p className="min-w-0 text-[13px] font-bold text-[var(--foreground)]">
								{action.label}
							</p>
							<RiskPill risk={action.severity} />
						</div>
						<p className="line-clamp-2 text-[12px] leading-5 text-[var(--muted)]">
							{action.body}
						</p>
					</IntentPrefetchLink>
				))}
				{!actions.length ? (
					<div className="flex items-center gap-2 px-4 py-6 text-[12px] font-semibold text-[var(--muted)]">
						{overviewQuery.isPending ? (
							"Đang kiểm tra…"
						) : (
							<>
								<CheckCircle2 size={15} className="text-[var(--success-strong)]" />
								Không có việc khẩn cấp.
							</>
						)}
					</div>
				) : null}
			</div>
		</Panel>
	);
}
