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
import { chatAttachments, chatModelRuns } from "@/lib/db/schema";
import { getInteractiveModelRuntime } from "@/lib/llm/generation";

export const maxDuration = 90;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession(request);
  if ("error" in auth)
    return Response.json({ error: auth.error }, { status: auth.status });
  let activeModelRunId: string | null = null;

  try {
    const conversationId = conversationIdSchema.parse((await params).id);
    const conversation = await requireOwnedChatConversation(
      conversationId,
      auth.session.user.id,
    );
    if (!conversation) {
      return Response.json(
        {
          error:
            "Chat được chia sẻ chỉ có thể đọc. Hãy tạo bản sao để tiếp tục.",
        },
        { status: 403 },
      );
    }

    const runtime = getInteractiveModelRuntime(
      auth.session,
      conversation.model,
    );
    if (!runtime) {
      return Response.json(
        { error: "LLM provider is not configured" },
        { status: 503 },
      );
    }
    const input = sendMessageSchema.parse(await request.json());
    const chat = await getChatConversation(
      conversationId,
      auth.session.user.id,
    );
    if (!chat)
      return Response.json({ error: "Không tìm thấy Chat." }, { status: 404 });

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
        "Trả lời bằng tiếng Việt tự nhiên, mạch lạc, đúng trọng tâm và dùng công cụ để kiểm tra dữ liệu thay vì suy đoán.",
        chatModeInstruction(input.mode),
        thinkingModeInstruction(input.thinkingMode),
        "Mọi nguồn phải trỏ tới ID và liên kết nội bộ chuẩn. Không tiết lộ bí mật hay nội dung tệp ngoài Chat hiện tại.",
        "Không bao giờ xuất bản, bình luận hoặc gửi nội dung ra hệ thống bên ngoài. Bản nháp luôn cần con người duyệt.",
        "Các công cụ ghi yêu cầu phê duyệt rõ ràng trước khi thực thi.",
        conversation.pinnedContext.length
          ? `Ngữ cảnh được ghim: ${JSON.stringify(conversation.pinnedContext)}`
          : "Không có ngữ cảnh được ghim.",
      ].join("\n"),
      temperature: conversation.temperature / 100,
      model: runtime.model,
      stopWhen: stepCountIs(input.thinkingMode === "deep" ? 12 : 6),
      tools,
    });
    type AgentUIMessage = InferAgentUIMessage<typeof agent>;
    const messages = await validateUIMessages<AgentUIMessage>({
      messages: trimMessagesToBudget(
        [
          ...chat.messages.filter((message) => message.id !== incoming.id),
          incoming,
        ],
        conversation.contextBudget,
      ),
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
              error instanceof Error
                ? error.message.slice(0, 500)
                : "Generation failed",
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
            timeToFirstTokenMs:
              stepCount === 1 ? Date.now() - startedAt : undefined,
            totalTokens: inputTokens + outputTokens,
          })
          .where(eq(chatModelRuns.id, modelRun.id));
      },
      originalMessages: messages,
      sendReasoning: true,
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
          errorMessage:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "Request failed",
          status: "failed",
        })
        .where(eq(chatModelRuns.id, activeModelRunId));
    }
    if (error instanceof z.ZodError) {
      return Response.json({ error: z.treeifyError(error) }, { status: 400 });
    }
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Không thể gửi tin nhắn.",
      },
      { status: 500, headers: authHeaders(auth) },
    );
  }
}

function chatModeInstruction(mode: "ask" | "investigate" | "draft" | "report") {
  return {
    ask: "Chế độ Hỏi nhanh: trả lời trực tiếp, súc tích; chỉ gọi công cụ khi cần xác minh dữ kiện.",
    investigate:
      "Chế độ Điều tra: chủ động tìm, đối chiếu nhiều nguồn nội bộ, nêu điểm chưa chắc chắn và trích dẫn bằng chứng cho từng kết luận quan trọng.",
    draft:
      "Chế độ Soạn thảo: viết tiếng Việt tự nhiên, có mở-thân-kết rõ ràng, đủ chiều sâu, tránh văn phong dịch máy và tạo nội dung ở trạng thái cần con người duyệt.",
    report:
      "Chế độ Báo cáo: tổng hợp có cấu trúc, phân tích xu hướng và mức độ rủi ro, nêu phương pháp, phát hiện, khuyến nghị, giới hạn và dẫn chứng; ưu tiên chiều sâu thay vì trả lời ngắn.",
  }[mode];
}

function thinkingModeInstruction(mode: "fast" | "deep") {
  return mode === "deep"
    ? "Suy xét sâu: lập kế hoạch kiểm tra dữ liệu qua nhiều bước và trình bày phần giải thích ngắn gọn, có thể kiểm chứng; không tiết lộ chuỗi suy nghĩ nội bộ."
    : "Phản hồi nhanh: dùng ít bước công cụ nhất có thể nhưng vẫn phải kiểm chứng các khẳng định quan trọng.";
}

function trimMessagesToBudget(
  messages: ChatUIMessage[],
  contextBudget: number,
) {
  const characterBudget = contextBudget * 3;
  const kept: ChatUIMessage[] = [];
  let used = 0;
  for (const message of messages.toReversed()) {
    const size = JSON.stringify(message).length;
    if (kept.length > 0 && used + size > characterBudget) break;
    kept.push(message);
    used += size;
  }
  return kept.reverse();
}

function attachmentIdsFromMessage(message: ChatUIMessage) {
  const metadata = message.metadata as Record<string, unknown> | undefined;
  const value = metadata?.attachmentIds;
  return Array.isArray(value)
    ? value
        .filter(
          (item): item is string =>
            typeof item === "string" &&
            z.string().uuid().safeParse(item).success,
        )
        .slice(0, 5)
    : [];
}
