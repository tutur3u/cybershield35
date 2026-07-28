import { z } from "zod";

import { articleIdSchema, articleReviewSchema } from "@/lib/articles/schemas";
import { setArticleReviewStatus } from "@/lib/articles/store";
import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { actorFromAuth } from "@/lib/chat/http";
import { publicErrorMessage } from "@/lib/http/public-error";

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const id = articleIdSchema.parse((await params).id);
		const { status } = articleReviewSchema.parse(await request.json());
		const article = await setArticleReviewStatus(id, status, actorFromAuth(auth));
		return article
			? Response.json({ article }, { headers: authHeaders(auth) })
			: Response.json({ error: "Không tìm thấy bài viết." }, { status: 404 });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		}
		return Response.json(
			{ error: publicErrorMessage(error, "Không thể duyệt bài viết.") },
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
