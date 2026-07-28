import { ShieldCheck } from "lucide-react";
import { Suspense } from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { ZaloSettingsPanel } from "@/components/dashboard/zalo-settings-panel";
import { QueryProvider } from "@/components/providers/query-provider";

export async function SettingsPage() {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={ShieldCheck}
				title="Cấu hình"
				description="Quản lý kết nối xuất bản và các tích hợp máy chủ mà không đưa bí mật xuống trình duyệt."
			/>
			<QueryProvider>
				<Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-[var(--surface)]" />}>
					<ZaloSettingsPanel />
				</Suspense>
			</QueryProvider>
		</div>
	);
}
