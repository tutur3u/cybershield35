import type { UIMessage } from "ai";
import { z } from "zod";

export const conversationIdSchema = z.string().uuid();
export const chatVisibilitySchema = z.enum(["private", "workspace"]);
export const chatModeSchema = z.enum(["ask", "investigate", "draft", "report"]);
export const chatThinkingModeSchema = z.enum(["fast", "deep"]);
export const chatMessageSchema = z
  .object({
    id: z.string().uuid(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    parts: z.array(z.unknown()),
    role: z.enum(["user", "assistant"]),
  })
  .strict();

export const createConversationSchema = z
  .object({ title: z.string().trim().min(1).max(120).optional() })
  .strict();

export const updateConversationSchema = z
  .object({
    archived: z.boolean().optional(),
    contextBudget: z.number().int().min(4_000).max(128_000).optional(),
    model: z.string().trim().min(1).max(120).nullable().optional(),
    pinnedContext: z
      .array(
        z
          .object({
            href: z.string().max(500).optional(),
            id: z.string().min(1).max(120),
            label: z.string().trim().min(1).max(200),
            type: z.enum(["scan", "evidence", "topic", "draft", "article"]),
          })
          .strict(),
      )
      .max(20)
      .optional(),
    temperature: z.number().min(0).max(2).optional(),
    title: z.string().trim().min(1).max(120).optional(),
    visibility: chatVisibilitySchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Missing update")
  .strict();

export const sendMessageSchema = z
  .object({
    message: chatMessageSchema,
    mode: chatModeSchema.default("investigate"),
    thinkingMode: chatThinkingModeSchema.default("deep"),
  })
  .strict();

export type ChatMode = z.infer<typeof chatModeSchema>;
export type ChatThinkingMode = z.infer<typeof chatThinkingModeSchema>;

export type ChatUIMessage = UIMessage<{
  attachmentIds?: string[];
  createdAt?: string;
  mode?: ChatMode;
  model?: string;
  provider?: string;
  thinkingMode?: ChatThinkingMode;
}>;

export type ChatActor = {
  displayName: string | null;
  id: string;
};
