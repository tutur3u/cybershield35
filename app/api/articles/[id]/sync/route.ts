import { z } from "zod";

import { articleIdSchema } from "@/lib/articles/schemas";
import {
	publishArticleCmsMedia,
	rehostForeignArticleImages,
} from "@/lib/articles/cms-media";
import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { actorFromAuth } from "@/lib/chat/http";
import { publicErrorMessage } from "@/lib/http/public-error";
import {
	enqueueArticlePublication,
	processArticlePublicationJob,
	ZaloCoverImageError,
} from "@/lib/workers/article-publications";

const requestSchema = z.object({
	omitCoverImage: z.boolean().optional().default(false),
});

/*
 * The Zalo call runs inside this request so the operator gets an answer rather
 * than a spinner. Sixty seconds was not enough for it: creating an article,
 * waiting for Zalo to verify the operation and reading it back can exceed that,
 * and when the function was killed the client saw a bare 504 — "Thao tác không
 * thành công." — while the job stayed locked and the article stuck in `syncing`.
 */
export const maxDuration = 300;

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const id = articleIdSchema.parse((await params).id);
		const input = requestSchema.parse(await request.json().catch(() => ({})));
		// Before anything is offered to Zalo, which fetches image URLs itself and
		// refuses the article when it cannot. This is the only place with an
		// operator session to upload with — the queue worker has none — and since
		// nothing reaches Zalo without a person asking, it covers every path.
		const media = await rehostForeignArticleImages({
			articleId: id,
			requestOrigin: new URL(request.url).origin,
			session: auth.session,
		});
		if (
			!input.omitCoverImage &&
			["unreachable", "upload-failed"].includes(media.cover)
		) {
			throw new ZaloCoverImageError();
		}
		const job = await enqueueArticlePublication(
			id,
			"sync_hidden",
			actorFromAuth(auth),
			undefined,
			{ omitCoverImage: input.omitCoverImage },
		);
		await publishArticleCmsMedia(id, auth.session);
		const result = await processArticlePublicationJob(job.id);
		return Response.json({ job: result }, { headers: authHeaders(auth) });
	} catch (error) {
		if (error instanceof ZaloCoverImageError) {
			return Response.json(
				{ code: error.code, error: error.message },
				{ status: 422, headers: authHeaders(auth) },
			);
		}
		if (error instanceof z.ZodError) {
			return Response.json({ error: "ID bài viết không hợp lệ." }, { status: 400 });
		}
		return Response.json(
			{ error: publicErrorMessage(error, "Không thể đồng bộ Zalo.") },
			{ status: 409, headers: authHeaders(auth) },
		);
	}
}
