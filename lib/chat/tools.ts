import "server-only";

import { and, desc, eq, ilike, or } from "drizzle-orm";
import { tool } from "ai";
import { z } from "zod";

import { searchAttachmentChunks } from "@/lib/chat/attachments";
import { articleBlockSchema } from "@/lib/articles/schemas";
import {
	getArticleDetail,
	listArticles,
	updateArticle,
} from "@/lib/articles/store";
import type { ChatActor } from "@/lib/chat/types";
import { revalidateDashboardIntelligence, revalidateDashboardScan } from "@/lib/dashboard/cache-invalidation";
import { getIntelligenceOverview, listIntelligenceTopics } from "@/lib/dashboard/intelligence-server";
import { getTimelinePostById, updateEvidenceTriage } from "@/lib/dashboard/timeline-server";
import { adminDb } from "@/lib/db/client";
import {
	auditEvents,
	chatAttachmentChunks,
	chatAttachments,
	chatToolRuns,
	counterArgumentDrafts,
	counterArgumentDraftVersions,
	evidenceItems,
	type EvidenceTriageStatus,
} from "@/lib/db/schema";
import {
	DEFAULT_DRAFT_TONE,
	DEFAULT_DRAFT_VOICE,
} from "@/lib/domain/draft-style";
import { fetchWorkspaceMembersForRequest } from "@/lib/workspace-members/proxy";
import { createScan, getScanDetail, listScansPage } from "@/lib/workers/scans";
import { createRescan, processScanJobNow } from "@/lib/workers/scans";
import { listSafeZaloConnections } from "@/lib/zalo/connections";

type ToolContext = {
	actor: ChatActor;
	conversationId: string;
	modelRunId: string;
	request: Request;
};

