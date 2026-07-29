import "server-only";

import { publicErrorMessage } from "@/lib/http/public-error";
import { listZaloArticles, isZaloEnabled } from "@/lib/zalo/client";
import {
	getValidZaloAccessToken,
	listSafeZaloConnections,
} from "@/lib/zalo/connections";

import {
	normalizeZaloArticleList,
	type ZaloCatalogArticle,
	zaloArticleListTotal,
} from "./article-catalog";

export type ZaloArticleCatalog = {
	articles: ZaloCatalogArticle[];
	issues: Array<{ oaDisplayName: string; message: string }>;
};

const ZALO_ARTICLE_PAGE_SIZE = 10;
const ZALO_ARTICLE_MAX_PAGES = 10;

async function listAccountArticles(
	account: Awaited<ReturnType<typeof listSafeZaloConnections>>[number],
	accessToken: string,
) {
	const articles = new Map<string, ZaloCatalogArticle>();
	for (let page = 0; page < ZALO_ARTICLE_MAX_PAGES; page += 1) {
		const payload = await listZaloArticles(accessToken, {
			limit: ZALO_ARTICLE_PAGE_SIZE,
			offset: page * ZALO_ARTICLE_PAGE_SIZE,
		});
		const pageArticles = normalizeZaloArticleList(payload, {
			connectionId: account.id,
			displayName: account.displayName,
			oaId: account.oaId,
		});
		for (const article of pageArticles) {
			articles.set(article.remoteArticleId, article);
		}

		const total = zaloArticleListTotal(payload);
		if (
			pageArticles.length < ZALO_ARTICLE_PAGE_SIZE ||
			(total !== null && articles.size >= total)
		) {
			break;
		}
	}
	return [...articles.values()];
}

export async function listZaloArticleCatalog(): Promise<ZaloArticleCatalog> {
	if (!isZaloEnabled()) return { articles: [], issues: [] };

	const accounts = (await listSafeZaloConnections()).filter(
		(account) => account.status === "connected",
	);
	const results = await Promise.allSettled(
		accounts.map(async (account) => {
			const accessToken = await getValidZaloAccessToken(account.id);
			return listAccountArticles(account, accessToken);
		}),
	);

	const articles: ZaloCatalogArticle[] = [];
	const issues: ZaloArticleCatalog["issues"] = [];
	for (const [index, result] of results.entries()) {
		const account = accounts[index];
		if (!account) continue;
		if (result.status === "fulfilled") {
			articles.push(...result.value);
			continue;
		}
		issues.push({
			message: publicErrorMessage(
				result.reason,
				"Không thể đồng bộ danh sách bài viết từ Zalo OA.",
			),
			oaDisplayName: account.displayName,
		});
	}

	return { articles, issues };
}
