import { z } from "zod";

import { articleIdSchema } from "@/lib/articles/schemas";
import { uploadArticleCmsMedia } from "@/lib/articles/cms-media";
import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { publicErrorMessage } from "@/lib/http/public-error";
import { logOperation } from "@/lib/operations/telemetry";

export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const articleId = articleIdSchema.parse((await params).id);
		const form = await request.formData();
		const file = form.get("file");
		const kind = form.get("kind");
		if (!(file instanceof File) || (kind !== "cover" && kind !== "inline")) throw new Error("Tệp ảnh hoặc loại ảnh không hợp lệ.");
		const result = await uploadArticleCmsMedia({
			altText: String(form.get("altText") ?? ""),
			articleId,
			caption: String(form.get("caption") ?? ""),
			file,
			kind,
			requestOrigin: new URL(request.url).origin,
			session: auth.session,
		});
		return Response.json(result, { status: 201, headers: authHeaders(auth) });
	} catch (error) {
		logOperation(
			"article_media_upload_failed",
			{
				message: error instanceof Error ? error.message.slice(0, 300) : null,
				name: error instanceof Error ? error.name : null,
			},
			"error",
		);
		return Response.json({ error: publicErrorMessage(error, "Không thể tải ảnh lên Tuturuuu CMS.") }, { status: error instanceof z.ZodError ? 400 : 409, headers: authHeaders(auth) });
	}
}
