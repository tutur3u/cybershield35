import "server-only";

import { createHash } from "node:crypto";

import { and, asc, desc, eq, ilike, inArray, isNull, max, or, sql } from "drizzle-orm";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";

import type { ChatActor } from "@/lib/chat/types";
import { adminDb } from "@/lib/db/client";
import {
	articleEvidence,
	articlePublicationJobs,
	articles,
	articleVersions,
	auditEvents,
	counterArgumentDrafts,
	evidenceItems,
	zaloOaConnections,
} from "@/lib/db/schema";
import { prepareZaloArticleContent } from "@/lib/zalo/article-content";

import type { ArticleContent } from "./schemas";
import { ARTICLE_CATALOG_TAG } from "./cache-tags";

export type ArticleSnapshot = ArticleContent & {
	targetOaConnectionId: string | null;
};

export function hashArticleContent(content: ArticleSnapshot) {
	return createHash("sha256")
		.update(JSON.stringify(normalizeArticleSnapshot(content)))
		.digest("hex");
}

export async function listArticles() {
	return adminDb
		.select({
			article: articles,
			oaDisplayName: zaloOaConnections.displayName,
			oaId: zaloOaConnections.oaId,
		})
		.from(articles)
		.leftJoin(
			zaloOaConnections,
			eq(articles.targetOaConnectionId, zaloOaConnections.id),
		)
		.orderBy(desc(articles.updatedAt), desc(articles.id));
}

export async function listArticlesPage(input: {
	cursor?: string | null;
	limit: number;
	query?: string;
	review?: "approved" | "draft" | "needs_review" | "rejected";
	sort?: "title" | "updated_asc" | "updated_desc";
	state?: "archived" | "draft" | "published";
}) {
	const limit = Math.min(25, Math.max(1, Math.floor(input.limit)));
	const offset = normalizeOffsetCursor(input.cursor);
	const conditions = [
		input.query ? or(ilike(articles.title, `%${input.query}%`), ilike(articles.description, `%${input.query}%`), ilike(articles.author, `%${input.query}%`)) : undefined,
		input.review ? eq(articles.reviewStatus, input.review) : undefined,
		input.state ? eq(articles.state, input.state) : undefined,
	].filter(Boolean);
	const order = input.sort === "title" ? [asc(articles.title), asc(articles.id)] : input.sort === "updated_asc" ? [asc(articles.updatedAt), asc(articles.id)] : [desc(articles.updatedAt), desc(articles.id)];
	const rows = await adminDb
		.select({
			article: articles,
			oaDisplayName: zaloOaConnections.displayName,
			oaId: zaloOaConnections.oaId,
		})
		.from(articles)
		.leftJoin(
			zaloOaConnections,
			eq(articles.targetOaConnectionId, zaloOaConnections.id),
		)
		.where(conditions.length ? and(...conditions) : undefined)
		.orderBy(...order)
		.limit(limit + 1)
		.offset(offset);
	const hasNextPage = rows.length > limit;
	const items = rows.slice(0, limit);

	return {
		hasNextPage,
		items,
		nextCursor: hasNextPage ? String(offset + limit) : null,
	};
}

export async function getCachedArticlesPage(input: {
	cursor?: string | null;
	limit: number;
	query?: string;
	review?: "approved" | "draft" | "needs_review" | "rejected";
	sort?: "title" | "updated_asc" | "updated_desc";
	state?: "archived" | "draft" | "published";
}) {
	"use cache";
	cacheLife({ expire: 300, revalidate: 30, stale: 30 });
	cacheTag(ARTICLE_CATALOG_TAG);
	return listArticlesPage(input);
}

function invalidateArticleCatalog() {
	revalidateTag(ARTICLE_CATALOG_TAG, "max");
}

