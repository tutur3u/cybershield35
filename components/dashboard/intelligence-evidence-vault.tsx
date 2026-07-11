"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Database } from "lucide-react";
import { useRef } from "react";

import { IntelligenceEvidenceRowView } from "@/components/dashboard/intelligence-evidence-row";
import {
	EmptyRow,
	IntelligenceFilterBar,
	LoadMoreRow,
	useIntelligenceFiltersFromUrl,
} from "@/components/dashboard/intelligence-workspace-shared";
import {
	DashboardTooltip,
	Panel,
	PanelHeader,
} from "@/components/dashboard/ui-primitives";
import { intelligenceEvidenceInfiniteQueryOptions } from "@/lib/dashboard/client-queries";

export function IntelligenceEvidenceVault() {
	const [filters, setFilter] = useIntelligenceFiltersFromUrl();
	const evidenceQuery = useInfiniteQuery(
		intelligenceEvidenceInfiniteQueryOptions(filters, 40),
	);
	const evidence = evidenceQuery.data?.pages.flatMap((page) => page.items) ?? [];
	const parentRef = useRef<HTMLDivElement | null>(null);
	// eslint-disable-next-line react-hooks/incompatible-library
	const rowVirtualizer = useVirtualizer({
		count: evidence.length,
		estimateSize: () => 118,
		getScrollElement: () => parentRef.current,
		overscan: 8,
	});

	return (
		<div className="space-y-5">
			<IntelligenceFilterBar filters={filters} setFilter={setFilter} />
			<Panel>
				<PanelHeader
					title="Kho bằng chứng intelligence"
					description="Danh sách lớn được tải vô hạn và ảo hóa để giữ thao tác nhanh khi dữ liệu tăng."
					action={
					<DashboardTooltip content="Bằng chứng được lấy từ bảng đã chuẩn hóa, không hiển thị raw provider payload hoặc khóa bí mật.">
						<span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-bold text-[var(--muted-strong)]">
							<Database size={13} /> Có dữ liệu gốc
						</span>
					</DashboardTooltip>
				}
				/>
				<div ref={parentRef} className="max-h-[720px] overflow-auto">
					<div
						className="relative min-w-0"
						style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
					>
						{rowVirtualizer.getVirtualItems().map((virtualRow) => {
							const item = evidence[virtualRow.index];
							if (!item) return null;
							return (
								<div
									data-index={virtualRow.index}
									key={item.id}
									ref={rowVirtualizer.measureElement}
									className="absolute left-0 top-0 w-full"
									style={{
										transform: `translateY(${virtualRow.start}px)`,
									}}
								>
									<IntelligenceEvidenceRowView evidence={item} />
								</div>
							);
						})}
					</div>
				</div>
				{evidenceQuery.hasNextPage ? (
					<LoadMoreRow
						isFetching={evidenceQuery.isFetchingNextPage}
						onClick={() => void evidenceQuery.fetchNextPage()}
					/>
				) : null}
				{!evidence.length && !evidenceQuery.isPending ? (
					<EmptyRow text="Không có bằng chứng phù hợp bộ lọc hiện tại." />
				) : null}
			</Panel>
		</div>
	);
}
