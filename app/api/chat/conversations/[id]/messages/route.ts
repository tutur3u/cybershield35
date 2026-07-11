import { and, eq, inArray } from "drizzle-orm";
import {
	consumeStream,
	createAgentUIStreamResponse,
	type InferAgentUIMessage,
	stepCountIs,
	ToolLoopAgent,
	validateUIMessages,
} from "ai";
import { z } from "zod";

import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";
import { actorFromAuth } from "@/lib/chat/http";
import { createChatTools } from "@/lib/chat/tools";
import {
	getChatConversation,
	persistChatMessage,
	requireOwnedChatConversation,
} from "@/lib/chat/store";
import {
	conversationIdSchema,
	sendMessageSchema,
	type ChatUIMessage,
} from "@/lib/chat/types";
import { adminDb } from "@/lib/db/client";
import {
	chatAttachments,
	chatModelRuns,
} from "@/lib/db/schema";
import { getChatModelRuntime } from "@/lib/llm/generation";

export const maxDuration = 60;

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
	let activeModelRunId: string | null = null;

	try {
		const conversationId = conversationIdSchema.parse((await params).id);
		const conversation = await requireOwnedChatConversation(
			conversationId,
			auth.session.user.id,
		);
		if (!conversation) {
			return Response.json(
				{ error: "Chat được chia sẻ chỉ có thể đọc. Hãy tạo bản sao để tiếp tục." },
				{ status: 403 },
			);
		}

		const runtime = getChatModelRuntime();
		if (!runtime) {
			return Response.json({ error: "LLM provider is not configured" }, { status: 503 });
		}
		const input = sendMessageSchema.parse(await request.json());
		const chat = await getChatConversation(conversationId, auth.session.user.id);
		if (!chat) return Response.json({ error: "Không tìm thấy Chat." }, { status: 404 });

		const actor = actorFromAuth(auth);
		const incoming = input.message as ChatUIMessage;
		const storedIncoming = await persistChatMessage(
			conversationId,
			incoming,
			incoming.role === "user" ? actor : undefined,
		);
		const attachmentIds = attachmentIdsFromMessage(incoming);
		if (storedIncoming && attachmentIds.length > 0) {
			await adminDb
				.update(chatAttachments)
				.set({ messageId: storedIncoming.id, updatedAt: new Date() })
				.where(
					and(
						eq(chatAttachments.conversationId, conversationId),
						inArray(chatAttachments.id, attachmentIds),
						eq(chatAttachments.status, "ready"),
					),
				);
		}

		const [modelRun] = await adminDb
			.insert(chatModelRuns)
			.values({
				actorUserId: actor.id,
				conversationId,
				model: runtime.resolved.model,
				provider: runtime.resolved.provider,
				userMessageId: incoming.role === "user" ? incoming.id : null,
			})
			.returning();
		if (!modelRun) throw new Error("Không thể tạo model run.");
		activeModelRunId = modelRun.id;

		const tools = createChatTools({
			actor,
			conversationId,
			modelRunId: modelRun.id,
			request,
		});
		let stepCount = 0;
		let inputTokens = 0;
		let outputTokens = 0;
		const startedAt = Date.now();
		const agent = new ToolLoopAgent({
			instructions: [
				"Bạn là Chat nội bộ của CyberShield35.",
				"Trả lời bằng tiếng Việt mặc định, ngắn gọn, có căn cứ và dùng công cụ để kiểm tra dữ liệu thay vì suy đoán.",
				"Mọi nguồn phải trỏ tới ID và liên kết nội bộ chuẩn. Không tiết lộ bí mật hay nội dung tệp ngoài Chat hiện tại.",
				"Không bao giờ xuất bản, bình luận hoặc gửi nội dung ra hệ thống bên ngoài. Bản nháp luôn cần con người duyệt.",
				"Các công cụ ghi yêu cầu phê duyệt rõ ràng trước khi thực thi.",
			].join("\n"),
			model: runtime.model,
			stopWhen: stepCountIs(8),
			tools,
		});
		type AgentUIMessage = InferAgentUIMessage<typeof agent>;
		const messages = await validateUIMessages<AgentUIMessage>({
			messages: [...chat.messages.filter((message) => message.id !== incoming.id), incoming],
			tools,
		});

		return createAgentUIStreamResponse({
			agent,
			abortSignal: request.signal,
			consumeSseStream: ({ stream }) => consumeStream({ stream }),
			generateMessageId: () => crypto.randomUUID(),
			headers: authHeaders(auth),
			onError: (error) => {
				void adminDb
					.update(chatModelRuns)
					.set({
						completedAt: new Date(),
						errorCode: "generation_failed",
						errorMessage:
							error instanceof Error ? error.message.slice(0, 500) : "Generation failed",
						latencyMs: Date.now() - startedAt,
						status: "failed",
					})
					.where(eq(chatModelRuns.id, modelRun.id));
				return "Không thể hoàn tất phản hồi. Vui lòng thử lại.";
			},
			onFinish: async ({ isAborted, responseMessage }) => {
				const stored = await persistChatMessage(
					conversationId,
					responseMessage as ChatUIMessage,
				);
				await adminDb
					.update(chatModelRuns)
					.set({
						assistantMessageId: stored?.id,
						completedAt: new Date(),
						inputTokens,
						latencyMs: Date.now() - startedAt,
						outputTokens,
						status: isAborted ? "aborted" : "completed",
						stepCount,
						totalTokens: inputTokens + outputTokens,
					})
					.where(eq(chatModelRuns.id, modelRun.id));
			},
			onStepFinish: async (step) => {
				stepCount += 1;
				inputTokens += step.usage.inputTokens ?? 0;
				outputTokens += step.usage.outputTokens ?? 0;
				await adminDb
					.update(chatModelRuns)
					.set({
						inputTokens,
						outputTokens,
						stepCount,
						timeToFirstTokenMs: stepCount === 1 ? Date.now() - startedAt : undefined,
						totalTokens: inputTokens + outputTokens,
					})
					.where(eq(chatModelRuns.id, modelRun.id));
			},
			originalMessages: messages,
			sendSources: true,
			uiMessages: messages,
		});
	} catch (error) {
		if (activeModelRunId) {
			await adminDb
				.update(chatModelRuns)
				.set({
					completedAt: new Date(),
					errorCode: "request_failed",
					errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Request failed",
					status: "failed",
				})
				.where(eq(chatModelRuns.id, activeModelRunId));
		}
		if (error instanceof z.ZodError) {
			return Response.json({ error: z.treeifyError(error) }, { status: 400 });
		}
		return Response.json(
			{ error: error instanceof Error ? error.message : "Không thể gửi tin nhắn." },
			{ status: 500, headers: authHeaders(auth) },
		);
	}
}

function attachmentIdsFromMessage(message: ChatUIMessage) {
	const metadata = message.metadata as Record<string, unknown> | undefined;
	const value = metadata?.attachmentIds;
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string" && z.string().uuid().safeParse(item).success).slice(0, 5)
		: [];
}
