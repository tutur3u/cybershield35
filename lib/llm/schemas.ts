import { z } from "zod";

export const analysisOutputSchema = z.object({
	riskLevel: z.enum(["low", "medium", "high"]),
	summary: z.string(),
	stanceSummary: z.string(),
	topicClusters: z.array(
		z.object({
			name: z.string(),
			count: z.number(),
			trend: z.string(),
			riskLevel: z.enum(["low", "medium", "high"]),
		}),
	),
	claims: z.array(
		z.object({
			claim: z.string(),
			stance: z.string(),
			confidence: z.number().min(0).max(1),
			evidenceIds: z.array(z.string()),
		}),
	),
	riskFlags: z.array(
		z.object({
			label: z.string(),
			count: z.number(),
			severity: z.enum(["low", "medium", "high"]),
		}),
	),
	sentiment: z.object({
		positive: z.number(),
		neutral: z.number(),
		negative: z.number(),
		total: z.number(),
	}),
});

export const counterArgumentOutputSchema = z.object({
	body: z.string(),
	citations: z.array(
		z.object({
			evidenceId: z.string(),
			label: z.string(),
		}),
	),
	safetyNotes: z.array(z.string()),
});

export type AnalysisOutput = z.infer<typeof analysisOutputSchema>;
export type CounterArgumentOutput = z.infer<typeof counterArgumentOutputSchema>;
