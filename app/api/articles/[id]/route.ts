import { z } from "zod";

import { articleIdSchema, articleUpdateSchema } from "@/lib/articles/schemas";
import {
	deleteLocalArticle,
	getArticleDetail,
	updateArticle,
} from "@/lib/articles/store";
import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { actorFromAuth } from "@/lib/chat/http";
import { publicErrorMessage } from "@/lib/http/public-error";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}
	try {
		const article = await getArticleDetail(
			articleIdSchema.parse((await params).id),
		);
		return article
			? Response.json(article, { headers: authHeaders(auth) })
			: Response.json({ error: "Không tìm thấy bài viết." }, { status: 404 });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: "ID bài viết không hợp lệ." }, { status: 400 });
		}
		return Response.json(
			{ error: publicErrorMessage(error, "Không thể tải bài viết.") },
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}
	try {
		const id = articleIdSchema.parse((await params).id);
		const input = articleUpdateSchema.parse(await request.json());
		const article = await updateArticle(id, input, actorFromAuth(auth));
		return article
			? Response.json({ article }, { headers: authHeaders(auth) })
			: Response.json({ error: "Không tìm thấy bài viết." }, { status: 404 });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		}
		return Response.json(
			{
				error: publicErrorMessage(error, "Không thể lưu bài viết."),
			},
			{ status: 409, headers: authHeaders(auth) },
		);
	}
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}
	try {
		const id = articleIdSchema.parse((await params).id);
		const actor = actorFromAuth(auth);
		const deleted = await deleteLocalArticle(id, actor);
		return deleted
			? Response.json({ deleted: true }, { headers: authHeaders(auth) })
			: Response.json(
					{
						error:
							"Bài viết đã đồng bộ với Zalo không thể xóa. Hãy giữ lại để bảo toàn lịch sử.",
					},
					{ status: 409, headers: authHeaders(auth) },
				);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: "ID bài viết không hợp lệ." }, { status: 400 });
		}
		return Response.json(
			{ error: publicErrorMessage(error, "Không thể xóa bài viết.") },
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
