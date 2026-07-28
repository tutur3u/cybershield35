import { FilePenLine } from "lucide-react";

import { DraftsWorkspace } from "@/components/dashboard/drafts-workspace";
import { PageHeader } from "@/components/dashboard/page-header";
import { QueryProvider } from "@/components/providers/query-provider";

export const instant = true;

export default function DraftsPage() {
	return (
		<div className="space-y-5">
			<PageHeader
				description="Hàng đợi duyệt cho bài ủng hộ, bài phản bác, phân tích trung lập và ghi chú nội bộ. Không nội dung nào được tự động xuất bản."
				icon={FilePenLine}
				title="Bản nháp"
			/>
			<QueryProvider>
				<DraftsWorkspace />
			</QueryProvider>
		</div>
	);
}