export function createChatTools(context: ToolContext) {
	return {
		searchEvidence: tool({
			description: "Tìm bằng chứng chuẩn hóa theo nội dung, nguồn hoặc tác giả.",
			inputSchema: z.object({ query: z.string().trim().min(2).max(200), limit: z.number().int().min(1).max(12).default(6) }),
			execute: async ({ query, limit }, options) =>
				recordTool(context, "searchEvidence", options.toolCallId, { query }, async () => {
					const rows = await adminDb
						.select({
							author: evidenceItems.author,
							id: evidenceItems.id,
							quote: evidenceItems.quote,
							riskLevel: evidenceItems.riskLevel,
							scanJobId: evidenceItems.scanJobId,
							sourceLabel: evidenceItems.sourceLabel,
							summary: evidenceItems.summary,
						})
						.from(evidenceItems)
						.where(
							or(
								ilike(evidenceItems.quote, `%${query}%`),
								ilike(evidenceItems.summary, `%${query}%`),
								ilike(evidenceItems.sourceLabel, `%${query}%`),
								ilike(evidenceItems.author, `%${query}%`),
							),
						)
						.orderBy(desc(evidenceItems.publishedAt), desc(evidenceItems.createdAt))
						.limit(limit);
					return rows.map((row) => ({ ...row, href: `/evidence/${row.id}`, quote: row.quote.slice(0, 500) }));
				}),
		}),
		getEvidence: tool({
			description: "Đọc chi tiết một bằng chứng theo ID chuẩn.",
			inputSchema: z.object({ evidenceId: z.string().uuid() }),
			execute: async ({ evidenceId }, options) =>
				recordTool(context, "getEvidence", options.toolCallId, { evidenceId }, async () => {
					const evidence = await getTimelinePostById(evidenceId);
					return evidence ? { ...evidence, href: `/evidence/${evidence.id}` } : { found: false };
				}),
		}),
		listScans: tool({
			description: "Liệt kê scan gần đây và trạng thái xử lý.",
			inputSchema: z.object({ limit: z.number().int().min(1).max(12).default(6) }),
			execute: async ({ limit }, options) =>
				recordTool(context, "listScans", options.toolCallId, { limit }, async () => {
					const page = await listScansPage({ limit });
					return page.items.map((scan) => ({ ...scan, href: `/scans/${scan.id}` }));
				}),
		}),
		getScan: tool({
			description: "Đọc scan, phân tích, bằng chứng và provider run theo ID.",
			inputSchema: z.object({ scanId: z.string().uuid() }),
			execute: async ({ scanId }, options) =>
				recordTool(context, "getScan", options.toolCallId, { scanId }, async () => {
					const scan = await getScanDetail(scanId);
					return scan
						? {
								analysis: scan.analysis,
								evidence: scan.evidence.slice(0, 8).map((item) => ({
									href: `/evidence/${item.id}`,
									id: item.id,
									quote: item.quote.slice(0, 500),
									riskLevel: item.riskLevel,
									summary: item.summary.slice(0, 500),
								})),
								href: `/scans/${scanId}`,
								job: scan.job,
								providerRuns: scan.providerRuns,
								source: scan.source,
							}
						: { found: false };
				}),
		}),
		listTopics: tool({
			description: "Liệt kê chủ đề intelligence nổi bật, có thể lọc theo từ khóa.",
			inputSchema: z.object({ query: z.string().trim().max(120).optional(), limit: z.number().int().min(1).max(12).default(8) }),
			execute: async ({ query, limit }, options) =>
				recordTool(context, "listTopics", options.toolCallId, { query }, async () =>
					(await listIntelligenceTopics({ filters: query ? { query } : {}, limit })).items,
				),
		}),
		getInsights: tool({
			description: "Đọc KPI, xu hướng, cảnh báo và hành động intelligence hiện tại.",
			inputSchema: z.object({}),
			execute: async (_input, options) =>
				recordTool(context, "getInsights", options.toolCallId, {}, () => getIntelligenceOverview()),
		}),
		listArticles: tool({
			description:
				"Liệt kê bài viết nội bộ, trạng thái duyệt và trạng thái Zalo. Không xuất bản.",
			inputSchema: z.object({ limit: z.number().int().min(1).max(20).default(8) }),
			execute: async ({ limit }, options) =>
				recordTool(context, "listArticles", options.toolCallId, { limit }, async () =>
					(await listArticles()).slice(0, limit).map((row) => ({
						href: `/articles/${row.article.id}`,
						id: row.article.id,
						publicationStatus: row.article.publicationStatus,
						reviewStatus: row.article.reviewStatus,
						title: row.article.title,
						zaloOa: row.oaDisplayName,
					})),
				),
		}),
		getArticle: tool({
			description:
				"Đọc bài viết nội bộ, bằng chứng, phiên bản và trạng thái đồng bộ. Không xuất bản.",
			inputSchema: z.object({ articleId: z.string().uuid() }),
			execute: async ({ articleId }, options) =>
				recordTool(context, "getArticle", options.toolCallId, { articleId }, async () => {
					const detail = await getArticleDetail(articleId);
					return detail
						? {
								article: detail.article,
								evidence: detail.evidence,
								href: `/articles/${articleId}`,
								zaloOa: detail.oaDisplayName,
							}
						: { found: false };
				}),
		}),
		listZaloAccounts: tool({
			description:
				"Liệt kê metadata và tình trạng các Zalo OA đã kết nối. Không trả về token.",
			inputSchema: z.object({}),
			execute: async (_input, options) =>
				recordTool(context, "listZaloAccounts", options.toolCallId, {}, () =>
					listSafeZaloConnections(),
				),
		}),
		searchAttachments: tool({
			description: "Tìm trong các đoạn văn bản đã trích xuất từ tệp của Chat hiện tại.",
			inputSchema: z.object({ query: z.string().trim().min(2).max(200), limit: z.number().int().min(1).max(12).default(8) }),
			execute: async ({ query, limit }, options) =>
				recordTool(context, "searchAttachments", options.toolCallId, { query }, () =>
					searchAttachmentChunks(context.conversationId, query, limit),
				),
		}),
		createDraft: tool({
			description: "Lưu một bản nháp nội bộ để con người xem xét. Không xuất bản ra ngoài.",
			inputSchema: z.object({
				audience: z.string().trim().min(1).max(120).default("Công chúng chung"),
				body: z.string().trim().min(1).max(8000),
				draftKind: z.enum(["response", "comment", "counter_argument", "internal_brief"]),
				evidenceId: z.string().uuid().optional(),
				language: z.string().trim().min(1).max(40).default("vi"),
				length: z.string().trim().min(1).max(40).default("medium"),
				scanId: z.string().uuid().optional(),
				tone: z.string().trim().min(1).max(120).default(DEFAULT_DRAFT_TONE),
				voice: z.string().trim().min(1).max(120).default(DEFAULT_DRAFT_VOICE),
			}).refine((value) => Boolean(value.evidenceId || value.scanId), "Cần evidenceId hoặc scanId."),
			needsApproval: true,
			execute: async (input, options) =>
				recordTool(context, "createDraft", options.toolCallId, safeKeys(input), async () => {
					let scanJobId = input.scanId;
					if (input.evidenceId) {
						const [evidence] = await adminDb
							.select({ scanJobId: evidenceItems.scanJobId })
							.from(evidenceItems)
							.where(eq(evidenceItems.id, input.evidenceId))
							.limit(1);
						if (!evidence) throw new Error("Evidence không tồn tại");
						scanJobId = evidence.scanJobId;
					}
					if (!scanJobId) throw new Error("Scan không tồn tại");
					const draft = await adminDb.transaction(async (tx) => {
						const [created] = await tx
							.insert(counterArgumentDrafts)
							.values({
								audience: input.audience,
								body: input.body,
								createdByDisplayName: context.actor.displayName,
								createdByUserId: context.actor.id,
								draftKind: input.draftKind,
								evidenceItemId: input.evidenceId,
								language: input.language,
								length: input.length,
								originatingChatId: context.conversationId,
								scanJobId,
								status: "needs_review",
								tone: input.tone,
								voice: input.voice,
								updatedByDisplayName: context.actor.displayName,
								updatedByUserId: context.actor.id,
							})
							.returning();
						if (!created) throw new Error("Không thể lưu bản nháp");
						await Promise.all([
							tx.insert(counterArgumentDraftVersions).values({
								actorDisplayName: context.actor.displayName,
								actorUserId: context.actor.id,
								body: input.body,
								draftId: created.id,
								version: 1,
							}),
							tx.insert(auditEvents).values({
								action: "draft_created_from_chat",
								entityId: created.id,
								entityType: "counter_argument_draft",
								payload: { actorId: context.actor.id, draftKind: input.draftKind, evidenceId: input.evidenceId, scanJobId },
							}),
						]);
						return created;
					});
					revalidateDashboardIntelligence("activity");
					return { draftId: draft.id, href: `/drafts/${draft.id}`, status: draft.status };
				}),
		}),
		updateArticleDraft: tool({
			description:
				"Cập nhật bản nháp bài viết nội bộ. Không đồng bộ, lên lịch hoặc xuất bản lên Zalo.",
			inputSchema: z.object({
				articleId: z.string().uuid(),
				author: z.string().trim().max(50).optional(),
				blocks: z.array(articleBlockSchema).max(100).optional(),
				commentsEnabled: z.boolean().optional(),
				coverUrl: z.string().url().max(2_000).nullable().optional(),
				description: z.string().trim().max(300).optional(),
				title: z.string().trim().max(150).optional(),
			}),
			needsApproval: true,
			execute: async ({ articleId, ...patch }, options) =>
				recordTool(
					context,
					"updateArticleDraft",
					options.toolCallId,
					{ articleId, fields: Object.keys(patch) },
					async () => {
						const article = await updateArticle(
							articleId,
							patch,
							context.actor,
							{
								instruction: "Cập nhật từ Chat sau khi người dùng phê duyệt",
								origin: "ai",
							},
						);
						if (!article) throw new Error("Bài viết không tồn tại");
						return {
							articleId: article.id,
							href: `/articles/${article.id}`,
							publicationStatus: article.publicationStatus,
						};
					},
				),
		}),
		runScanNow: tool({
			description:
				"Chạy ngay scan đang chờ, hoặc tạo một lượt quét lại có liên kết. Cần người dùng phê duyệt.",
			inputSchema: z.object({ scanId: z.string().uuid() }),
			needsApproval: true,
			execute: async ({ scanId }, options) =>
				recordTool(context, "runScanNow", options.toolCallId, { scanId }, async () => {
					const detail = await getScanDetail(scanId);
					if (!detail) throw new Error("Scan không tồn tại");
					let targetId = scanId;
					if (!["queued", "retrying"].includes(detail.job.status)) {
						const rescan = await createRescan(scanId, context.actor);
						if (!rescan) throw new Error("Không thể tạo lượt quét lại");
						targetId = rescan.scanId;
						if (rescan.deduplicated) {
							return {
								deduplicated: true,
								href: `/scans/${targetId}`,
								scanId: targetId,
								status: rescan.status,
							};
						}
					}
					const result = await processScanJobNow(targetId);
					revalidateDashboardScan(targetId);
					return { ...result, href: `/scans/${targetId}`, scanId: targetId };
				}),
		}),
		createScanFromAttachment: tool({
			description: "Tạo scan mới từ một tệp Chat đã xử lý.",
			inputSchema: z.object({ attachmentId: z.string().uuid(), title: z.string().trim().min(1).max(200).optional() }),
			needsApproval: true,
			execute: async ({ attachmentId, title }, options) =>
				recordTool(context, "createScanFromAttachment", options.toolCallId, { attachmentId }, async () => {
					const [attachment] = await adminDb
						.select()
						.from(chatAttachments)
						.where(and(eq(chatAttachments.id, attachmentId), eq(chatAttachments.conversationId, context.conversationId), eq(chatAttachments.status, "ready")))
						.limit(1);
					if (!attachment) throw new Error("Tệp chưa xử lý xong");
					const chunks = await adminDb
						.select({ content: chatAttachmentChunks.content })
						.from(chatAttachmentChunks)
						.where(eq(chatAttachmentChunks.attachmentId, attachment.id))
						.orderBy(chatAttachmentChunks.ordinal)
						.limit(40);
					const result = await createScan({
						fileName: attachment.fileName,
						fileText: chunks.map((chunk) => chunk.content).join("\n").slice(0, 40_000),
						input: attachment.fileName,
						mimeType: attachment.contentType,
						title: title ?? attachment.fileName,
					});
					revalidateDashboardScan(result.scanId);
					return { ...result, href: `/scans/${result.scanId}` };
				}),
		}),
		updateEvidenceTriage: tool({
			description: "Cập nhật trạng thái, ghim, hạn hoặc người phụ trách của bằng chứng.",
			inputSchema: z.object({
				assigneeUserId: z.string().uuid().nullable().optional(),
				dueAt: z.string().datetime({ offset: true }).nullable().optional(),
				evidenceId: z.string().uuid(),
				isPinned: z.boolean().optional(),
				status: z.enum(["new", "reviewing", "action_required", "resolved", "dismissed"]).optional(),
			}),
			needsApproval: true,
			execute: async (input, options) =>
				recordTool(context, "updateEvidenceTriage", options.toolCallId, safeKeys(input), async () => {
					let assigneeDisplayName: string | null | undefined;
					if (input.assigneeUserId !== undefined) {
						if (input.assigneeUserId === null) assigneeDisplayName = null;
						else {
							const members = await fetchWorkspaceMembersForRequest(context.request);
							const member = members.members.find((candidate) => candidate.id === input.assigneeUserId);
							if (!member) throw new Error("Người phụ trách không thuộc workspace");
							assigneeDisplayName = member.displayName ?? member.email ?? member.id;
						}
					}
					const triage = await updateEvidenceTriage(
						input.evidenceId,
						{
							...(assigneeDisplayName !== undefined ? { assigneeDisplayName } : {}),
							...(input.assigneeUserId !== undefined ? { assigneeUserId: input.assigneeUserId } : {}),
							...(input.dueAt !== undefined ? { dueAt: input.dueAt ? new Date(input.dueAt) : null } : {}),
							...(input.isPinned !== undefined ? { isPinned: input.isPinned } : {}),
							...(input.status ? { status: input.status as EvidenceTriageStatus } : {}),
						},
						context.actor,
					);
					revalidateDashboardIntelligence("timeline");
					return { evidenceId: input.evidenceId, href: `/evidence/${input.evidenceId}`, triage };
				}),
		}),
	};
}

