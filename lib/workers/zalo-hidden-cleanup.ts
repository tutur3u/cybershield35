import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";

import { adminDb } from "@/lib/db/client";
import { articles } from "@/lib/db/schema";
import { removeRemoteArticle } from "@/lib/workers/article-publications";

const SYSTEM_ACTOR = { displayName: "Hệ thống", id: "system" } as const;

/**
 * Takes CS35's hidden drafts back off the Zalo Official Account.
 *
 * Earlier behaviour staged every automated draft on the OA as a hidden article
 * so a reviewer could preview it there. The cost landed on someone else: the OA's
 * content manager filled with hundreds of entries nobody had agreed to publish.
 * Drafts now stay in CS35 until a person approves and publishes them, and this
 * clears what the old behaviour left behind.
 *
 * Scope is deliberately narrow, because deleting the wrong thing here is
 * unrecoverable from our side:
 *
 * - only rows CS35 tracks, so an article the OA team wrote by hand is invisible
 *   to this — we never enumerate the OA's own content;
 * - only `hidden`, so nothing a follower can currently see is touched;
 * - `published`, `publishing`, `scheduled` and `syncing` are all excluded, the
 *   last because a removal racing an in-flight sync would leave the two sides
 *   disagreeing about what exists.
 */
export async function removeHiddenZaloDrafts({
	dryRun = false,
	limit = 60,
}: { dryRun?: boolean; limit?: number } = {}) {
	// Sized to finish inside the route's 300s budget. Each removal commits on its
	// own, so a run that is cut short loses nothing — but a batch large enough to
	// be killed mid-flight never reports what it managed to do.
	const candidates = await adminDb
		.select({
			id: articles.id,
			remoteArticleId: articles.remoteArticleId,
			title: articles.title,
		})
		.from(articles)
		.where(
			and(
				eq(articles.publicationStatus, "hidden"),
				isNotNull(articles.remoteArticleId),
				isNotNull(articles.targetOaConnectionId),
			),
		)
		.limit(Math.max(1, Math.min(limit, 500)));

	if (dryRun) {
		return {
			failed: 0,
			removed: 0,
			scanned: candidates.length,
			titles: candidates.map((row) => row.title),
		};
	}

	let failed = 0;
	let removed = 0;
	const failures: Array<{ id: string; message: string }> = [];

	for (const candidate of candidates) {
		try {
			await removeRemoteArticle(candidate.id, SYSTEM_ACTOR);
			removed += 1;
		} catch (error) {
			failed += 1;
			failures.push({
				id: candidate.id,
				message: error instanceof Error ? error.message : "unknown",
			});
		}
	}

	return { failed, failures, removed, scanned: candidates.length };
}
