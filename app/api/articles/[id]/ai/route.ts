import { z } from "zod";

import {
	articleAiSchema,
	articleIdSchema,
} from "@/lib/articles/schemas";
import { getArticleDetail } from "@/lib/articles/store";
import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { publicErrorMessage } from "@/lib/http/public-error";
import { generateArticleRevision } from "@/lib/llm/generation";

export const maxDuration = 60;

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const id = articleIdSchema.parse((await params).id);
		const input = articleAiSchema.parse(await request.json());
		const detail = await getArticleDetail(id);
		if (!detail) {
			return Response.json({ error: "Không tìm thấy bài viết." }, { status: 404 });
		}
		const proposal = await generateArticleRevision({
			...input,
			content: {
				author: detail.article.author,
				blocks: detail.article.blocks,
				commentsEnabled: detail.article.commentsEnabled,
				coverUrl: detail.article.coverUrl,
				description: detail.article.description,
				title: detail.article.title,
			},
			evidence: detail.evidence.map((item) => ({
				id: item.id,
				quote: item.quote,
				summary: item.summary,
			})),
			session: auth.session,
		});
		return Response.json(
			{
				proposal,
				summary: {
					blockCountAfter: proposal.blocks.length,
					blockCountBefore: detail.article.blocks.length,
					contentHashBefore: detail.article.contentHash,
				},
			},
			{ headers: authHeaders(auth) },
		);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		}
		return Response.json(
			{
				error: publicErrorMessage(
					error,
					"Không thể tạo đề xuất bằng AI.",
				),
			},
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}
