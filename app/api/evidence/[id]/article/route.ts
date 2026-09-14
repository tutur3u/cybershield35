import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
	buildAutomatedArticleSeed,
	normalizeAutomatedArticleContent,
} from "@/lib/articles/automation-content";
import { articleCompletionIssues, ArticleGenerationError } from "@/lib/llm/article-completion";
import { createArticle, setArticleReviewStatus } from "@/lib/articles/store";
import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { actorFromAuth } from "@/lib/chat/http";
import { adminDb } from "@/lib/db/client";
import {
	evidenceItems,
	facebookPageProfiles,
	zaloOaConnections,
} from "@/lib/db/schema";
import { facebookPageIdentity } from "@/lib/domain/facebook-page-policy";
import { publicErrorMessage } from "@/lib/http/public-error";
import { generateArticleRevision } from "@/lib/llm/generation";

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z
	.object({
		editorialIntent: z
			.enum(["counter_argument", "support", "balanced"])
			.optional(),
		instruction: z.string().trim().max(2_000).optional(),
		tone: z.string().trim().min(1).max(120).default("Điềm tĩnh, khách quan"),
		useAi: z.literal(true).default(true),
		voice: z.string().trim().min(1).max(120).default("Tự nhiên, gần gũi"),
	})
	.strict();

export const maxDuration = 120;

/**
 * Creates an editable article seeded from a single timeline post so operators land
 * in the editor with the title, summary, cover and evidence link already filled in
 * instead of an empty shell.
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}

	try {
		const { id } = paramsSchema.parse(await params);
		const input = bodySchema.parse(
			await request.json().catch(() => ({})),
		);
		const [evidence] = await adminDb
			.select()
			.from(evidenceItems)
			.where(eq(evidenceItems.id, id))
			.limit(1);
		if (!evidence) {
			return Response.json(
				{ error: "Bằng chứng không tồn tại." },
				{ status: 404, headers: authHeaders(auth) },
			);
		}

		const classification = await pageClassification(evidence);
		const intent =
			input.editorialIntent ??
			(classification === "at_risk"
				? "counter_argument"
				: classification === "trusted"
					? "support"
					: "balanced");
		const draftKind =
			intent === "counter_argument"
				? ("counter_argument" as const)
				: intent === "support"
					? ("response" as const)
					: ("internal_brief" as const);
		const seed = buildAutomatedArticleSeed({
			body: "",
			draftKind,
			evidence: {
				metadata: evidence.metadata as Record<string, unknown>,
				quote: evidence.quote,
				summary: evidence.summary,
			},
		});

		let content;
		try {
			const proposal = await generateArticleRevision({
				action: "draft",
				content: seed,
				editorialIntent: intent,
				evidence: [{ id: evidence.id, quote: evidence.quote, summary: evidence.summary }],
				generationMode: "operator",
				instruction: input.instruction ??
					"Viết bài hoàn chỉnh từ đầu đến cuối, bám sát nguồn, có phân tích và kết luận trọn ý. Không để chỗ trống hoặc yêu cầu người viết bổ sung nội dung.",
				session: auth.session,
				tone: input.tone,
				voice: input.voice,
			});
			content = normalizeAutomatedArticleContent(seed, proposal);
			// Validate the representation that will actually be stored, too.
			if (articleCompletionIssues(content, "draft").length) {
				throw new ArticleGenerationError();
			}
		} catch (error) {
			console.error("[article-generation:failed]", {
				evidenceId: id,
				errorType: error instanceof Error ? error.name : "unknown",
			});
			// Never persist a source excerpt or a template as a successful AI draft.
			return Response.json(
				{ error: "AI chưa tạo được bài viết hoàn chỉnh. Chưa lưu bài viết. Vui lòng thử lại.", code: "ARTICLE_GENERATION_FAILED" },
				{ status: 502, headers: authHeaders(auth) },
			);
		}

		const [defaultOa] = await adminDb
			.select({ id: zaloOaConnections.id })
			.from(zaloOaConnections)
			.where(
				and(
					eq(zaloOaConnections.isDefault, true),
					eq(zaloOaConnections.status, "connected"),
				),
			)
			.limit(1);
		// One evidence item may support multiple editorial treatments. Every explicit
		// request creates a fresh article; never reuse a prior originEvidenceItemId.
		const article = await createArticle(
			{
				...content,
				originEvidenceItemId: evidence.id,
				originScanJobId: evidence.scanJobId,
				targetOaConnectionId: defaultOa?.id ?? null,
			},
			actorFromAuth(auth),
		);
		await setArticleReviewStatus(
			article.id,
			"needs_review",
			actorFromAuth(auth),
		);

		return Response.json(
			{ article, href: `/articles/${article.id}`, mode: "ai" },
			{ status: 201, headers: authHeaders(auth) },
		);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return Response.json(
				{ error: z.treeifyError(error) },
				{ status: 400, headers: authHeaders(auth) },
			);
		}
		return Response.json(
			{ error: publicErrorMessage(error, "Không thể tạo bài viết từ bằng chứng.") },
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}

async function pageClassification(evidence: typeof evidenceItems.$inferSelect) {
	const metadata = evidence.metadata as Record<string, unknown>;
	const identity = facebookPageIdentity({
		author: evidence.author,
		facebookPageId:
			typeof metadata.facebookId === "string" ? metadata.facebookId : null,
		sourceUrl: evidence.sourceUrl,
	});
	if (!identity.pageKey) return "uncategorized" as const;
	const [profile] = await adminDb
		.select({ classification: facebookPageProfiles.classification })
		.from(facebookPageProfiles)
		.where(eq(facebookPageProfiles.pageKey, identity.pageKey))
		.limit(1);
	return profile?.classification ?? ("uncategorized" as const);
}
