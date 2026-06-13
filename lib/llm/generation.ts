import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";

import { demoAnalysis, demoDraft } from "@/lib/domain/fixtures";
import type { EvidenceItemRow } from "@/lib/db/schema";

import {
	analysisOutputSchema,
	counterArgumentOutputSchema,
	type AnalysisOutput,
	type CounterArgumentOutput,
} from "./schemas";

function getModel() {
	const apiKey = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY;
	if (!apiKey || process.env.DEMO_MODE === "true") return null;

	const provider = createOpenAI({
		apiKey,
		baseURL: process.env.LLM_BASE_URL,
		name: process.env.LLM_BASE_URL ? "openai-compatible" : "openai",
	});

	return provider(process.env.LLM_MODEL ?? "gpt-4.1-mini");
}

export async function analyzeEvidence(
	evidence: Array<Pick<EvidenceItemRow, "id" | "quote" | "summary" | "riskLevel">>,
): Promise<AnalysisOutput> {
	const model = getModel();
	if (!model || evidence.length === 0) return demoAnalysis as AnalysisOutput;

	try {
		const { output } = await generateText({
			model,
			output: Output.object({ schema: analysisOutputSchema }),
			system:
				"You are an evidence-grounded civic information analyst. Return Vietnamese analysis only. Do not infer identity, do not recommend automated posting, and cite only provided evidence IDs.",
			prompt: JSON.stringify({
				task: "Analyze public topic discussion, claims, stance, risk flags, and sentiment.",
				evidence,
			}),
		});
		return output;
	} catch {
		return demoAnalysis as AnalysisOutput;
	}
}

export async function generateCounterArgument(options: {
	evidence: Array<Pick<EvidenceItemRow, "id" | "quote" | "summary">>;
	tone: string;
	audience: string;
	language: string;
	length: string;
	operatorNotes?: string | null;
}): Promise<CounterArgumentOutput> {
	const model = getModel();
	if (!model || options.evidence.length === 0) {
		return {
			body: demoDraft.body,
			citations: demoDraft.citations as CounterArgumentOutput["citations"],
			safetyNotes: demoDraft.safetyNotes as string[],
		};
	}

	try {
		const { output } = await generateText({
			model,
			output: Output.object({ schema: counterArgumentOutputSchema }),
			system:
				"You draft counter-arguments for human review. Use only supplied evidence, avoid unsupported claims, avoid demographic targeting, do not produce posting automation, and write in Vietnamese unless another language is requested.",
			prompt: JSON.stringify({
				task: "Prepare an evidence-only counter-argument draft.",
				...options,
			}),
		});
		return output;
	} catch {
		return {
			body: demoDraft.body,
			citations: demoDraft.citations as CounterArgumentOutput["citations"],
			safetyNotes: demoDraft.safetyNotes as string[],
		};
	}
}
