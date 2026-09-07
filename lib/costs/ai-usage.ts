import { z } from "zod";
const amount = z.number().finite().nonnegative();
export const aiUsageSchema = z.object({
	currency: z.literal("USD"),
	source: z.literal("tuturuuu_ai_metering"),
	workspaceId: z.string(),
	appId: z.string(),
	from: z.string().datetime({ offset: true }),
	to: z.string().datetime({ offset: true }),
	rows: z.array(
		z.object({
			day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
			model: z.string(),
			feature: z.string(),
			executionMode: z.string(),
			amountUsd: amount,
			requests: amount,
			failed: amount,
			inputTokens: amount,
			outputTokens: amount,
			billedCredits: amount,
			unmeteredCredits: amount,
		}),
	),
});
export type AiUsage = z.infer<typeof aiUsageSchema>;
