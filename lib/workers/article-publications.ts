import "server-only";

import { createHash } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";

import type { ChatActor } from "@/lib/chat/types";
import { ARTICLE_CATALOG_TAG } from "@/lib/articles/cache-tags";
import { adminDb } from "@/lib/db/client";
import {
	articlePublicationJobs,
	articles,
	auditEvents,
	cronHeartbeats,
} from "@/lib/db/schema";
import { publicErrorMessage } from "@/lib/http/public-error";
import { logOperation } from "@/lib/operations/telemetry";
import {
	actorAllowsArticleOperation,
	publicationStateAllowsArticleOperation,
	reviewAllowsArticleOperation,
} from "@/lib/articles/publication-policy";
import {
	createZaloArticle,
	getZaloArticle,
	listZaloArticles,
	removeZaloArticle,
	updateZaloArticle,
	verifyZaloArticleOperation,
	ZaloApiError,
	type ZaloArticleContent,
} from "@/lib/zalo/client";
import { prepareZaloArticleContent } from "@/lib/zalo/article-content";
import { getValidZaloAccessToken } from "@/lib/zalo/connections";
import { ZALO_ARTICLE_CATALOG_TAG } from "@/lib/zalo/cache-tags";

type PublicationOperation =
	| "sync_hidden"
	| "publish"
	| "hide"
	| "update_visible";

export async function enqueueArticlePublication(
	articleId: string,
	operation: PublicationOperation,
	actor: ChatActor,
	scheduledAt = new Date(),
) {
	const [article] = await adminDb
		.select()
		.from(articles)
		.where(eq(articles.id, articleId))
		.limit(1);
	if (!article) throw new Error("Không tìm thấy bài viết.");
	validateOperation(article, operation, scheduledAt, actor.id);

	const [active] = await adminDb
		.select()
		.from(articlePublicationJobs)
		.where(
			and(
				eq(articlePublicationJobs.articleId, articleId),
				eq(articlePublicationJobs.operation, operation),
				inArray(articlePublicationJobs.status, ["queued", "running", "retrying"]),
			),
		)
		.limit(1);
	if (active && (operation !== "publish" || active.status === "running")) {
		return active;
	}

	if (operation === "publish") {
		await adminDb
			.update(articlePublicationJobs)
			.set({
				errorMessage: "Được thay thế bằng lịch xuất bản mới",
				status: "cancelled",
				updatedAt: new Date(),
			})
				.where(
					and(
						eq(articlePublicationJobs.articleId, articleId),
						eq(articlePublicationJobs.operation, "publish"),
						inArray(articlePublicationJobs.status, ["queued", "retrying"]),
					),
				);
	}

	const fingerprint = createHash("sha256")
		.update(
			[
				articleId,
				operation,
				article.contentHash,
				scheduledAt.toISOString(),
			].join(":"),
		)
		.digest("hex");
	const [job] = await adminDb
		.insert(articlePublicationJobs)
		.values({
			articleId,
			operation,
			requestFingerprint: fingerprint,
			requestedByDisplayName: actor.displayName,
			requestedByUserId: actor.id,
			scheduledAt,
		})
		.onConflictDoNothing()
		.returning();
	if (job) {
		await adminDb.insert(auditEvents).values({
			action: `article_${operation}_queued`,
			entityId: articleId,
			entityType: "article",
			payload: {
				actorId: actor.id,
				jobId: job.id,
				scheduledAt: scheduledAt.toISOString(),
			},
		});
		if (operation === "publish" && scheduledAt.getTime() > Date.now()) {
			await adminDb
				.update(articles)
				.set({
					publicationStatus: "scheduled",
					scheduledAt,
					updatedAt: new Date(),
				})
				.where(eq(articles.id, articleId));
		}
		return job;
	}
	const [existing] = await adminDb
		.select()
		.from(articlePublicationJobs)
		.where(eq(articlePublicationJobs.requestFingerprint, fingerprint))
		.limit(1);
	if (!existing) throw new Error("Không thể tạo tác vụ xuất bản.");
	return existing;
}

export async function cancelScheduledArticle(
	articleId: string,
	actor: ChatActor,
) {
	return adminDb.transaction(async (tx) => {
		const jobs = await tx
			.update(articlePublicationJobs)
			.set({
				errorMessage: "Đã hủy bởi người dùng",
				status: "cancelled",
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(articlePublicationJobs.articleId, articleId),
					eq(articlePublicationJobs.operation, "publish"),
					inArray(articlePublicationJobs.status, ["queued", "retrying"]),
				),
			)
			.returning();
		const [article] = await tx
			.update(articles)
			.set({
				publicationStatus: "hidden",
				scheduledAt: null,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(articles.id, articleId),
					eq(articles.publicationStatus, "scheduled"),
				),
			)
			.returning();
		if (article) {
			await tx.insert(auditEvents).values({
				action: "article_schedule_cancelled",
				entityId: articleId,
				entityType: "article",
				payload: { actorId: actor.id, jobIds: jobs.map((job) => job.id) },
			});
		}
		return article ?? null;
	});
}

