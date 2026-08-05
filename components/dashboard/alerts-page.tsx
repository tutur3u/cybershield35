import { AlertTriangle } from "lucide-react";

import { IntelligenceClaimsWorkspace } from "@/components/dashboard/intelligence-widgets";
import { PageHeader } from "@/components/dashboard/page-header";

export function AlertsPage() {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={AlertTriangle}
				title="Cảnh báo & Rủi ro"
				description="Đồ thị claim, bằng chứng hỗ trợ và luồng xử lý rủi ro."
			/>
			<IntelligenceClaimsWorkspace standalone />
		</div>
	);
}