function normalizeOffsetCursor(value?: string | null) {
	const parsed = Number(value ?? 0);
	return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export async function getArticleDetail(id: string) {
	const [row] = await adminDb
		.select({
			article: articles,
			oaDisplayName: zaloOaConnections.displayName,
			oaId: zaloOaConnections.oaId,
		})
		.from(articles)
		.leftJoin(
			zaloOaConnections,
			eq(articles.targetOaConnectionId, zaloOaConnections.id),
		)
		.where(eq(articles.id, id))
		.limit(1);
	if (!row) return null;

	const [versions, evidence, jobs] = await Promise.all([
		adminDb
			.select()
			.from(articleVersions)
			.where(eq(articleVersions.articleId, id))
			.orderBy(desc(articleVersions.version))
			.limit(30),
		adminDb
			.select({
				author: evidenceItems.author,
				id: evidenceItems.id,
				quote: evidenceItems.quote,
				riskLevel: evidenceItems.riskLevel,
				sourceLabel: evidenceItems.sourceLabel,
				summary: evidenceItems.summary,
			})
			.from(articleEvidence)
			.innerJoin(
				evidenceItems,
				eq(articleEvidence.evidenceItemId, evidenceItems.id),
			)
			.where(eq(articleEvidence.articleId, id))
			.orderBy(desc(evidenceItems.createdAt)),
		adminDb
			.select()
			.from(articlePublicationJobs)
			.where(eq(articlePublicationJobs.articleId, id))
			.orderBy(desc(articlePublicationJobs.createdAt))
			.limit(20),
	]);

	return { ...row, evidence, jobs, versions };
}

export async function findArticleIdByOriginDraftId(originDraftId: string) {
	const [article] = await adminDb
		.select({ id: articles.id })
		.from(articles)
		.where(eq(articles.originDraftId, originDraftId))
		.limit(1);
	return article?.id ?? null;
}

export async function createArticle(
	input: ArticleContent & {
		originDraftId?: string;
		originEvidenceItemId?: string;
		originScanJobId?: string;
		originatingChatId?: string;
		targetOaConnectionId?: string | null;
	},
	actor: ChatActor,
) {
	let seeded = input;
	if (input.originDraftId && !input.blocks.length) {
		const [draft] = await adminDb
			.select({ body: counterArgumentDrafts.body })
			.from(counterArgumentDrafts)
			.where(eq(counterArgumentDrafts.id, input.originDraftId))
			.limit(1);
		if (draft) {
			seeded = {
				...input,
				blocks: [{ content: draft.body, id: crypto.randomUUID(), type: "text" }],
			};
		}
	}

	const snapshot = snapshotFromInput(seeded);
	const article = await adminDb.transaction(async (tx) => {
		const [article] = await tx
			.insert(articles)
			.values({
				...snapshot,
				contentHash: hashArticleContent(snapshot),
				createdByDisplayName: actor.displayName,
				createdByUserId: actor.id,
				originDraftId: input.originDraftId,
				originEvidenceItemId: input.originEvidenceItemId,
				originScanJobId: input.originScanJobId,
				originatingChatId: input.originatingChatId,
				updatedByDisplayName: actor.displayName,
				updatedByUserId: actor.id,
			})
			.returning();
		if (!article) throw new Error("Không thể tạo bài viết.");

		await tx.insert(articleVersions).values({
			actorDisplayName: actor.displayName,
			actorUserId: actor.id,
			articleId: article.id,
			snapshot,
			version: 1,
		});
		if (input.originEvidenceItemId) {
			await tx
				.insert(articleEvidence)
				.values({
					articleId: article.id,
					evidenceItemId: input.originEvidenceItemId,
				})
				.onConflictDoNothing();
		}
		await tx.insert(auditEvents).values({
			action: "article_created",
			entityId: article.id,
			entityType: "article",
			payload: { actorId: actor.id },
		});
		return article;
	});
	invalidateArticleCatalog();
	return article;
}

export async function updateArticle(
	id: string,
	patch: Partial<ArticleContent> & { targetOaConnectionId?: string | null },
	actor: ChatActor,
	input: { instruction?: string; origin?: "manual" | "ai" | "restore" } = {},
) {
	const article = await adminDb.transaction(async (tx) => {
		const [current] = await tx
			.select()
			.from(articles)
			.where(eq(articles.id, id))
			.limit(1);
		if (!current) return null;
		if (["syncing", "publishing"].includes(current.publicationStatus)) {
			throw new Error("Bài viết đang đồng bộ với Zalo. Vui lòng đợi hoàn tất.");
		}

		const snapshot = snapshotFromInput({
			author: patch.author ?? current.author,
			blocks: patch.blocks ?? current.blocks,
			commentsEnabled: patch.commentsEnabled ?? current.commentsEnabled,
			coverUrl:
				patch.coverUrl === undefined ? current.coverUrl : patch.coverUrl,
			description: patch.description ?? current.description,
			targetOaConnectionId:
				patch.targetOaConnectionId === undefined
					? current.targetOaConnectionId
					: patch.targetOaConnectionId,
			title: patch.title ?? current.title,
		});
		const contentHash = hashArticleContent(snapshot);
		const changed = contentHash !== current.contentHash;
		if (changed && current.publicationStatus === "scheduled") {
			await tx
				.update(articlePublicationJobs)
				.set({
					errorMessage: "Đã hủy vì nội dung thay đổi",
					status: "cancelled",
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(articlePublicationJobs.articleId, id),
						inArray(articlePublicationJobs.status, ["queued", "retrying"]),
					),
				);
		}

		const [versionRow] = await tx
			.select({ value: max(articleVersions.version) })
			.from(articleVersions)
			.where(eq(articleVersions.articleId, id));
		const [updated] = await tx
			.update(articles)
			.set({
				...snapshot,
				contentHash,
				lastError: null,
				publicationStatus:
					changed &&
					["hidden", "scheduled", "failed"].includes(current.publicationStatus)
						? "not_synced"
						: current.publicationStatus,
				scheduledAt: changed ? null : current.scheduledAt,
				updatedAt: new Date(),
				updatedByDisplayName: actor.displayName,
				updatedByUserId: actor.id,
			})
			.where(eq(articles.id, id))
			.returning();
		if (!updated) return null;

		if (changed) {
			await tx.insert(articleVersions).values({
				actorDisplayName: actor.displayName,
				actorUserId: actor.id,
				articleId: id,
				instruction: input.instruction,
				origin: input.origin ?? "manual",
				snapshot,
				version: (versionRow?.value ?? 0) + 1,
			});
		}
		await tx.insert(auditEvents).values({
			action: changed ? "article_updated" : "article_metadata_updated",
			entityId: id,
			entityType: "article",
			payload: { actorId: actor.id, origin: input.origin ?? "manual" },
		});
		return updated;
	});
	if (article) invalidateArticleCatalog();
	return article;
}

export async function setArticleReviewStatus(
	id: string,
	status: "draft" | "needs_review" | "approved" | "rejected",
	actor: ChatActor,
) {
	const [updated] = await adminDb
		.update(articles)
		.set({
			// A Zalo state left behind by a request the approval gate refused
			// describes nothing that happened. Carrying it past approval would
			// greet the approver with "Đăng lỗi" for a publish nobody attempted,
			// so it is corrected in the same write. Anything with a draft on the
			// OA keeps saying so — that part is true.
			lastError: sql`case
				when ${articles.reviewStatus} <> 'approved'
					and ${articles.publicationStatus} in ('failed', 'syncing', 'publishing', 'scheduled')
					then null
				else ${articles.lastError} end`,
			publicationStatus: sql`case
				when ${articles.reviewStatus} = 'approved'
					or ${articles.publicationStatus} not in ('failed', 'syncing', 'publishing', 'scheduled')
					then ${articles.publicationStatus}
				when ${articles.remoteArticleId} is null then 'not_synced'::publication_status
				else 'hidden'::publication_status end`,
			reviewStatus: status,
			updatedAt: new Date(),
			updatedByDisplayName: actor.displayName,
			updatedByUserId: actor.id,
		})
		.where(eq(articles.id, id))
		.returning();
	if (updated) {
		invalidateArticleCatalog();
		await adminDb.insert(auditEvents).values({
			action: `article_review_${status}`,
			entityId: id,
			entityType: "article",
			payload: { actorId: actor.id },
		});
	}
	return updated ?? null;
}

export async function publishArticleInternally(id: string, actor: ChatActor) {
	const [updated] = await adminDb
		.update(articles)
		.set({
			state: "published",
			publishedAt: new Date(),
			updatedAt: new Date(),
			updatedByDisplayName: actor.displayName,
			updatedByUserId: actor.id,
		})
		.where(and(eq(articles.id, id), eq(articles.reviewStatus, "approved")))
		.returning();
	if (!updated) {
		throw new Error("Chỉ bài viết đã được phê duyệt mới có thể xuất bản.");
	}
	await adminDb.insert(auditEvents).values({
		action: "article_published_internally",
		entityId: id,
		entityType: "article",
		payload: { actorId: actor.id },
	});
	invalidateArticleCatalog();
	return updated;
}

export async function importZaloArticle(
	remote: {
		author: string | null;
		coverUrl: string | null;
		description: string;
		oaConnectionId: string;
		remoteArticleId: string;
		title: string;
	},
	actor: ChatActor,
) {
	const [existing] = await adminDb
		.select()
		.from(articles)
		.where(eq(articles.remoteArticleId, remote.remoteArticleId))
		.limit(1);
	if (existing) return { article: existing, imported: false };
	const created = await createArticle(
		{
			author: remote.author ?? "",
			blocks: remote.description
				? [{ content: remote.description, id: crypto.randomUUID(), type: "text" }]
				: [],
			commentsEnabled: true,
			coverUrl: remote.coverUrl,
			description: remote.description,
			targetOaConnectionId: remote.oaConnectionId,
			title: remote.title,
		},
		actor,
	);
	const [article] = await adminDb
		.update(articles)
		.set({
			publicationStatus: "not_synced",
			remoteArticleId: remote.remoteArticleId,
			reviewStatus: "needs_review",
			updatedAt: new Date(),
		})
		.where(eq(articles.id, created.id))
		.returning();
	return { article: article ?? created, imported: true };
}

export async function deleteLocalArticle(id: string, actor: ChatActor) {
	const article = await adminDb.transaction(async (tx) => {
		const [article] = await tx
			.delete(articles)
			.where(and(eq(articles.id, id), isNull(articles.remoteArticleId)))
			.returning();
		if (!article) return null;
		await tx.insert(auditEvents).values({
			action: "article_deleted",
			entityId: id,
			entityType: "article",
			payload: { actorId: actor.id },
		});
		return article;
	});
	if (article) invalidateArticleCatalog();
	return article;
}

export async function restoreArticleVersion(
	articleId: string,
	versionId: string,
	actor: ChatActor,
) {
	const [version] = await adminDb
		.select()
		.from(articleVersions)
		.where(
			and(
				eq(articleVersions.id, versionId),
				eq(articleVersions.articleId, articleId),
			),
		)
		.limit(1);
	if (!version) return null;
	return updateArticle(
		articleId,
		version.snapshot as ArticleSnapshot,
		actor,
		{ instruction: `Khôi phục phiên bản ${version.version}`, origin: "restore" },
	);
}

export async function addArticleEvidence(
	articleId: string,
	evidenceItemIds: string[],
	actor: ChatActor,
) {
	await adminDb
		.insert(articleEvidence)
		.values(
			evidenceItemIds.map((evidenceItemId) => ({
				articleId,
				evidenceItemId,
			})),
		)
		.onConflictDoNothing();
	await adminDb.insert(auditEvents).values({
		action: "article_evidence_added",
		entityId: articleId,
		entityType: "article",
		payload: { actorId: actor.id, evidenceItemIds },
	});
	return getArticleDetail(articleId);
}

function snapshotFromInput(
	input: ArticleContent & { targetOaConnectionId?: string | null },
): ArticleSnapshot {
	const prepared = prepareZaloArticleContent({
		author: input.author.trim(),
		blocks: input.blocks,
		commentsEnabled: input.commentsEnabled,
		coverUrl: input.coverUrl ?? null,
		description: input.description.trim(),
		title: input.title.trim(),
	});
	return normalizeArticleSnapshot({
		...prepared,
		targetOaConnectionId: input.targetOaConnectionId ?? null,
	});
}

function normalizeArticleSnapshot(snapshot: ArticleSnapshot): ArticleSnapshot {
	return {
		author: snapshot.author,
		blocks: snapshot.blocks.map((block) =>
			block.type === "text"
				? { content: block.content, id: block.id, type: "text" as const }
				: {
						...(block.caption ? { caption: block.caption } : {}),
						id: block.id,
						type: "image" as const,
						url: block.url,
					},
		),
		commentsEnabled: snapshot.commentsEnabled,
		coverUrl: snapshot.coverUrl ?? null,
		description: snapshot.description,
		targetOaConnectionId: snapshot.targetOaConnectionId,
		title: snapshot.title,
	};
}
