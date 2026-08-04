import { z } from "zod";

import { articleIdSchema } from "@/lib/articles/schemas";
import { publishArticleCmsMedia } from "@/lib/articles/cms-media";
import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { actorFromAuth } from "@/lib/chat/http";
import { publicErrorMessage } from "@/lib/http/public-error";
import {
	enqueueArticlePublication,
	processArticlePublicationJob,
} from "@/lib/workers/article-publications";

export const maxDuration = 60;

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const id = articleIdSchema.parse((await params).id);
		const job = await enqueueArticlePublication(
			id,
			"sync_hidden",
			actorFromAuth(auth),
		);
		await publishArticleCmsMedia(id, auth.session);
		const result = await processArticlePublicationJob(job.id);
		return Response.json({ job: result }, { headers: authHeaders(auth) });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: "ID bài viết không hợp lệ." }, { status: 400 });
		}
		return Response.json(
			{ error: publicErrorMessage(error, "Không thể đồng bộ Zalo.") },
			{ status: 409, headers: authHeaders(auth) },
		);
	}
}
