import "server-only";

import { createHash } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";

import type { ChatActor } from "@/lib/chat/types";
import { adminDb } from "@/lib/db/client";
import {
	articlePublicationJobs,
	articles,
	auditEvents,
	cronHeartbeats,
} from "@/lib/db/schema";
import { publicErrorMessage } from "@/lib/http/public-error";
import { reviewAllowsArticleOperation } from "@/lib/articles/publication-policy";
import {
	createZaloArticle,
	getZaloArticle,
	listZaloArticles,
	removeZaloArticle,
	updateZaloArticle,
	verifyZaloArticleOperation,
	type ZaloArticleContent,
} from "@/lib/zalo/client";
import { getValidZaloAccessToken } from "@/lib/zalo/connections";

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
	validateOperation(article, operation, scheduledAt);

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
		const message = publicErrorMessage(
			error,
			"Thao tác Zalo chưa hoàn tất. Hệ thống sẽ tự động thử lại.",
		);
		const retry = claimed.attempts < claimed.maxAttempts;
		const nextAttempt = new Date(
			Date.now() + Math.min(15 * 60_000, 30_000 * 2 ** claimed.attempts),
		);
		const [failed] = await adminDb
			.update(articlePublicationJobs)
			.set({
				errorMessage: message,
				lockedAt: null,
				scheduledAt: retry ? nextAttempt : claimed.scheduledAt,
				status: retry ? "retrying" : "failed",
				updatedAt: new Date(),
			})
			.where(eq(articlePublicationJobs.id, jobId))
			.returning();
		await adminDb
			.update(articles)
			.set({
				lastError: message,
				publicationStatus: retry ? claimed.operation === "publish" ? "scheduled" : "syncing" : "failed",
				updatedAt: new Date(),
			})
			.where(eq(articles.id, claimed.articleId));
		if (!retry) throw error;
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
	const [activeJob] = await adminDb
		.select({ id: articlePublicationJobs.id })
		.from(articlePublicationJobs)
		.where(
			and(
				eq(articlePublicationJobs.articleId, articleId),
				inArray(articlePublicationJobs.status, ["queued", "running", "retrying"]),
			),
		)
		.limit(1);
	if (activeJob) {
		throw new Error(
			"Bài viết đang có thao tác Zalo chờ xử lý. Hãy hủy lịch hoặc đợi thao tác hoàn tất.",
		);
	}

	const accessToken = await getValidZaloAccessToken(
		article.targetOaConnectionId,
	);
	await removeZaloArticle(accessToken, article.remoteArticleId);
	const removedAt = new Date();
	return adminDb.transaction(async (tx) => {
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
				remoteArticleId: article.remoteArticleId,
				removedAt: removedAt.toISOString(),
			},
		});
		return updated ?? null;
	});
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
	validateOperation(article, job.operation, job.scheduledAt);
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
	let operationToken: string;
	try {
		const pendingToken =
			job.remoteOperationToken ?? article.remoteOperationToken;
		if (!remoteArticleId && pendingToken) {
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
}

function validateOperation(
	article: typeof articles.$inferSelect,
	operation: PublicationOperation,
	scheduledAt: Date,
) {
	if (!reviewAllowsArticleOperation(article.reviewStatus, operation)) {
		throw new Error(
			operation === "sync_hidden"
				? "Bài viết đã bị từ chối nên không thể đồng bộ bản ẩn."
				: "Bài viết phải được phê duyệt trước khi xuất bản.",
		);
	}
	if (!article.targetOaConnectionId) {
		throw new Error("Hãy chọn Zalo OA đích.");
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
	return {
		author: article.author,
		blocks: article.blocks,
		commentsEnabled: article.commentsEnabled,
		coverUrl: article.coverUrl,
		description: article.description,
		status,
		title: article.title,
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
