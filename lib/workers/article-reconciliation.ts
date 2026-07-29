import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import {
	buildAutomatedArticleSeed,
	reconcileAutomatedArticleContent,
} from "@/lib/articles/automation-content";
import type { ArticleContent } from "@/lib/articles/schemas";
import { updateArticle } from "@/lib/articles/store";
import { adminDb } from "@/lib/db/client";
import {
	articles,
	counterArgumentDrafts,
	evidenceItems,
} from "@/lib/db/schema";
import { enqueueArticlePublication } from "@/lib/workers/article-publications";

const SYSTEM_ACTOR = {
	displayName: "Tự động sửa bản nháp",
	id: "system",
};

export async function reconcileAutomatedHiddenArticles(limit = 25) {
	const candidates = await adminDb
		.select({
			article: articles,
			draft: counterArgumentDrafts,
			evidence: evidenceItems,
		})
		.from(articles)
		.innerJoin(
			counterArgumentDrafts,
			eq(articles.originDraftId, counterArgumentDrafts.id),
		)
		.innerJoin(
			evidenceItems,
			eq(articles.originEvidenceItemId, evidenceItems.id),
		)
		.where(
			and(
				eq(articles.createdByUserId, "system"),
				eq(articles.updatedByUserId, "system"),
				inArray(articles.reviewStatus, ["draft", "needs_review"]),
				inArray(articles.publicationStatus, [
					"hidden",
					"not_synced",
					"failed",
				]),
			),
		)
		.orderBy(asc(articles.updatedAt))
		.limit(Math.max(1, Math.min(limit, 100)));

	let failed = 0;
	let queued = 0;
	let repaired = 0;

	for (const { article, draft, evidence } of candidates) {
		try {
			const seed = buildAutomatedArticleSeed({
				body: draft.body,
				draftKind: draft.draftKind,
				evidence,
			});
			const current: ArticleContent = {
				author: article.author,
				blocks: article.blocks,
				commentsEnabled: article.commentsEnabled,
				coverUrl: article.coverUrl,
				description: article.description,
				title: article.title,
			};
			const reconciled = reconcileAutomatedArticleContent(seed, current);
			const changed = JSON.stringify(current) !== JSON.stringify(reconciled);

			if (changed) {
				await updateArticle(article.id, reconciled, SYSTEM_ACTOR, {
					instruction:
						"Tự động sửa tiêu đề lặp và đoạn mô tả bị cắt trước khi đồng bộ Zalo",
					origin: "ai",
				});
				repaired += 1;
			}

			const shouldSync =
				process.env.ZALO_OA_ENABLED === "true" &&
				Boolean(article.targetOaConnectionId) &&
				Boolean(reconciled.coverUrl) &&
				(changed || article.publicationStatus !== "hidden");
			if (shouldSync) {
				await enqueueArticlePublication(
					article.id,
					"sync_hidden",
					SYSTEM_ACTOR,
				);
				queued += 1;
			}
		} catch {
			failed += 1;
		}
	}

	return {
		failed,
		queued,
		repaired,
		scanned: candidates.length,
	};
}
