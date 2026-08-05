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
	ActivityPill,
	Panel,
	PanelHeader,
} from "@/components/dashboard/ui-primitives";
import { intelligenceActivityInfiniteQueryOptions } from "@/lib/dashboard/client-queries";

export function IntelligenceActivityStream({
	compact = false,
	limit = 30,
}: {
	compact?: boolean;
	limit?: number;
}) {
	const [filters, setFilter] = useIntelligenceFiltersFromUrl();
	const activityQuery = useInfiniteQuery(
		intelligenceActivityInfiniteQueryOptions(filters, limit),
	);
	const events = activityQuery.data?.pages.flatMap((page) => page.items) ?? [];

	const panel = (
		<Panel className={compact ? "h-full" : ""}>
			<PanelHeader
				title="Hoạt động gần đây"
				description="Việc đã diễn ra trong hệ thống, liên kết thẳng tới lượt quét, nội dung và bài viết."
			/>
			<div className="divide-y divide-[var(--divider)]">
				{events.map((event) => (
					<ActivityRow key={event.id} compact={compact} event={event} />
				))}
				{!compact && activityQuery.hasNextPage ? (
					<LoadMoreRow
						isFetching={activityQuery.isFetchingNextPage}
						onClick={() => void activityQuery.fetchNextPage()}
					/>
				) : null}
				{!events.length && !activityQuery.isPending ? (
					<EmptyRow text="Chưa có hoạt động nào được ghi nhận." />
				) : null}
			</div>
		</Panel>
	);

	// The compact form sits beside other panels, where a second filter bar would
	// duplicate the one already controlling the page.
	if (compact) return panel;

	return (
		<div className="space-y-5">
			<IntelligenceFilterBar
				filters={filters}
				setFilter={setFilter}
				showProvider={false}
			/>
			{panel}
		</div>
	);
}

function ActivityRow({
	compact,
	event,
}: {
	compact: boolean;
	event: IntelligenceActivityRow;
}) {
	// Compact rows sit in a narrow column beside other panels, so the badge shares
	// the title line instead of being pushed onto a row of its own.
	if (compact) {
		return (
			<IntentPrefetchLink
				href={event.href}
				className="block min-w-0 px-4 py-3 transition hover:bg-[var(--surface-soft)]"
			>
				<div className="flex min-w-0 items-start justify-between gap-3">
					<p className="min-w-0 truncate text-[13px] font-bold text-[var(--foreground)]">
						{event.title}
					</p>
					<ActivityPill severity={event.severity} />
				</div>
				<p className="mt-1 truncate text-[11px] font-semibold text-[var(--muted)]">
					{formatIntelligenceDate(event.occurredAt)} · {event.description}
				</p>
			</IntentPrefetchLink>
		);
	}

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
			<ActivityPill severity={event.severity} />
		</IntentPrefetchLink>
	);
}
