import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
	buildAutomatedArticleSeed,
	normalizeAutomatedArticleContent,
} from "@/lib/articles/automation-content";
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
		useAi: z.boolean().default(true),
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
			body: scaffoldBody(evidence, intent),
			draftKind,
			evidence: {
				metadata: evidence.metadata as Record<string, unknown>,
				quote: evidence.quote,
				summary: evidence.summary,
			},
		});

		let content = seed;
		let mode: "ai" | "scaffold" = "scaffold";
		if (input.useAi) {
			try {
				const proposal = await generateArticleRevision({
					action: "draft",
					content: seed,
					editorialIntent: intent,
					evidence: [
						{
							id: evidence.id,
							quote: evidence.quote,
							summary: evidence.summary,
						},
					],
					generationMode: "operator",
					instruction:
						input.instruction ??
						"Viết bản đầu hoàn chỉnh, tự nhiên, bám sát bằng chứng đang mở để biên tập viên hoàn thiện. Không nhắc đến quy trình tự động.",
					session: auth.session,
					tone: input.tone,
					voice: input.voice,
				});
				content = normalizeAutomatedArticleContent(seed, proposal);
				mode = "ai";
			} catch {
				// A scaffold from the evidence itself is a usable starting point when the
				// model is unavailable; the operator can still edit and publish.
			}
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
			{ article, href: `/articles/${article.id}`, mode },
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

function scaffoldBody(
	evidence: typeof evidenceItems.$inferSelect,
	intent: "balanced" | "counter_argument" | "support",
) {
	const opener =
		intent === "counter_argument"
			? "Thông tin đang lan truyền cần được đối chiếu lại với dữ kiện đã ghi nhận."
			: intent === "support"
				? "Nội dung dưới đây đã được ghi nhận và có giá trị tham khảo cho người đọc."
				: "Dưới đây là những gì đã ghi nhận được quanh nội dung đang được chia sẻ.";

	return [
		opener,
		evidence.summary?.trim(),
		evidence.quote?.trim()
			? `Trích nội dung gốc: “${evidence.quote.trim().slice(0, 600)}”`
			: "",
		"Phần phân tích, dữ kiện bổ sung và kết luận sẽ được biên tập viên hoàn thiện tại đây.",
	]
		.filter(Boolean)
		.join("\n\n");
}
