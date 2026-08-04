"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { IntentPrefetchLink } from "@/components/dashboard/intent-prefetch-link";
import {
	EmptyRow,
	formatIntelligenceDate,
	IntelligenceFilterBar,
	LoadMoreRow,
	useIntelligenceFiltersFromUrl,
} from "@/components/dashboard/intelligence-workspace-shared";
import type { IntelligenceActivityRow } from "@/components/dashboard/types";
import {
	Panel,
	PanelHeader,
	RiskPill,
} from "@/components/dashboard/ui-primitives";
import { intelligenceActivityInfiniteQueryOptions } from "@/lib/dashboard/client-queries";

export function IntelligenceActivityStream() {
	const [filters, setFilter] = useIntelligenceFiltersFromUrl();
	const activityQuery = useInfiniteQuery(
		intelligenceActivityInfiniteQueryOptions(filters, 30),
	);
	const events = activityQuery.data?.pages.flatMap((page) => page.items) ?? [];

	return (
		<div className="space-y-5">
			<IntelligenceFilterBar
				filters={filters}
				setFilter={setFilter}
				showProvider={false}
			/>
			<Panel>
				<PanelHeader
					title="Hoạt động gần đây"
					description="Các hoạt động gần đây được liên kết với lượt quét, bằng chứng và bài viết liên quan."
				/>
				<div className="divide-y divide-[var(--divider)]">
					{events.map((event) => (
						<ActivityRow key={event.id} event={event} />
					))}
					{activityQuery.hasNextPage ? (
						<LoadMoreRow
							isFetching={activityQuery.isFetchingNextPage}
							onClick={() => void activityQuery.fetchNextPage()}
						/>
					) : null}
					{!events.length && !activityQuery.isPending ? (
						<EmptyRow text="Chưa có hoạt động phù hợp bộ lọc." />
					) : null}
				</div>
			</Panel>
		</div>
	);
}

function ActivityRow({ event }: { event: IntelligenceActivityRow }) {
	return (
		<IntentPrefetchLink
			href={event.href}
			className="grid min-w-0 gap-3 px-4 py-3 transition hover:bg-[var(--surface-soft)] sm:grid-cols-[160px_minmax(0,1fr)_90px] sm:items-center"
		>
			<p className="truncate text-[11px] font-semibold text-[var(--muted)]">
				{formatIntelligenceDate(event.occurredAt)}
			</p>
			<div className="min-w-0">
				<p className="truncate text-[13px] font-bold text-[var(--foreground)]">
					{event.title}
				</p>
				<p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[var(--muted)]">
					{event.description}
				</p>
			</div>
			<RiskPill risk={event.severity} />
		</IntentPrefetchLink>
	);
}
