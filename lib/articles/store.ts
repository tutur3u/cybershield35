import "server-only";

import { createHash } from "node:crypto";

import { and, desc, eq, inArray, max } from "drizzle-orm";

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

import type { ArticleContent } from "./schemas";

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
	return adminDb.transaction(async (tx) => {
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
}

export async function updateArticle(
	id: string,
	patch: Partial<ArticleContent> & { targetOaConnectionId?: string | null },
	actor: ChatActor,
	input: { instruction?: string; origin?: "manual" | "ai" | "restore" } = {},
) {
	return adminDb.transaction(async (tx) => {
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
}

export async function setArticleReviewStatus(
	id: string,
	status: "draft" | "needs_review" | "approved" | "rejected",
	actor: ChatActor,
) {
	const [updated] = await adminDb
		.update(articles)
		.set({
			reviewStatus: status,
			updatedAt: new Date(),
			updatedByDisplayName: actor.displayName,
			updatedByUserId: actor.id,
		})
		.where(eq(articles.id, id))
		.returning();
	if (updated) {
		await adminDb.insert(auditEvents).values({
			action: `article_review_${status}`,
			entityId: id,
			entityType: "article",
			payload: { actorId: actor.id },
		});
	}
	return updated ?? null;
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
	return normalizeArticleSnapshot({
		author: input.author.trim(),
		blocks: input.blocks,
		commentsEnabled: input.commentsEnabled,
		coverUrl: input.coverUrl ?? null,
		description: input.description.trim(),
		targetOaConnectionId: input.targetOaConnectionId ?? null,
		title: input.title.trim(),
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
