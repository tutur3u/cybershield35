import { z } from "zod";

import { articleIdSchema } from "@/lib/articles/schemas";
import { restoreArticleVersion } from "@/lib/articles/store";
import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { actorFromAuth } from "@/lib/chat/http";
import { publicErrorMessage } from "@/lib/http/public-error";

export async function POST(
	request: Request,
	{
		params,
	}: { params: Promise<{ id: string; versionId: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const values = await params;
		const article = await restoreArticleVersion(
			articleIdSchema.parse(values.id),
			articleIdSchema.parse(values.versionId),
			actorFromAuth(auth),
		);
		return article
			? Response.json({ article }, { headers: authHeaders(auth) })
			: Response.json({ error: "Không tìm thấy phiên bản." }, { status: 404 });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: "ID không hợp lệ." }, { status: 400 });
		}
		return Response.json(
			{ error: publicErrorMessage(error, "Không thể khôi phục.") },
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
