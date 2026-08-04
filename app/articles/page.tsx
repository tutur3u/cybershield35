import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Newspaper } from "lucide-react";
import { io } from "next/cache";
import { Suspense } from "react";

import { ArticlesWorkspace } from "@/components/dashboard/articles-workspace";
import { PageHeader } from "@/components/dashboard/page-header";
import { QueryProvider } from "@/components/providers/query-provider";
import { articleQueryKeys, type ArticleCatalogPage } from "@/lib/articles/client-queries";
import { getCachedArticlesPage } from "@/lib/articles/store";
import { getQueryClient } from "@/lib/query-client";

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
				<Suspense fallback={<ArticlesWorkspaceSkeleton />}>
					<HydratedArticlesWorkspace />
				</Suspense>
			</QueryProvider>
		</div>
	);
}

async function HydratedArticlesWorkspace() {
	await io();
	const queryClient = getQueryClient();
	const local = await getCachedArticlesPage({ limit: 10 });
	const initialPage: ArticleCatalogPage = {
		articles: local.items.map(({ article, oaDisplayName, oaId }) => ({
			article: {
				coverUrl: article.coverUrl,
				createdAt: article.createdAt.toISOString(),
				description: article.description,
				id: article.id,
				originDraftId: article.originDraftId,
				publicationStatus: article.publicationStatus,
				state: article.state,
				remoteArticleId: article.remoteArticleId,
				reviewStatus: article.reviewStatus,
				scheduledAt: article.scheduledAt?.toISOString() ?? null,
				title: article.title,
				updatedAt: article.updatedAt.toISOString(),
			},
			oaDisplayName,
			oaId,
		})),
		hasNextPage: local.hasNextPage,
		nextCursor: local.nextCursor,
		zaloArticles: [],
		zaloIssues: [],
	};
	queryClient.setQueryData(articleQueryKeys.catalog("local", 10), {
		pageParams: [null],
		pages: [initialPage],
	});
	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<ArticlesWorkspace />
		</HydrationBoundary>
	);
}

function ArticlesWorkspaceSkeleton() {
	return (
		<div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
			<div className="h-9 animate-pulse rounded-md bg-[var(--surface-soft)]" />
			{Array.from({ length: 5 }).map((_, index) => (
				<div
					key={index}
					className="h-[92px] animate-pulse rounded-lg bg-[var(--surface-soft)]"
				/>
			))}
		</div>
	);
}
