import { z } from "zod";

import { articleIdSchema, articleScheduleSchema } from "@/lib/articles/schemas";
import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { actorFromAuth } from "@/lib/chat/http";
import { publicErrorMessage } from "@/lib/http/public-error";
import {
	cancelScheduledArticle,
	enqueueArticlePublication,
} from "@/lib/workers/article-publications";

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const id = articleIdSchema.parse((await params).id);
		const { scheduledAt } = articleScheduleSchema.parse(await request.json());
		const date = new Date(scheduledAt);
		if (date.getTime() < Date.now() + 60_000) {
			return Response.json(
				{ error: "Thời điểm xuất bản phải cách hiện tại ít nhất một phút." },
				{ status: 400 },
			);
		}
		const job = await enqueueArticlePublication(
			id,
			"publish",
			actorFromAuth(auth),
			date,
		);
		return Response.json({ job }, { status: 201, headers: authHeaders(auth) });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		}
		return Response.json(
			{ error: publicErrorMessage(error, "Không thể lên lịch.") },
			{ status: 409, headers: authHeaders(auth) },
		);
	}
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const article = await cancelScheduledArticle(
			articleIdSchema.parse((await params).id),
			actorFromAuth(auth),
		);
		return article
			? Response.json({ article }, { headers: authHeaders(auth) })
			: Response.json({ error: "Bài viết không có lịch đang chờ." }, { status: 404 });
	} catch (error) {
		return Response.json(
			{ error: publicErrorMessage(error, "Không thể hủy lịch.") },
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
