import { and, asc, desc, isNotNull, ne, sql } from "drizzle-orm";
import { z } from "zod";

import {
	rehostForeignArticleImages,
	type CoverOutcome,
} from "@/lib/articles/cms-media";
import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { adminDb } from "@/lib/db/client";
import { articles } from "@/lib/db/schema";
import { publicErrorMessage } from "@/lib/http/public-error";

const bodySchema = z
	.object({
		// Defaults to a dry run, so a mistaken call only ever reports.
		apply: z.boolean().default(false),
		/**
		 * Kept small on purpose. Each article means a download and an upload, and
		 * an unreachable source burns the full fetch timeout before failing — at
		 * twenty-five the call exceeded the function budget and returned a 504,
		 * losing the work it had already done.
		 */
		limit: z.number().int().min(1).max(12).default(8),
		/**
		 * Where to resume. A cover whose source is already dead cannot be copied
		 * and so never leaves the candidate set — without a position the same
		 * unreachable rows come back every call and the saveable ones behind them
		 * are never reached.
		 */
		offset: z.number().int().min(0).default(0),
	})
	.strict();

export const maxDuration = 300;

/**
 * Copies every article cover we do not host into Tuturuuu CMS storage.
 *
 * Automated drafts inherit the source post's image, which lives behind a signed
 * URL that expires on somebody else's schedule. Once it lapses the image is gone
 * for everyone — Zalo included, which then refuses the article — and no amount
 * of retrying brings it back. So the backlog is worth copying before it rots,
 * and the ones already past saving are worth naming, because only a person can
 * supply a replacement.
 *
 * Batched rather than exhaustive: each call fetches and re-uploads real images,
 * so the work is bounded to what fits the request budget and the caller repeats
 * it until nothing is left.
 */
export async function POST(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const body = await request.json().catch(() => ({}));
		const { apply, limit, offset } = bodySchema.parse(body ?? {});
		const origin = new URL(request.url).origin;

		const candidates = await adminDb
			.select({ id: articles.id, title: articles.title })
			.from(articles)
			.where(
				and(
					isNotNull(articles.coverUrl),
					ne(articles.coverUrl, ""),
					// Anything already on our own origin is done.
					sql`${articles.coverUrl} not like ${`${origin}/%`}`,
				),
			)
			// Ordered so the walk is stable between calls; without it Postgres is
			// free to return a different arbitrary page each time.
			.orderBy(desc(articles.updatedAt), asc(articles.id))
			.limit(limit)
			.offset(offset);

		const outcomes: Record<CoverOutcome, Array<{ id: string; title: string }>> =
			{
				"already-hosted": [],
				missing: [],
				none: [],
				reachable: [],
				rehosted: [],
				unreachable: [],
				"upload-failed": [],
			};

		for (const candidate of candidates) {
			const result = await rehostForeignArticleImages({
				articleId: candidate.id,
				dryRun: !apply,
				requestOrigin: origin,
				session: auth.session,
			});
			outcomes[result.cover].push({
				id: candidate.id,
				title: candidate.title.slice(0, 80),
			});
		}

		const [remaining] = await adminDb
			.select({ count: sql<number>`count(*)::int` })
			.from(articles)
			.where(
				and(
					isNotNull(articles.coverUrl),
					ne(articles.coverUrl, ""),
					sql`${articles.coverUrl} not like ${`${origin}/%`}`,
				),
			);

		return Response.json(
			{
				apply,
				counts: Object.fromEntries(
					Object.entries(outcomes).map(([key, value]) => [key, value.length]),
				),
				outcomes,
				// Where to resume from. Unreachable rows stay in the set, so the
				// caller advances past them rather than re-reading them.
				nextOffset: offset + candidates.length,
				remaining: remaining?.count ?? 0,
				scanned: candidates.length,
			},
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json(
				{ error: "Tham số không hợp lệ." },
				{ headers: authHeaders(auth), status: 400 },
			);
		}
		return Response.json(
			{ error: publicErrorMessage(error, "Không chuyển được ảnh bìa.") },
			{ headers: authHeaders(auth), status: 500 },
		);
	}
}
