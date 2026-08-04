import { z } from "zod";

import { articleIdSchema } from "@/lib/articles/schemas";
import { publishArticleInternally } from "@/lib/articles/store";
import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { actorFromAuth } from "@/lib/chat/http";
import { publicErrorMessage } from "@/lib/http/public-error";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const article = await publishArticleInternally(articleIdSchema.parse((await params).id), actorFromAuth(auth));
		return Response.json({ article }, { headers: authHeaders(auth) });
	} catch (error) {
		return Response.json(
			{ error: publicErrorMessage(error, "Không thể xuất bản bài viết.") },
			{ status: error instanceof z.ZodError ? 400 : 409, headers: authHeaders(auth) },
		);
	}
}
