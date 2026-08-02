import { inArray } from "drizzle-orm";
import { z } from "zod";

import { articleBulkActionSchema } from "@/lib/articles/schemas";
import {
	deleteLocalArticle,
	setArticleReviewStatus,
} from "@/lib/articles/store";
import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { actorFromAuth } from "@/lib/chat/http";
import { adminDb } from "@/lib/db/client";
import { articles } from "@/lib/db/schema";
import { publicErrorMessage } from "@/lib/http/public-error";
import {
	enqueueArticlePublication,
	processArticlePublicationJob,
	removeRemoteArticle,
} from "@/lib/workers/article-publications";

export const maxDuration = 300;

export async function POST(request: Request) {
	const startedAt = Date.now();
	const requestId = request.headers.get("x-vercel-id");
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}
	try {
		const input = articleBulkActionSchema.parse(await request.json());
		const actor = actorFromAuth(auth);
		const uniqueIds = [...new Set(input.articleIds)];
		const owned = await adminDb
			.select({ id: articles.id, remoteArticleId: articles.remoteArticleId })
			.from(articles)
			.where(inArray(articles.id, uniqueIds));
		const byId = new Map(owned.map((article) => [article.id, article]));
		const results = [];

		for (const id of uniqueIds) {
			const article = byId.get(id);
			if (!article) {
				results.push({ error: "Không tìm thấy bài viết CS35.", id, ok: false });
				continue;
			}
			try {
				if (input.action === "set_review_status") {
					await setArticleReviewStatus(id, input.status, actor);
				} else if (input.action === "sync_hidden" || input.action === "hide") {
					const job = await enqueueArticlePublication(id, input.action, actor);
					await processArticlePublicationJob(job.id);
				} else {
					if (article.remoteArticleId) {
						await removeRemoteArticle(id, actor);
					}
					const deleted = await deleteLocalArticle(id, actor);
					if (!deleted) throw new Error("Không thể xóa bài viết.");
				}
				results.push({ id, ok: true });
			} catch (error) {
				const message = publicErrorMessage(error, "Thao tác không thành công.");
				console.error(
					JSON.stringify({
						action: input.action,
						articleId: id,
						level: "error",
						message,
						msg: "article_bulk_item_failed",
						requestId,
					}),
				);
				results.push({
					error: message,
					id,
					ok: false,
				});
			}
		}

		const succeeded = results.filter((result) => result.ok).length;
		const failed = results.length - succeeded;
		console.log(
			JSON.stringify({
				action: input.action,
				durationMs: Date.now() - startedAt,
				failed,
				level: "info",
				msg: "article_bulk_completed",
				requestId,
				succeeded,
			}),
		);
		return Response.json(
			{
				...(failed
					? {
							error:
								results.find((result) => !result.ok)?.error ??
								"Thao tác không thành công.",
						}
					: {}),
				failed,
				results,
				succeeded,
			},
			{
				headers: authHeaders(auth),
				status: succeeded ? 200 : 409,
			},
		);
	} catch (error) {
		console.error(
			JSON.stringify({
				durationMs: Date.now() - startedAt,
				level: "error",
				message: publicErrorMessage(error, "Không thể xử lý các bài viết."),
				msg: "article_bulk_failed",
				requestId,
			}),
		);
		if (error instanceof z.ZodError) {
			return Response.json(
				{ error: "Thao tác hàng loạt không hợp lệ." },
				{ status: 400, headers: authHeaders(auth) },
			);
		}
		return Response.json(
			{ error: publicErrorMessage(error, "Không thể xử lý các bài viết.") },
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
