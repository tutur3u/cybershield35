import { z } from "zod";

import { importZaloArticle } from "@/lib/articles/store";
import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { actorFromAuth } from "@/lib/chat/http";
import { publicErrorMessage } from "@/lib/http/public-error";
import { listZaloArticleCatalog } from "@/lib/zalo/articles";

const schema = z.object({ remoteArticleId: z.string().trim().min(1).max(500) }).strict();

export async function POST(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const input = schema.parse(await request.json());
		const catalog = await listZaloArticleCatalog();
		const remote = catalog.articles.find((item) => item.remoteArticleId === input.remoteArticleId);
		if (!remote) return Response.json({ error: "Không tìm thấy bài viết trên Zalo OA." }, { status: 404, headers: authHeaders(auth) });
		const result = await importZaloArticle(remote, actorFromAuth(auth));
		return Response.json(result, { status: result.imported ? 201 : 200, headers: authHeaders(auth) });
	} catch (error) {
		return Response.json({ error: publicErrorMessage(error, "Không thể nhập bài viết từ Zalo.") }, { status: error instanceof z.ZodError ? 400 : 409, headers: authHeaders(auth) });
	}
}
