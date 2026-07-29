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
} from "./article-catalog";

export type ZaloArticleCatalog = {
	articles: ZaloCatalogArticle[];
	issues: Array<{ oaDisplayName: string; message: string }>;
};

export async function listZaloArticleCatalog(): Promise<ZaloArticleCatalog> {
	if (!isZaloEnabled()) return { articles: [], issues: [] };

	const accounts = (await listSafeZaloConnections()).filter(
		(account) => account.status === "connected",
	);
	const results = await Promise.allSettled(
		accounts.map(async (account) => {
			const accessToken = await getValidZaloAccessToken(account.id);
			const payload = await listZaloArticles(accessToken, { limit: 20 });
			return normalizeZaloArticleList(payload, {
				connectionId: account.id,
				displayName: account.displayName,
				oaId: account.oaId,
			});
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
