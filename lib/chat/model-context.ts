import type { ModelMessage } from "ai";

// Source posts may exceed the gateway's per-field emoji limit. Clean only
// tool-result context sent to the model; stored evidence and UI stay intact.
export function cleanChatToolContext(messages: ModelMessage[]): ModelMessage[] {
  return messages.map((message) => message.role === "tool"
    ? {
        ...message,
        content: message.content.map((part) => {
          if (part.type !== "tool-result") return part;
          const output = part.output;
          if (output.type !== "json" && output.type !== "text") return part;
          return {
            ...part,
            output: {
              ...output,
              value: JSON.parse(JSON.stringify(output.value).replace(/\p{Extended_Pictographic}|\uFE0F|\u20E3/gu, "")),
            },
          };
        }),
      }
    : message,
  );
}
