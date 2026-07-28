import { z } from "zod";

import { articleIdSchema } from "@/lib/articles/schemas";
import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { actorFromAuth } from "@/lib/chat/http";
import { publicErrorMessage } from "@/lib/http/public-error";
import {
	refreshRemoteArticle,
	removeRemoteArticle,
} from "@/lib/workers/article-publications";

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const article = await refreshRemoteArticle(
			articleIdSchema.parse((await params).id),
		);
		return Response.json({ article }, { headers: authHeaders(auth) });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: "ID bài viết không hợp lệ." }, { status: 400 });
		}
		return Response.json(
			{ error: publicErrorMessage(error, "Không thể làm mới bản Zalo.") },
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
		const article = await removeRemoteArticle(
			articleIdSchema.parse((await params).id),
			actorFromAuth(auth),
		);
		return Response.json({ article }, { headers: authHeaders(auth) });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json(
				{ error: "ID bài viết không hợp lệ." },
				{ status: 400 },
			);
		}
		return Response.json(
			{ error: publicErrorMessage(error, "Không thể xóa bản Zalo.") },
			{ status: 409, headers: authHeaders(auth) },
		);
	}
}
