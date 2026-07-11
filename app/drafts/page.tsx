import { FilePenLine } from "lucide-react";

import { DraftsWorkspace } from "@/components/dashboard/drafts-workspace";
import { PageHeader } from "@/components/dashboard/page-header";
import { QueryProvider } from "@/components/providers/query-provider";

export const instant = true;

export default function DraftsPage() {
	return (
		<div className="space-y-5">
			<PageHeader
				description="Một hàng đợi duyệt chung cho phản hồi, bình luận, phản biện và tóm tắt nội bộ. Không nội dung nào được tự động xuất bản."
				icon={FilePenLine}
				title="Bản nháp"
			/>
			<QueryProvider>
				<DraftsWorkspace />
			</QueryProvider>
		</div>
	);
}
