import { z } from "zod";
import { articleBlockSchema } from "@/lib/articles/schemas";

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

export const articleAiOutputSchema = z.object({
	author: z.string().trim().max(50),
	blocks: z.array(articleBlockSchema).min(1).max(100),
	commentsEnabled: z.boolean(),
	coverUrl: z.string().url().nullable(),
	description: z.string().trim().max(300),
	reviewNotes: z.array(z.string().trim().min(1).max(500)).max(12).default([]),
	title: z.string().trim().min(1).max(150),
});

export type ArticleAiOutput = z.infer<typeof articleAiOutputSchema>;

export type AnalysisOutput = z.infer<typeof analysisOutputSchema>;
export type CounterArgumentOutput = z.infer<typeof counterArgumentOutputSchema>;
