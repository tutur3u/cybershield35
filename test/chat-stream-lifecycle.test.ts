import { describe, expect, test } from "bun:test";
import { createAgentUIStreamResponse, simulateReadableStream, ToolLoopAgent } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { CHAT_GENERATION_ERROR, createChatStreamLifecycle, hasChatResponse, type ChatRunOutcome } from "../lib/chat/stream-lifecycle";
import type { ChatUIMessage } from "../lib/chat/types";

const usage = {
  inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 2, text: 2, reasoning: undefined },
};

async function runStream(kind: "success" | "error" | "empty" | "partial-error") {
  const saved: Array<{ message: ChatUIMessage | null; outcome: ChatRunOutcome }> = [];
  const model = new MockLanguageModelV4({
    doStream: async () => {
      if (kind === "error") throw new Error("EMOJI_LIMIT_EXCEEDED");
      return { stream: simulateReadableStream({
        initialDelayInMs: 0, chunkDelayInMs: 0,
        chunks: [
          ...(kind === "empty" ? [] : [
            { type: "text-start" as const, id: "t" },
            { type: "text-delta" as const, id: "t", delta: "CS35-DEMO-1409" },
            { type: "text-end" as const, id: "t" },
          ]),
          ...(kind === "partial-error" ? [{ type: "error" as const, error: new Error("Stream interrupted") }] : []),
          { type: "finish" as const, finishReason: { unified: "stop" as const, raw: undefined }, usage },
        ],
      }) };
    },
  });
  const response = await createAgentUIStreamResponse({
    agent: new ToolLoopAgent({ model, maxRetries: 0 }),
    uiMessages: [{ id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: "Read fixture" }] }],
    generateMessageId: () => crypto.randomUUID(),
    ...createChatStreamLifecycle({
      signal: new AbortController().signal,
      finish: async (message, outcome) => { saved.push({ message, outcome }); },
    }),
  });
  const body = await response.text().catch((error: Error) => error.message);
  return { saved, body };
}

describe("chat stream persistence", () => {
  test("stores a successful response after consuming the actual SDK stream", async () => {
    const { saved, body } = await runStream("success");
    expect(body).toContain("CS35-DEMO-1409");
    expect(saved).toHaveLength(1);
    expect(saved[0]?.outcome.status).toBe("completed");
    expect(saved[0]?.message?.parts.some((p) => p.type === "text" && p.text === "CS35-DEMO-1409")).toBe(true);
  });

  test("does not overwrite provider rejection with success or save an empty assistant", async () => {
    const { saved, body } = await runStream("error");
    expect(body).toContain(CHAT_GENERATION_ERROR);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.message).toBeNull();
    expect(saved[0]?.outcome).toEqual({ status: "failed", errorCode: "generation_failed", errorMessage: "EMOJI_LIMIT_EXCEEDED" });
  });

  test("rejects an empty provider response instead of silently completing", async () => {
    const { saved, body } = await runStream("empty");
    expect(body).toContain(CHAT_GENERATION_ERROR);
    expect(saved[0]?.message).toBeNull();
    expect(saved[0]?.outcome.errorCode).toBe("empty_response");
  });

  test("retains partial text while recording a mid-stream failure", async () => {
    const { saved } = await runStream("partial-error");
    expect(saved[0]?.outcome.status).toBe("failed");
    expect(saved[0]?.message).not.toBeNull();
  });

  test("records cancellation before the first token as aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const saved: ChatRunOutcome[] = [];
    const callbacks = createChatStreamLifecycle({ signal: controller.signal, finish: async (message, outcome) => { expect(message).toBeNull(); saved.push(outcome); } });
    await callbacks.onEnd!({ isAborted: false, isContinuation: false, messages: [], responseMessage: { id: "empty", role: "assistant", parts: [] } });
    expect(saved[0]).toEqual({ status: "aborted", errorCode: null, errorMessage: null });
  });

  test("keeps tool approvals but excludes empty and reasoning-only history", () => {
    expect(hasChatResponse({ id: "1", role: "assistant", parts: [{ type: "step-start" }, { type: "text", text: "  " }] })).toBe(false);
    expect(hasChatResponse({ id: "2", role: "assistant", parts: [{ type: "reasoning", text: "thinking" }] })).toBe(false);
    expect(hasChatResponse({ id: "3", role: "assistant", parts: [{ type: "dynamic-tool", toolName: "createDraft", toolCallId: "call", state: "approval-requested", input: {}, approval: { id: "approve" } }] })).toBe(true);
  });
});
