import { Newspaper } from "lucide-react";
import { Suspense } from "react";

import { NewArticleRedirect } from "@/components/dashboard/new-article-redirect";
import { PageHeader } from "@/components/dashboard/page-header";
import { QueryProvider } from "@/components/providers/query-provider";

export const instant = true;

export default function NewArticlePage() {
	return (
		<div className="space-y-5">
			<PageHeader
				description="Khởi tạo bản nháp riêng để biên tập, lấy bằng chứng và xem trước trước khi kết nối Zalo."
				icon={Newspaper}
				title="Bài viết mới"
			/>
			<Suspense fallback={<div className="h-[55vh] animate-pulse rounded-lg bg-[var(--surface)]" />}>
				<QueryProvider>
					<NewArticleRedirect />
				</QueryProvider>
			</Suspense>
		</div>
	);
}
