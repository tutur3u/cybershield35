import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { createArticle, listArticles } from "@/lib/articles/store";
import { articleCreateSchema } from "@/lib/articles/schemas";
import { actorFromAuth } from "@/lib/chat/http";
import { publicErrorMessage } from "@/lib/http/public-error";
import { listZaloArticleCatalog } from "@/lib/zalo/articles";

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}
	try {
		const [articles, zalo] = await Promise.all([
			listArticles(),
			listZaloArticleCatalog(),
		]);
		return Response.json(
			{
				articles,
				zaloArticles: zalo.articles,
				zaloIssues: zalo.issues,
			},
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		return Response.json(
			{
				error: publicErrorMessage(error, "Không thể tải bài viết."),
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}

export async function POST(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}
	try {
		const input = articleCreateSchema.parse(await request.json());
		const article = await createArticle(input, actorFromAuth(auth));
		return Response.json(
			{ article },
			{ status: 201, headers: authHeaders(auth) },
		);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		}
		return Response.json(
			{
				error: publicErrorMessage(error, "Không thể tạo bài viết."),
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
