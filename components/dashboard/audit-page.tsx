import { Clock3 } from "lucide-react";

import { IntelligenceActivityStream } from "@/components/dashboard/intelligence-activity-stream";
import { PageHeader } from "@/components/dashboard/page-header";

export function AuditPage() {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={Clock3}
				title="Nhật ký hoạt động"
				description="Tra cứu lịch sử thu thập, phân tích và phê duyệt. Chọn một hoạt động để xem nội dung liên quan."
			/>
			<IntelligenceActivityStream />
		</div>
	);
}
