import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";

import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { OperationsPage } from "@/components/dashboard/operations-page";
import { QueryProvider } from "@/components/providers/query-provider";
import { prefetchDashboardRouteData } from "@/lib/dashboard/server-prefetch";
import { getQueryClient } from "@/lib/query-client";

export const instant = true;

export default function OperationsRoute() {
	return (
		<Suspense
			fallback={
				<DashboardPageSkeleton
					description="Quan sát hàng đợi, worker, provider và từng bước xử lý trong thời gian gần thực."
					title="Vận hành hệ thống"
				/>
			}
		>
			<OperationsData />
		</Suspense>
	);
}

async function OperationsData() {
	const queryClient = getQueryClient();
	await prefetchDashboardRouteData(queryClient, "operations");
	return (
		<QueryProvider>
			<HydrationBoundary state={dehydrate(queryClient)}>
				<OperationsPage />
			</HydrationBoundary>
		</QueryProvider>
	);
}