export async function processArticlePublicationJob(jobId: string) {
	const [claimed] = await adminDb
		.update(articlePublicationJobs)
		.set({
			attempts: sql`${articlePublicationJobs.attempts} + 1`,
			lockedAt: new Date(),
			status: "running",
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(articlePublicationJobs.id, jobId),
				inArray(articlePublicationJobs.status, ["queued", "retrying"]),
			),
		)
		.returning();
	if (!claimed) {
		const [existing] = await adminDb
			.select()
			.from(articlePublicationJobs)
			.where(eq(articlePublicationJobs.id, jobId))
			.limit(1);
		return existing ?? null;
	}

	try {
		await executePublicationOperation(claimed);
		const [completed] = await adminDb
			.update(articlePublicationJobs)
			.set({
				completedAt: new Date(),
				errorMessage: null,
				lockedAt: null,
				status: "completed",
				updatedAt: new Date(),
			})
			.where(eq(articlePublicationJobs.id, jobId))
			.returning();
		return completed ?? claimed;
	} catch (error) {
		// A job the rules reject can never succeed on a later attempt, so it is
		// cancelled rather than retried — otherwise the queue re-runs it forever
		// and repaints the article red every few minutes.
		const notPermitted = error instanceof PublicationNotPermittedError;
		const willRetry = !notPermitted && claimed.attempts < claimed.maxAttempts;
		const message = publicErrorMessage(
			error,
			willRetry
				? "Thao tác Zalo chưa hoàn tất. Hệ thống sẽ tự động thử lại."
				: "Zalo OA từ chối thao tác này. Hãy mở nhật ký vận hành để xem chi tiết.",
		);
		// The operator-facing message deliberately hides anything that is not
		// already safe Vietnamese prose, which means the actual cause of a failure
		// left no trace anywhere — a job could retry itself to exhaustion and the
		// only record was "chưa hoàn tất". The real error is kept where support
		// can read it, and never shown.
		const cause =
			error instanceof Error ? error : new Error(String(error));
		const detail = {
			articleId: claimed.articleId,
			errorMessage: cause.message.slice(0, 500),
			errorName: cause.name,
			jobId: claimed.id,
			operation: claimed.operation,
			// Zalo reports what it rejected in the response body, which is the part
			// that says whether it was the cover image, the title, or the account.
			zaloDetails:
				cause instanceof ZaloApiError
					? JSON.stringify(cause.details).slice(0, 800)
					: null,
			zaloStatus: cause instanceof ZaloApiError ? cause.status : null,
		};
		logOperation("article_publication_failed", detail, "error");
		const retry = willRetry;
		const [current] = notPermitted
			? await adminDb
					.select({ remoteArticleId: articles.remoteArticleId })
					.from(articles)
					.where(eq(articles.id, claimed.articleId))
					.limit(1)
			: [];
		const nextAttempt = new Date(
			Date.now() + Math.min(15 * 60_000, 30_000 * 2 ** claimed.attempts),
		);
		const [failed] = await adminDb
			.update(articlePublicationJobs)
			.set({
				errorMessage: message,
				lockedAt: null,
				scheduledAt: retry ? nextAttempt : claimed.scheduledAt,
				status: retry ? "retrying" : notPermitted ? "cancelled" : "failed",
				updatedAt: new Date(),
			})
			.where(eq(articlePublicationJobs.id, jobId))
			.returning();
		await adminDb.insert(auditEvents).values({
			action: "article_publication_failed",
			entityId: claimed.articleId,
			entityType: "article",
			payload: { ...detail, nextStatus: retry ? "retrying" : "failed" },
		});
		await adminDb
			.update(articles)
			.set(
				notPermitted
					? {
							// Nothing was attempted on Zalo, so the article goes back to
							// describing where it actually stands.
							lastError: null,
							publicationStatus: current?.remoteArticleId
								? "hidden"
								: "not_synced",
							updatedAt: new Date(),
						}
					: {
							lastError: message,
							publicationStatus: retry
								? claimed.operation === "publish"
									? "scheduled"
									: "syncing"
								: "failed",
							updatedAt: new Date(),
						},
			)
			.where(eq(articles.id, claimed.articleId));
		if (!retry && !notPermitted) throw error;
		return failed ?? claimed;
	}
}

