import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import type { ZaloCatalogArticle } from "@/lib/zalo/article-catalog";

export type LocalArticleListItem = {
	article: {
		coverUrl: string | null;
		createdAt: string;
		description: string;
		id: string;
		originDraftId: string | null;
		publicationStatus: string;
		remoteArticleId: string | null;
		reviewStatus: string;
		scheduledAt: string | null;
		title: string;
		updatedAt: string;
	};
	oaDisplayName: string | null;
	oaId: string | null;
};

export type ArticleCatalogPage = {
	articles: LocalArticleListItem[];
	hasNextPage: boolean;
	nextCursor: string | null;
	zaloArticles: ZaloCatalogArticle[];
	zaloIssues: Array<{ message: string; oaDisplayName: string }>;
};

export type ArticleSettings = {
	autoSyncDrafts: boolean;
	defaultOa: { displayName: string; id: string } | null;
	defaultRemoteStatus: "hidden";
};

export const articleQueryKeys = {
	all: ["articles"] as const,
	catalog: (limit: number) => ["articles", "catalog", "infinite", limit] as const,
	detail: (articleId: string) => ["articles", "detail", articleId] as const,
	settings: () => ["articles", "settings"] as const,
};

export function articleCatalogInfiniteQueryOptions(limit = 10) {
	return infiniteQueryOptions({
		gcTime: 30 * 60_000,
		getNextPageParam: (lastPage: ArticleCatalogPage) =>
			lastPage.hasNextPage ? lastPage.nextCursor : undefined,
		initialPageParam: null as string | null,
		queryFn: ({ pageParam }: { pageParam: string | null }) => {
			const params = new URLSearchParams({ limit: String(limit) });
			if (pageParam) params.set("cursor", pageParam);
			return fetchArticleJson<ArticleCatalogPage>(
				`/api/articles?${params.toString()}`,
			);
		},
		queryKey: articleQueryKeys.catalog(limit),
		staleTime: 2 * 60_000,
	});
}

export function articleSettingsQueryOptions() {
	return queryOptions({
		gcTime: 30 * 60_000,
		queryFn: () =>
			fetchArticleJson<ArticleSettings>("/api/articles/settings"),
		queryKey: articleQueryKeys.settings(),
		staleTime: 5 * 60_000,
	});
}

export async function fetchArticleJson<T>(
	url: string,
	init?: RequestInit,
): Promise<T> {
	const response = await fetch(url, {
		cache: "no-store",
		credentials: "same-origin",
		...init,
	});
	const body = await response.json().catch(() => null);
	if (!response.ok) {
		throw new Error(body?.error ?? "Không thể tải dữ liệu.");
	}
	return body as T;
}
