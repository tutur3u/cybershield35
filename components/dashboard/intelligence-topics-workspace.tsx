"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { IntelligenceTopicRowView } from "@/components/dashboard/intelligence-topic-row";
import {
	EmptyRow,
	IntelligenceFilterBar,
	LoadMoreRow,
	useIntelligenceFiltersFromUrl,
} from "@/components/dashboard/intelligence-workspace-shared";
import { Panel, PanelHeader } from "@/components/dashboard/ui-primitives";
import { intelligenceTopicsInfiniteQueryOptions } from "@/lib/dashboard/client-queries";

export function IntelligenceTopicsWorkspace() {
	const [filters, setFilter] = useIntelligenceFiltersFromUrl();
	const topicsQuery = useInfiniteQuery(
		intelligenceTopicsInfiniteQueryOptions(filters, 24),
	);
	const topics = topicsQuery.data?.pages.flatMap((page) => page.items) ?? [];

	return (
		<div className="space-y-5">
			<IntelligenceFilterBar
				filters={filters}
				setFilter={setFilter}
				showStatus={false}
			/>
			<Panel>
				<PanelHeader
					title="Chủ đề intelligence"
					description="Mỗi chủ đề là một đối tượng vận hành: xu hướng, rủi ro, bằng chứng, claim và tác động báo cáo."
				/>
				<div className="divide-y divide-[var(--divider)]">
					{topics.map((topic) => (
						<IntelligenceTopicRowView key={topic.id} topic={topic} />
					))}
					{topicsQuery.hasNextPage ? (
						<LoadMoreRow
							isFetching={topicsQuery.isFetchingNextPage}
							onClick={() => void topicsQuery.fetchNextPage()}
						/>
					) : null}
					{!topics.length && !topicsQuery.isPending ? (
						<EmptyRow text="Chưa có chủ đề intelligence phù hợp bộ lọc." />
					) : null}
				</div>
			</Panel>
		</div>
	);
}
