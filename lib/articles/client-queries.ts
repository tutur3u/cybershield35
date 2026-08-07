import {
	infiniteQueryOptions,
	type InfiniteData,
	queryOptions,
} from "@tanstack/react-query";

import type { ZaloCatalogArticle } from "@/lib/zalo/article-catalog";

export type LocalArticleListItem = {
	article: {
		coverUrl: string | null;
		createdAt: string;
		description: string;
		id: string;
		/** Why the last Zalo attempt failed, so the list can say what went wrong. */
		lastError: string | null;
		originDraftId: string | null;
		publicationStatus: string;
		state: string;
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
	catalog: (scope: "local" | "zalo", limit: number, filters: ArticleListFilters = {}) =>
		["articles", "catalog", scope, "infinite", limit, filters] as const,
	detail: (articleId: string) => ["articles", "detail", articleId] as const,
	settings: () => ["articles", "settings"] as const,
};

export type ArticleListFilters = {
	q?: string;
	review?: string;
	sort?: "created_asc" | "created_desc" | "title" | "updated_asc" | "updated_desc";
	state?: string;
};

export type EvidenceArticleCreation = {
	article: { id: string };
	href: string;
	mode: "ai" | "scaffold";
};

export function createArticleFromEvidence(evidenceId: string) {
	return fetchArticleJson<EvidenceArticleCreation>(
		`/api/evidence/${encodeURIComponent(evidenceId)}/article`,
		{
			body: JSON.stringify({}),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		},
	);
}

export function articleCatalogInfiniteQueryOptions(
	scope: "local" | "zalo",
	limit = 10,
	filters: ArticleListFilters = {},
) {
	return infiniteQueryOptions({
		gcTime: 60 * 60_000,
		getNextPageParam: (lastPage: ArticleCatalogPage) =>
			lastPage.hasNextPage ? lastPage.nextCursor : undefined,
		initialPageParam: null as string | null,
		queryFn: ({ pageParam }: { pageParam: string | null }) => {
			const params = new URLSearchParams({
				limit: String(limit),
				scope,
			});
			if (pageParam) params.set("cursor", pageParam);
			if (filters.q) params.set("q", filters.q);
			if (filters.review && filters.review !== "all") params.set("review", filters.review);
			if (filters.state && filters.state !== "all") params.set("state", filters.state);
			if (filters.sort) params.set("sort", filters.sort);
			return fetchArticleJson<ArticleCatalogPage>(
				`/api/articles?${params.toString()}`,
			);
		},
		queryKey: articleQueryKeys.catalog(scope, limit, filters),
		staleTime: scope === "zalo" ? 15 * 60_000 : 5 * 60_000,
	});
}

export function articleSettingsQueryOptions() {
	return queryOptions({
		gcTime: 30 * 60_000,
		queryFn: () =>
			fetchArticleJson<ArticleSettings>("/api/articles/settings"),
		queryKey: articleQueryKeys.settings(),
		staleTime: 15 * 60_000,
	});
}

export function removeDeletedArticlesFromCatalog(
	data: InfiniteData<ArticleCatalogPage, string | null> | undefined,
	deleted: { articleIds: ReadonlySet<string>; remoteArticleIds: ReadonlySet<string> },
) {
	if (!data) return data;
	return {
		...data,
		pages: data.pages.map((page) => ({
			...page,
			articles: page.articles.filter(
				({ article }) => !deleted.articleIds.has(article.id),
			),
			zaloArticles: page.zaloArticles.filter(
				(article) => !deleted.remoteArticleIds.has(article.remoteArticleId),
			),
		})),
	};
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
