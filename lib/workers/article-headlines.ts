import "server-only";

import { desc, eq, inArray } from "drizzle-orm";

import { revalidateTag } from "next/cache";

import { ARTICLE_CATALOG_TAG } from "@/lib/articles/cache-tags";
import { hashArticleContent } from "@/lib/articles/store";
import { adminDb } from "@/lib/db/client";
import { articles, articleVersions, auditEvents } from "@/lib/db/schema";
import { isCleanlyFitted } from "@/lib/domain/text-fit";
import { fitArticleHeadline } from "@/lib/llm/text-fitting";
import {
	prepareZaloArticleContent,
	ZALO_EDITORIAL_DESCRIPTION_LIMIT,
	ZALO_EDITORIAL_TITLE_LIMIT,
} from "@/lib/zalo/article-content";

const SYSTEM_ACTOR = { displayName: "Chuẩn hóa tiêu đề", id: "system" };
const BATCH_SIZE = 12;

export type HeadlineRegenerationResult = {
	checked: number;
	failed: number;
	skipped: number;
	updated: number;
};

/**
 * Rewrites the title and excerpt of CyberShield35's own articles so they read as
 * complete Vietnamese sentences within the Zalo caps.
 *
 * Many titles were lifted verbatim from source posts and carry the source's own
 * clipping, casing and emoji. Articles already live on Zalo are left alone unless
 * `includePublished` is set, so a bulk pass cannot silently change what followers
 * are currently reading.
 */
export async function regenerateArticleHeadlines(input: {
	force?: boolean;
	includePublished?: boolean;
	limit?: number;
} = {}): Promise<HeadlineRegenerationResult> {
	const limit = Math.max(1, Math.min(5_000, input.limit ?? 1_000));
	const rows = await adminDb
		.select({
			blocks: articles.blocks,
			description: articles.description,
			id: articles.id,
			publicationStatus: articles.publicationStatus,
			title: articles.title,
		})
		.from(articles)
		.orderBy(desc(articles.updatedAt))
		.limit(limit);

	const candidates = rows.filter((row) => {
		if (!input.includePublished && row.publicationStatus === "published") {
			return false;
		}
		if (input.force) return true;
		return !(
			isCleanlyFitted(row.title, ZALO_EDITORIAL_TITLE_LIMIT) &&
			isCleanlyFitted(row.description, ZALO_EDITORIAL_DESCRIPTION_LIMIT)
		);
	});

	let failed = 0;
	let updated = 0;

	for (let offset = 0; offset < candidates.length; offset += BATCH_SIZE) {
		const batch = candidates.slice(offset, offset + BATCH_SIZE);
		const results = await Promise.allSettled(
			batch.map(async (row) => {
				const body = row.blocks
					.filter((block) => block.type === "text")
					.map((block) => (block.type === "text" ? block.content : ""))
					.join("\n\n");
				const fitted = await fitArticleHeadline({
					body,
					description: row.description,
					descriptionLimit: ZALO_EDITORIAL_DESCRIPTION_LIMIT,
					rewriteEvenIfFitting: input.force,
					title: row.title,
					titleLimit: ZALO_EDITORIAL_TITLE_LIMIT,
				});
				if (
					fitted.title === row.title &&
					fitted.description === row.description
				) {
					return false;
				}
				await applyHeadline(row.id, fitted.description, fitted.title);
				return true;
			}),
		);
		for (const result of results) {
			if (result.status === "rejected") failed += 1;
			else if (result.value) updated += 1;
		}
	}

	if (updated) {
		try {
			revalidateTag(ARTICLE_CATALOG_TAG, "max");
		} catch {
			// Standalone scripts run outside a request scope where tag revalidation is
			// unavailable; the catalog picks the change up on its next revalidation.
		}
	}
	return {
		checked: rows.length,
		failed,
		skipped: rows.length - candidates.length,
		updated,
	};
}

async function applyHeadline(
	articleId: string,
	description: string,
	title: string,
) {
	await adminDb.transaction(async (tx) => {
		const [current] = await tx
			.select()
			.from(articles)
			.where(eq(articles.id, articleId))
			.limit(1);
		if (!current) return;

		const snapshot = {
			...prepareZaloArticleContent({
				author: current.author,
				blocks: current.blocks,
				commentsEnabled: current.commentsEnabled,
				coverUrl: current.coverUrl,
				description,
				title,
			}),
			targetOaConnectionId: current.targetOaConnectionId,
		};
		const [latestVersion] = await tx
			.select({ version: articleVersions.version })
			.from(articleVersions)
			.where(eq(articleVersions.articleId, articleId))
			.orderBy(desc(articleVersions.version))
			.limit(1);

		await tx
			.update(articles)
			.set({
				contentHash: hashArticleContent(snapshot),
				description: snapshot.description,
				title: snapshot.title,
				updatedAt: new Date(),
				updatedByDisplayName: SYSTEM_ACTOR.displayName,
				updatedByUserId: SYSTEM_ACTOR.id,
			})
			.where(eq(articles.id, articleId));

		// Keep a restorable version so an editor can undo the rewrite.
		await tx.insert(articleVersions).values({
			actorDisplayName: SYSTEM_ACTOR.displayName,
			actorUserId: SYSTEM_ACTOR.id,
			articleId,
			origin: "ai",
			snapshot,
			version: (latestVersion?.version ?? 0) + 1,
		});
		await tx.insert(auditEvents).values({
			action: "article_headline_regenerated",
			entityId: articleId,
			entityType: "article",
			payload: { actorId: SYSTEM_ACTOR.id },
		});
	});
}

export async function countArticlesNeedingHeadlineFix() {
	const rows = await adminDb
		.select({
			description: articles.description,
			id: articles.id,
			title: articles.title,
		})
		.from(articles);
	return rows.filter(
		(row) =>
			!(
				isCleanlyFitted(row.title, ZALO_EDITORIAL_TITLE_LIMIT) &&
				isCleanlyFitted(row.description, ZALO_EDITORIAL_DESCRIPTION_LIMIT)
			),
	).length;
}

export async function articleIdsWithHeadlineIssues(ids: string[]) {
	if (!ids.length) return [];
	return adminDb
		.select({ id: articles.id })
		.from(articles)
		.where(inArray(articles.id, ids));
}
