import { Newspaper } from "lucide-react";
import { Suspense } from "react";

import { ArticleEditor } from "@/components/dashboard/article-editor";
import { PageHeader } from "@/components/dashboard/page-header";
import { QueryProvider } from "@/components/providers/query-provider";

export const instant = true;
export const prefetch = "allow-runtime";

export default function ArticlePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	return (
		<div className="space-y-5">
			<PageHeader
				description="Biên tập theo bằng chứng, xem trước Zalo và xác nhận từng bước đồng bộ hoặc xuất bản."
				icon={Newspaper}
				title="Biên tập bài viết"
			/>
			<QueryProvider>
				<Suspense fallback={<div className="h-[70vh] animate-pulse rounded-lg bg-[var(--surface)]" />}>
					<ArticleRoute params={params} />
				</Suspense>
			</QueryProvider>
		</div>
	);
}

async function ArticleRoute({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	return <ArticleEditor articleId={id} />;
}
