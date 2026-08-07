import { z } from "zod";

import {
	articleAiSchema,
	articleIdSchema,
} from "@/lib/articles/schemas";
import { getArticleDetail } from "@/lib/articles/store";
import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { publicErrorMessage } from "@/lib/http/public-error";
import { generateArticleRevision } from "@/lib/llm/generation";
import { fitArticleHeadline } from "@/lib/llm/text-fitting";
import {
	ZALO_EDITORIAL_DESCRIPTION_LIMIT,
	ZALO_EDITORIAL_TITLE_LIMIT,
} from "@/lib/zalo/article-content";

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
		const currentContent = {
			author: detail.article.author,
			blocks: detail.article.blocks,
			commentsEnabled: detail.article.commentsEnabled,
			coverUrl: detail.article.coverUrl,
			description: detail.article.description,
			title: detail.article.title,
		};
		const proposal = await generateArticleRevision({
			...input,
			content: currentContent,
			evidence: detail.evidence.map((item) => ({
				id: item.id,
				quote: item.quote,
				summary: item.summary,
			})),
			session: auth.session,
		});
		if (input.action === "description") {
			// A field-level shortcut must never smuggle unrelated model edits into
			// the review dialog. Only its newly generated excerpt is retained.
			const generatedDescription = proposal.description;
			Object.assign(proposal, currentContent, {
				description: generatedDescription,
			});
		}
		// Models regularly overshoot the Zalo caps by a few words. Rewrite the
		// headline to fit before the operator compares it, so the diff they review
		// is the same text that would be stored.
		const fitted = await fitArticleHeadline({
			body: proposal.blocks
				.filter((block) => block.type === "text")
				.map((block) => (block.type === "text" ? block.content : ""))
				.join("\n\n"),
			description: proposal.description,
			descriptionLimit: ZALO_EDITORIAL_DESCRIPTION_LIMIT,
			rewriteEvenIfFitting: input.action === "description",
			title: proposal.title,
			titleLimit: ZALO_EDITORIAL_TITLE_LIMIT,
		}).catch(() => null);
		if (fitted) {
			proposal.description = fitted.description;
			if (input.action !== "description") proposal.title = fitted.title;
		}

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