export async function processDueArticlePublications(limit = 5) {
	const jobs = await adminDb.transaction(async (tx) => {
		const result = await tx.execute(sql`
			select id
			from article_publication_jobs
			where status in ('queued', 'retrying')
				and scheduled_at <= now()
			order by scheduled_at asc, created_at asc
			for update skip locked
			limit ${limit}
		`);
		return Array.from(result) as Array<{ id: string }>;
	});
	const processed = [];
	for (const job of jobs) {
		processed.push(await processArticlePublicationJob(job.id));
	}
	await adminDb
		.insert(cronHeartbeats)
		.values({
			metadata: { processed: processed.length },
			serviceName: "vercel-cron:process-article-publications",
		})
		.onConflictDoUpdate({
			set: {
				lastSeenAt: new Date(),
				metadata: { processed: processed.length },
			},
			target: cronHeartbeats.serviceName,
		});
	return { processed: processed.length };
}

export async function refreshRemoteArticle(articleId: string) {
	const [article] = await adminDb
		.select()
		.from(articles)
		.where(eq(articles.id, articleId))
		.limit(1);
	if (!article?.remoteArticleId || !article.targetOaConnectionId) {
		throw new Error("Bài viết chưa được đồng bộ với Zalo.");
	}
	const accessToken = await getValidZaloAccessToken(
		article.targetOaConnectionId,
	);
	const remoteSnapshot = await getZaloArticle(
		accessToken,
		article.remoteArticleId,
	);
	const [updated] = await adminDb
		.update(articles)
		.set({ remoteSnapshot, updatedAt: new Date() })
		.where(eq(articles.id, articleId))
		.returning();
	return updated ?? null;
}

export async function removeRemoteArticle(
	articleId: string,
	actor: ChatActor,
) {
	const [article] = await adminDb
		.select()
		.from(articles)
		.where(eq(articles.id, articleId))
		.limit(1);
	if (!article?.remoteArticleId || !article.targetOaConnectionId) {
		throw new Error("Bài viết chưa được đồng bộ với Zalo.");
	}
	validateOperation(article, "hide", new Date(), actor.id);
	const cancelledJobs = await adminDb
		.update(articlePublicationJobs)
		.set({
			errorMessage: "Đã hủy để xóa bài viết",
			lockedAt: null,
			status: "cancelled",
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(articlePublicationJobs.articleId, articleId),
				inArray(articlePublicationJobs.status, ["queued", "retrying"]),
			),
		)
		.returning({ id: articlePublicationJobs.id });
	const [runningJob] = await adminDb
		.select({ id: articlePublicationJobs.id })
		.from(articlePublicationJobs)
		.where(
			and(
				eq(articlePublicationJobs.articleId, articleId),
				eq(articlePublicationJobs.status, "running"),
			),
		)
		.limit(1);
	if (runningJob) {
		throw new Error(
			"Bài viết đang được xử lý trên Zalo. Hãy đợi thao tác hoàn tất rồi xóa lại.",
		);
	}

	const accessToken = await getValidZaloAccessToken(
		article.targetOaConnectionId,
	);
	await removeZaloArticle(accessToken, article.remoteArticleId);
	const removedAt = new Date();
	const updated = await adminDb.transaction(async (tx) => {
		const [updated] = await tx
			.update(articles)
			.set({
				lastError: null,
				lastSyncedAt: null,
				publicationStatus: "not_synced",
				remoteArticleId: null,
				remoteOperationToken: null,
				remoteSnapshot: {},
				scheduledAt: null,
				syncedContentHash: null,
				updatedAt: removedAt,
				updatedByDisplayName: actor.displayName,
				updatedByUserId: actor.id,
			})
			.where(eq(articles.id, articleId))
			.returning();
		await tx.insert(auditEvents).values({
			action: "article_removed_from_zalo",
			entityId: articleId,
			entityType: "article",
			payload: {
				actorId: actor.id,
				cancelledJobIds: cancelledJobs.map((job) => job.id),
				remoteArticleId: article.remoteArticleId,
				removedAt: removedAt.toISOString(),
			},
		});
		return updated ?? null;
	});
	revalidateTag(ZALO_ARTICLE_CATALOG_TAG, "max");
	revalidateTag(ARTICLE_CATALOG_TAG, "max");
	return updated;
}

