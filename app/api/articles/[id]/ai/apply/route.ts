import { z } from "zod";

import {
	articleContentSchema,
	articleIdSchema,
} from "@/lib/articles/schemas";
import { updateArticle } from "@/lib/articles/store";
import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { actorFromAuth } from "@/lib/chat/http";
import { publicErrorMessage } from "@/lib/http/public-error";

const bodySchema = z
	.object({
		content: articleContentSchema,
		instruction: z.string().trim().max(2_000).optional(),
	})
	.strict();

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const id = articleIdSchema.parse((await params).id);
		const input = bodySchema.parse(await request.json());
		const article = await updateArticle(id, input.content, actorFromAuth(auth), {
			instruction: input.instruction,
			origin: "ai",
		});
		return article
			? Response.json({ article }, { headers: authHeaders(auth) })
			: Response.json({ error: "Không tìm thấy bài viết." }, { status: 404 });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		}
		return Response.json(
			{ error: publicErrorMessage(error, "Không thể áp dụng đề xuất.") },
			{ status: 409, headers: authHeaders(auth) },
		);
	}
}
