import { z } from "zod";
import { articleBlockSchema } from "@/lib/articles/schemas";

export const analysisProofSchema = z.object({
	confidence: z.number().min(0).max(1),
	evidenceId: z.string().trim().min(1),
	excerpt: z.string(),
	limitation: z.string().nullable(),
	support: z.string(),
});

export const analysisOutputSchema = z.object({
	riskLevel: z.enum(["low", "medium", "high"]),
	summary: z.string().trim().min(1).max(5_000),
	stanceSummary: z.string().trim().min(1).max(2_000),
	topicClusters: z.array(
		z.object({
			name: z.string().trim().min(1).max(160),
			count: z.number().int().nonnegative(),
			trend: z.string().trim().min(1).max(160),
			riskLevel: z.enum(["low", "medium", "high"]),
		}),
	),
	claims: z.array(
		z.object({
			claim: z.string().trim().min(1).max(1_500),
			stance: z.string().trim().min(1).max(120),
			confidence: z.number().min(0).max(1),
			evidenceIds: z.array(z.string().trim().min(1)),
			proofs: z.array(analysisProofSchema).min(1),
			rationale: z.string().trim().min(1).max(1_500),
		}),
	),
	riskFlags: z.array(
		z.object({
			label: z.string().trim().min(1).max(180),
			count: z.number().int().nonnegative(),
			severity: z.enum(["low", "medium", "high"]),
			confidence: z.number().min(0).max(1),
			evidenceIds: z.array(z.string().trim().min(1)),
			proofs: z.array(analysisProofSchema).min(1),
			rationale: z.string().trim().min(1).max(1_500),
		}),
	),
	sentiment: z.object({
		positive: z.number().int().nonnegative(),
		neutral: z.number().int().nonnegative(),
		negative: z.number().int().nonnegative(),
		total: z.number().int().nonnegative(),
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
	description: z.string().trim().max(180),
	reviewNotes: z.array(z.string().trim().min(1).max(500)).max(12).default([]),
	title: z.string().trim().min(1).max(110),
});

export const reportAiOutputSchema = z.object({
	title: z.string().trim().min(1).max(180),
	executiveSummary: z.string().trim().min(80).max(5_000),
	sections: z
		.array(
			z.object({
				heading: z.string().trim().min(1).max(180),
				content: z.string().trim().min(80).max(12_000),
				evidenceIds: z.array(z.string().trim().min(1).max(120)).max(50),
			}),
		)
		.min(1)
		.max(12),
	keyFindings: z.array(z.string().trim().min(1).max(1_000)).min(1).max(12),
	recommendations: z.array(z.string().trim().min(1).max(1_000)).max(12),
	limitations: z.array(z.string().trim().min(1).max(1_000)).max(12),
	reviewNotes: z.array(z.string().trim().min(1).max(1_000)).max(12),
});

export type ArticleAiOutput = z.infer<typeof articleAiOutputSchema>;
export type ReportAiOutput = z.infer<typeof reportAiOutputSchema>;

export type AnalysisOutput = z.infer<typeof analysisOutputSchema>;
export type AnalysisProof = z.infer<typeof analysisProofSchema>;
export type CounterArgumentOutput = z.infer<typeof counterArgumentOutputSchema>;