async function executePublicationOperation(
	job: typeof articlePublicationJobs.$inferSelect,
) {
	const [article] = await adminDb
		.select()
		.from(articles)
		.where(eq(articles.id, job.articleId))
		.limit(1);
	if (!article || !article.targetOaConnectionId) {
		throw new Error("Bài viết hoặc Zalo OA đích không tồn tại.");
	}
	validateOperation(
		article,
		job.operation,
		job.scheduledAt,
		job.requestedByUserId,
	);
	const accessToken = await getValidZaloAccessToken(
		article.targetOaConnectionId,
	);
	const status =
		job.operation === "sync_hidden" || job.operation === "hide"
			? "hide"
			: "show";
	const content = toZaloContent(article, status);
	await validateRemoteImages(content);
	await adminDb
		.update(articles)
		.set({
			lastError: null,
			publicationStatus:
				status === "show" ? "publishing" : "syncing",
			updatedAt: new Date(),
		})
		.where(eq(articles.id, article.id));

	let remoteArticleId = article.remoteArticleId;
	// A remote id outlives the article it points at: anyone with access to the OA
	// can delete a draft, and nothing tells us. Updating a deleted article is
	// accepted by Zalo and verifies clean, so the sync reports success while the
	// OA still shows nothing — which is exactly what happened after the OA's
	// content list was cleared by hand. Checking first turns that into a create.
	let recreating = false;
	if (remoteArticleId && job.operation === "sync_hidden") {
		const stillThere = await getZaloArticle(accessToken, remoteArticleId)
			.then(() => true)
			.catch(() => false);
		if (!stillThere) {
			remoteArticleId = null;
			recreating = true;
			await adminDb
				.update(articles)
				.set({
					lastSyncedAt: null,
					remoteArticleId: null,
					remoteOperationToken: null,
					syncedContentHash: null,
					updatedAt: new Date(),
				})
				.where(eq(articles.id, article.id));
		}
	}
	let operationToken: string;
	try {
		const pendingToken =
			job.remoteOperationToken ?? article.remoteOperationToken;
		// A pending token resumes an operation that was already in flight. Once we
		// know the article it belonged to is gone, resuming it would wait on an
		// answer about something deleted instead of making a new article.
		if (!remoteArticleId && pendingToken && !recreating) {
			operationToken = pendingToken;
		} else {
			const operation = remoteArticleId
				? await updateZaloArticle(accessToken, remoteArticleId, content)
				: await createZaloArticle(accessToken, content);
			operationToken = operation.token;
			await Promise.all([
				adminDb
					.update(articlePublicationJobs)
					.set({ remoteOperationToken: operationToken, updatedAt: new Date() })
					.where(eq(articlePublicationJobs.id, job.id)),
				adminDb
					.update(articles)
					.set({ remoteOperationToken: operationToken, updatedAt: new Date() })
					.where(eq(articles.id, article.id)),
			]);
		}
		const verified = await verifyWithRetry(accessToken, operationToken);
		remoteArticleId = verified.id;
	} catch (error) {
		if (!remoteArticleId && job.operation === "sync_hidden") {
			remoteArticleId = await reconcileCreatedArticle(accessToken, article.title);
		}
		if (!remoteArticleId) throw error;
	}

	const remoteSnapshot = await getZaloArticle(
		accessToken,
		remoteArticleId,
	).catch(() => ({}));
	const now = new Date();
	await adminDb.transaction(async (tx) => {
		await tx
			.update(articles)
			.set({
				lastError: null,
				lastSyncedAt: now,
				publicationStatus: status === "show" ? "published" : "hidden",
				publishedAt: status === "show" ? article.publishedAt ?? now : article.publishedAt,
				remoteArticleId,
				remoteSnapshot,
				scheduledAt: null,
				syncedContentHash: article.contentHash,
				updatedAt: now,
			})
			.where(eq(articles.id, article.id));
		await tx.insert(auditEvents).values({
			action:
				status === "show" ? "article_published_to_zalo" : "article_synced_hidden",
			entityId: article.id,
			entityType: "article",
			payload: {
				actorId: job.requestedByUserId,
				jobId: job.id,
				operation: job.operation,
				remoteArticleId,
			},
		});
	});
	revalidateTag(ZALO_ARTICLE_CATALOG_TAG, "max");
	revalidateTag(ARTICLE_CATALOG_TAG, "max");
}

/**
 * A request the rules no longer permit — not a transport failure.
 *
 * The distinction matters: a Zalo timeout is worth retrying and worth showing as
 * "Đăng lỗi", whereas an unapproved article was never eligible in the first
 * place. Retrying it can only fail again, and reporting it as a publish error on
 * an article nobody approved is simply wrong — there was no publish to fail.
 */
class PublicationNotPermittedError extends Error {}

