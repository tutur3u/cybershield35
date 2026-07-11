import type { UIMessage } from "ai";
import { z } from "zod";

export const conversationIdSchema = z.string().uuid();
export const chatVisibilitySchema = z.enum(["private", "workspace"]);
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
		title: z.string().trim().min(1).max(120).optional(),
		visibility: chatVisibilitySchema.optional(),
	})
	.refine((value) => Object.keys(value).length > 0, "Missing update")
	.strict();

export const sendMessageSchema = z
	.object({ message: chatMessageSchema })
	.strict();

export type ChatUIMessage = UIMessage<{
	attachmentIds?: string[];
	createdAt?: string;
	model?: string;
	provider?: string;
}>;

export type ChatActor = {
	displayName: string | null;
	id: string;
};
