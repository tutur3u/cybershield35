import { ShieldCheck } from "lucide-react";
import { cacheLife } from "next/cache";

import { PageHeader } from "@/components/dashboard/page-header";

export async function SettingsPage() {
	"use cache";
	cacheLife("max");

	return (
		<div className="space-y-5">
			<PageHeader
				icon={ShieldCheck}
				title="Cấu hình"
				description="Mở menu tài khoản để xem cấu hình máy chủ trong hộp thoại."
			/>
		</div>
	);
}
