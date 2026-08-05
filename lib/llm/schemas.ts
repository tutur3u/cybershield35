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
			// Not `.min(1)`. Requiring a proof here throws away the *entire*
			// analysis when the model omits one on a single claim — which is what
			// "No object generated: response did not match schema" was. Claims and
			// flags without usable proofs are already dropped individually in
			// lib/domain/analysis-evidence.ts, so the strictness bought nothing and
			// cost every other claim in the response.
			proofs: z.array(analysisProofSchema).default([]),
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
			proofs: z.array(analysisProofSchema).default([]),
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

/**
 * Deliberately looser than the Zalo editorial limits. Models routinely overshoot a
 * hard character cap by a few words, and rejecting the whole draft for that costs
 * the operator an entire generation; `prepareZaloArticleContent` trims title and
 * description to the real limits at the word boundary instead.
 */
export const articleAiOutputSchema = z.object({
	author: z.string().trim().max(50),
	blocks: z.array(articleBlockSchema).min(1).max(100),
	commentsEnabled: z.boolean(),
	coverUrl: z.string().url().nullable(),
	description: z.string().trim().max(600),
	reviewNotes: z.array(z.string().trim().min(1).max(500)).max(12).default([]),
	title: z.string().trim().min(1).max(300),
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
