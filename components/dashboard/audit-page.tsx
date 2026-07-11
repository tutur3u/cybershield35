import { Clock3 } from "lucide-react";

import { IntelligenceActivityStream } from "@/components/dashboard/intelligence-activity-stream";
import { PageHeader } from "@/components/dashboard/page-header";

export function AuditPage() {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={Clock3}
				title="Nhật ký hoạt động"
				description="Theo dõi thao tác scan, provider, phân tích và trạng thái duyệt."
			/>
			<IntelligenceActivityStream />
		</div>
	);
}
