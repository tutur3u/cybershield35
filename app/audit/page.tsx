import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";

import { AuditPage as AuditContent } from "@/components/dashboard/audit-page";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { QueryProvider } from "@/components/providers/query-provider";
import { prefetchDashboardRouteData } from "@/lib/dashboard/server-prefetch";
import {
	intelligenceFiltersFromSearchParams,
	type DashboardSearchParams,
} from "@/lib/dashboard/query-keys";
import { getQueryClient } from "@/lib/query-client";

export const instant = true;
export const prefetch = "allow-runtime";

export default function AuditPage({
	searchParams,
}: {
	searchParams: DashboardSearchParams;
}) {
	return (
		<Suspense
			fallback={
				<DashboardPageSkeleton
					description="Theo dõi thao tác scan, provider, phân tích và trạng thái duyệt."
					title="Nhật ký hoạt động"
				/>
			}
		>
			<AuditData searchParams={searchParams} />
		</Suspense>
	);
}

async function AuditData({
	searchParams,
}: {
	searchParams: DashboardSearchParams;
}) {
	const queryClient = getQueryClient();
	const filters = intelligenceFiltersFromSearchParams(await searchParams);
	await prefetchDashboardRouteData(queryClient, "audit", { filters });

	return (
		<QueryProvider>
			<HydrationBoundary state={dehydrate(queryClient)}>
				<AuditContent />
			</HydrationBoundary>
		</QueryProvider>
	);
}