async function recordTool<T>(
	context: ToolContext,
	toolName: string,
	toolCallId: string,
	inputSummary: Record<string, unknown>,
	execute: () => Promise<T>,
) {
	const [run] = await adminDb
		.insert(chatToolRuns)
		.values({ modelRunId: context.modelRunId, toolCallId, toolName, status: "running", inputSummary })
		.onConflictDoUpdate({
			set: { inputSummary, startedAt: new Date(), status: "running" },
			target: [chatToolRuns.modelRunId, chatToolRuns.toolCallId],
		})
		.returning();
	try {
		const output = await execute();
		if (run) {
			await adminDb
				.update(chatToolRuns)
				.set({ completedAt: new Date(), outputSummary: summarizeOutput(output), status: "completed" })
				.where(eq(chatToolRuns.id, run.id));
		}
		return output;
	} catch (error) {
		if (run) {
			await adminDb
				.update(chatToolRuns)
				.set({ completedAt: new Date(), errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Tool failed", status: "failed" })
				.where(eq(chatToolRuns.id, run.id));
		}
		throw error;
	}
}

function safeKeys(input: Record<string, unknown>) {
	return Object.fromEntries(
		Object.entries(input)
			.filter(([key]) => !["body", "note", "content"].includes(key))
			.map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 120) : value]),
	);
}

function summarizeOutput(output: unknown): Record<string, unknown> {
	if (Array.isArray(output)) return { count: output.length };
	if (output && typeof output === "object") {
		return Object.fromEntries(
			Object.entries(output as Record<string, unknown>)
				.filter(([key]) => !["body", "content", "note", "quote", "summary"].includes(key))
				.slice(0, 12),
		);
	}
	return { ok: true };
}
