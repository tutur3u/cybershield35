import { Suspense } from "react";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { UsagePage } from "@/components/dashboard/usage-page";
import { QueryProvider } from "@/components/providers/query-provider";

export const metadata = { title: "Mức sử dụng & chi phí" };
export default function UsageRoute() {
	return (
		<Suspense
			fallback={
				<DashboardPageSkeleton
					title="Mức sử dụng & chi phí"
					description="Theo dõi chi phí và đối soát dữ liệu."
				/>
			}
		>
			<QueryProvider>
				<UsagePage />
			</QueryProvider>
		</Suspense>
	);
}
