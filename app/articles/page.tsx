import { Newspaper } from "lucide-react";

import { ArticlesWorkspace } from "@/components/dashboard/articles-workspace";
import { PageHeader } from "@/components/dashboard/page-header";
import { QueryProvider } from "@/components/providers/query-provider";

export const instant = true;

export default function ArticlesPage() {
	return (
		<div className="space-y-5">
			<PageHeader
				description="Bài viết tiếng Việt được biên tập, duyệt và đồng bộ an toàn trước khi xuất bản lên Zalo OA."
				icon={Newspaper}
				title="Bài viết"
			/>
			<QueryProvider>
				<ArticlesWorkspace />
			</QueryProvider>
		</div>
	);
}
