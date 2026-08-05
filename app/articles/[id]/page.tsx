import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";

import { ArticleEditor } from "@/components/dashboard/article-editor";
import { ArticleEditorSkeleton } from "@/components/dashboard/article-editor/skeleton";
import { QueryProvider } from "@/components/providers/query-provider";
import { articleQueryKeys } from "@/lib/articles/client-queries";
import { getArticleDetail } from "@/lib/articles/store";
import { getQueryClient } from "@/lib/query-client";

export const instant = true;
export const prefetch = "allow-runtime";

export default function ArticlePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	return (
		<Suspense fallback={<ArticleEditorSkeleton />}>
			<ArticleRoute params={params} />
		</Suspense>
	);
}

/**
 * The editor used to mount empty and then fetch its own article, which showed a
 * spinner for a full round trip. Loading the detail on the server and hydrating
 * the cache lets the first paint carry real content.
 */
async function ArticleRoute({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const queryClient = getQueryClient();
	const detail = await getArticleDetail(id).catch(() => null);
	if (detail) {
		queryClient.setQueryData(
			articleQueryKeys.detail(id),
			JSON.parse(JSON.stringify(detail)),
		);
	}

	return (
		<QueryProvider>
			<HydrationBoundary state={dehydrate(queryClient)}>
				<ArticleEditor articleId={id} />
			</HydrationBoundary>
		</QueryProvider>
	);
}
