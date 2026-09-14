import type { UIMessageStreamOptions } from "ai";

import type { ChatUIMessage } from "./types";

export const CHAT_GENERATION_ERROR =
  "Không thể hoàn tất phản hồi. Vui lòng thử lại.";

export function hasChatResponse(message: ChatUIMessage) {
  return message.parts.some((part) =>
    part.type === "text"
      ? part.text.trim().length > 0
      : part.type === "file" || part.type === "dynamic-tool" || part.type.startsWith("tool-"),
  );
}

export type ChatRunOutcome = {
  status: "completed" | "failed" | "aborted";
  errorCode: string | null;
  errorMessage: string | null;
};

export function createChatStreamLifecycle(options: {
  signal: AbortSignal;
  finish: (message: ChatUIMessage | null, outcome: ChatRunOutcome) => Promise<void>;
}): Pick<UIMessageStreamOptions<ChatUIMessage>, "onError" | "onEnd"> {
  let streamError: string | null = null;
  return {
    onError(error) {
      streamError ??= error instanceof Error ? error.message.slice(0, 500) : "Generation failed";
      return CHAT_GENERATION_ERROR;
    },
    async onEnd({ isAborted, responseMessage, finishReason }) {
      const aborted = isAborted || options.signal.aborted;
      const hasResponse = hasChatResponse(responseMessage);
      const errorCode = streamError || finishReason === "error"
        ? "generation_failed"
        : finishReason === "length"
          ? "incomplete_response"
          : !hasResponse ? "empty_response" : null;
      await options.finish(hasResponse ? responseMessage : null, {
        status: aborted ? "aborted" : errorCode ? "failed" : "completed",
        errorCode: aborted ? null : errorCode,
        errorMessage: aborted || !errorCode ? null : streamError ?? CHAT_GENERATION_ERROR,
      });
      // A provider may finish without emitting an error chunk or any text.
      // Reject that stream so the client offers retry instead of a blank success.
      if (!aborted && errorCode && !streamError) {
        throw new Error(CHAT_GENERATION_ERROR);
      }
    },
  };
}
