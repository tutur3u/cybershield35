import "server-only";

import { and, eq } from "drizzle-orm";

import {
	buildAutomatedArticleSeed,
	normalizeAutomatedArticleContent,
} from "@/lib/articles/automation-content";
import {
	createArticle,
	setArticleReviewStatus,
	updateArticle,
} from "@/lib/articles/store";
import { adminDb } from "@/lib/db/client";
import {
	articles,
	counterArgumentDrafts,
	evidenceItems,
	zaloOaConnections,
} from "@/lib/db/schema";
import { generateArticleRevision } from "@/lib/llm/generation";

const SYSTEM_ACTOR = {
	displayName: "Tự động từ scan",
	id: "system",
};

export async function prepareAndSyncAutomatedArticleDraft(input: {
	draftId: string;
	evidenceId: string;
}) {
	const [[draft], [evidence], [defaultOa], [existing]] = await Promise.all([
		adminDb
			.select()
			.from(counterArgumentDrafts)
			.where(eq(counterArgumentDrafts.id, input.draftId))
			.limit(1),
		adminDb
			.select()
			.from(evidenceItems)
			.where(eq(evidenceItems.id, input.evidenceId))
			.limit(1),
		adminDb
			.select()
			.from(zaloOaConnections)
			.where(
				and(
					eq(zaloOaConnections.isDefault, true),
					eq(zaloOaConnections.status, "connected"),
				),
			)
			.limit(1),
		adminDb
			.select()
			.from(articles)
			.where(eq(articles.originDraftId, input.draftId))
			.limit(1),
	]);

	if (!draft || !evidence) {
		throw new Error("Không thể chuẩn bị bài viết vì bản nháp hoặc bằng chứng không còn.");
	}

	let article = existing;
	let preparationMode: "ai" | "fallback" | "existing" = existing
		? "existing"
		: "fallback";
	if (!article) {
		const seed = buildAutomatedArticleSeed({
			body: draft.body,
			draftKind: draft.draftKind,
			evidence,
		});
		let content = seed;
		try {
			const proposal = await generateArticleRevision({
				action: "draft",
				content: seed,
				editorialIntent:
					draft.draftKind === "counter_argument"
						? "counter_argument"
						: draft.draftKind === "response"
							? "support"
							: "balanced",
				evidence: [
					{
						id: evidence.id,
						quote: evidence.quote,
						summary: evidence.summary,
					},
				],
				generationMode: "automatic",
				instruction:
					"Chuẩn bị một bài hoàn chỉnh, tự nhiên và trôi chảy để biên tập viên duyệt. Mở đầu trực tiếp, phát triển lập luận rõ ràng, giữ nguyên mọi giới hạn của bằng chứng và không nhắc đến quy trình tự động.",
				tone: draft.tone,
				voice: draft.voice,
			});
			content = normalizeAutomatedArticleContent(seed, proposal);
			preparationMode = "ai";
		} catch {
			// The evidence-grounded short draft remains a safe local fallback when
			// unattended AI preparation is temporarily unavailable.
		}

		article = await createArticle(
			{
				...content,
				originDraftId: draft.id,
				originEvidenceItemId: evidence.id,
				originScanJobId: evidence.scanJobId,
				targetOaConnectionId: defaultOa?.id ?? null,
			},
			SYSTEM_ACTOR,
		);
		await setArticleReviewStatus(article.id, "needs_review", SYSTEM_ACTOR);
	} else if (!article.targetOaConnectionId && defaultOa) {
		article =
			(await updateArticle(
				article.id,
				{ targetOaConnectionId: defaultOa.id },
				SYSTEM_ACTOR,
				{
					instruction: "Chọn Zalo OA mặc định cho bản nháp tự động",
					origin: "manual",
				},
			)) ?? article;
	}

	return {
		articleId: article.id,
		preparationMode,
		zaloStatus: "awaiting_explicit_approval",
	} as const;
}