function validateOperation(
	article: typeof articles.$inferSelect,
	operation: PublicationOperation,
	scheduledAt: Date,
	actorUserId: string,
) {
	if (!actorAllowsArticleOperation(actorUserId, operation)) {
		throw new PublicationNotPermittedError(
			"Tự động hóa chỉ được đồng bộ bản nháp ẩn; không được phép xuất bản công khai.",
		);
	}
	if (!reviewAllowsArticleOperation(article.reviewStatus, operation)) {
		throw new PublicationNotPermittedError("Bài viết phải được phê duyệt trước mọi thao tác với Zalo OA.");
	}
	if (!publicationStateAllowsArticleOperation(article.state, operation)) {
		throw new PublicationNotPermittedError(
			"Hãy bấm Xuất bản trong trình biên tập trước khi đưa bài lên Zalo OA.",
		);
	}
	if (!article.targetOaConnectionId) {
		throw new Error("Hãy chọn Zalo OA đích.");
	}
	// Staging a hidden draft over a live post would take it off the OA. Pulling a
	// published article back is a deliberate act, so it has to go through `hide`.
	if (
		operation === "sync_hidden" &&
		(article.publicationStatus === "published" ||
			article.publicationStatus === "publishing" ||
			article.publicationStatus === "scheduled")
	) {
		throw new Error(
			"Bài đang hiển thị trên Zalo OA. Hãy dùng Gỡ bài trước khi đưa về bản ẩn.",
		);
	}
	if (operation !== "sync_hidden" && !article.remoteArticleId) {
		throw new Error("Hãy đồng bộ bản ẩn với Zalo trước.");
	}
	if (
		operation === "publish" &&
		article.syncedContentHash !== article.contentHash
	) {
		throw new Error("Nội dung đã thay đổi. Hãy đồng bộ lại bản ẩn trước.");
	}
	if (
		operation === "publish" &&
		scheduledAt.getTime() < Date.now() - 60_000
	) {
		throw new Error("Thời điểm xuất bản đã qua.");
	}
}

function toZaloContent(
	article: typeof articles.$inferSelect,
	status: "hide" | "show",
): ZaloArticleContent {
	const prepared = prepareZaloArticleContent({
		author: article.author,
		blocks: article.blocks,
		commentsEnabled: article.commentsEnabled,
		coverUrl: article.coverUrl,
		description: article.description,
		title: article.title,
	});
	return {
		...prepared,
		coverUrl: prepared.coverUrl ?? null,
		status,
	};
}

async function verifyWithRetry(accessToken: string, token: string) {
	let latestError: unknown;
	for (const delay of [0, 500, 1_000, 2_000]) {
		if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
		try {
			return await verifyZaloArticleOperation(accessToken, token);
		} catch (error) {
			latestError = error;
		}
	}
	throw latestError;
}

async function reconcileCreatedArticle(accessToken: string, title: string) {
	const body = await listZaloArticles(accessToken, { limit: 20 });
	const data =
		body.data && typeof body.data === "object"
			? (body.data as Record<string, unknown>)
			: {};
	const items = Array.isArray(data.articles)
		? data.articles
		: Array.isArray(data.items)
			? data.items
			: [];
	for (const item of items) {
		if (!item || typeof item !== "object") continue;
		const row = item as Record<string, unknown>;
		if (row.title === title && typeof row.id === "string") return row.id;
	}
	return null;
}

async function validateRemoteImages(content: ZaloArticleContent) {
	const urls = [
		{ cover: true, url: content.coverUrl },
		...content.blocks
			.filter((block) => block.type === "image")
			.map((block) => ({ cover: false, url: block.url })),
	].filter(
		(item): item is { cover: boolean; url: string } => Boolean(item.url),
	);
	for (const item of urls) {
		const url = new URL(item.url);
		if (!["http:", "https:"].includes(url.protocol)) {
			throw new Error("Ảnh bài viết phải dùng URL HTTP hoặc HTTPS công khai.");
		}
		const response = await fetch(url, {
			cache: "no-store",
			method: "HEAD",
			signal: AbortSignal.timeout(8_000),
		}).catch(() => null);
		if (!response?.ok) continue;
		const contentType = response.headers.get("content-type") ?? "";
		if (contentType && !contentType.startsWith("image/")) {
			throw new Error("URL ảnh không trả về định dạng hình ảnh.");
		}
		const size = Number(response.headers.get("content-length") ?? "0");
		if (item.cover && size > 1024 * 1024) {
			throw new Error("Ảnh bìa Zalo phải nhỏ hơn hoặc bằng 1 MB.");
		}
	}
}
