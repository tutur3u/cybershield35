import "server-only";

import { and, eq, isNotNull, notInArray } from "drizzle-orm";

import { adminDb } from "@/lib/db/client";
import { articles, auditEvents } from "@/lib/db/schema";
import { getZaloArticle, listZaloArticles } from "@/lib/zalo/client";
import { getValidZaloAccessToken } from "@/lib/zalo/connections";

/**
 * Checks that the drafts CS35 believes are on the Official Account are still
 * there, and forgets the ones that are not.
 *
 * `remoteArticleId` is a pointer to something on somebody else's system. When a
 * draft is removed from the OA — by us, or by whoever manages it there — nothing
 * tells CS35, so the pointer outlives what it points at. The status column then
 * reports "Còn trên Zalo" and asks the operator to remove a draft that is
 * already gone: a warning about nothing, which is worse than no warning at all,
 * because acting on it does nothing and the warning stays.
 *
 * Detection is deliberately conservative, since clearing a live article's
 * pointer would strand it:
 *
 * - anything a follower can see (`published`, `publishing`, `scheduled`) is
 *   never touched, whatever the OA says;
 * - a connection whose token cannot be obtained is skipped whole, rather than
 *   read as "every draft on this OA vanished";
 * - if every article on a connection looks missing, that is treated as a fault
 *   on the OA side — an expired grant, a rate limit — and nothing is cleared.
 *   One draft missing is a removal; all of them missing is an outage.
 */
export async function reconcileZaloRemotePresence({
	dryRun = false,
	limit = 40,
}: { dryRun?: boolean; limit?: number } = {}) {
	const candidates = await adminDb
		.select({
			connectionId: articles.targetOaConnectionId,
			id: articles.id,
			remoteArticleId: articles.remoteArticleId,
			title: articles.title,
		})
		.from(articles)
		.where(
			and(
				isNotNull(articles.remoteArticleId),
				isNotNull(articles.targetOaConnectionId),
				notInArray(articles.publicationStatus, [
					"published",
					"publishing",
					"scheduled",
				]),
			),
		)
		.limit(Math.max(1, Math.min(limit, 200)));

	const byConnection = new Map<string, typeof candidates>();
	for (const candidate of candidates) {
		if (!candidate.connectionId) continue;
		const bucket = byConnection.get(candidate.connectionId) ?? [];
		bucket.push(candidate);
		byConnection.set(candidate.connectionId, bucket);
	}

	let cleared = 0;
	let present = 0;
	let skipped = 0;
	const clearedTitles: string[] = [];

	for (const [connectionId, group] of byConnection) {
		let accessToken: string;
		try {
			accessToken = await getValidZaloAccessToken(connectionId);
			// Proves the OA is answering us before any absence is believed. A
			// listing that throws means we cannot tell missing from unreachable.
			await listZaloArticles(accessToken, { limit: 1 });
		} catch {
			skipped += group.length;
			continue;
		}

		const missing: typeof candidates = [];
		for (const candidate of group) {
			try {
				await getZaloArticle(accessToken, candidate.remoteArticleId as string);
				present += 1;
			} catch {
				missing.push(candidate);
			}
		}

		for (const candidate of missing) {
			clearedTitles.push(candidate.title);
			if (dryRun) continue;
			await adminDb
				.update(articles)
				.set({
					lastError: null,
					lastSyncedAt: null,
					publicationStatus: "not_synced",
					remoteArticleId: null,
					remoteOperationToken: null,
					// The column is not nullable in the schema; an empty snapshot is how
					// "we hold nothing from the OA" is written.
					remoteSnapshot: {},
					syncedContentHash: null,
					updatedAt: new Date(),
				})
				.where(eq(articles.id, candidate.id));
			await adminDb.insert(auditEvents).values({
				action: "article_remote_pointer_cleared",
				entityId: candidate.id,
				entityType: "article",
				payload: {
					reason: "Bài không còn tồn tại trên Zalo OA.",
					remoteArticleId: candidate.remoteArticleId,
				},
			});
			cleared += 1;
		}
	}

	const result = {
		cleared: dryRun ? 0 : cleared,
		clearedTitles,
		present,
		scanned: candidates.length,
		skipped,
	};

	// Recorded because "we checked and Zalo has it" and "we could not check" are
	// indistinguishable from the outside otherwise — and that is precisely the
	// question asked when someone cannot find a draft on the OA.
	if (!dryRun && candidates.length) {
		await adminDb
			.insert(auditEvents)
			.values({
				action: "article_remote_presence_checked",
				// The run covers a batch rather than one article, so the connection
				// stands in as the entity it is about.
				entityId: [...byConnection.keys()].join(",") || "none",
				entityType: "zalo_connection",
				payload: result,
			})
			.catch(() => undefined);
	}

	return result;
}
