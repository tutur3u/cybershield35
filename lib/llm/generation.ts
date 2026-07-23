import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";

import type { EvidenceItemRow } from "@/lib/db/schema";
import { NATURAL_VIETNAMESE_WRITING_GUIDANCE } from "@/lib/domain/draft-style";
import {
	cleanSecret,
	DEFAULT_GOOGLE_GENERATIVE_AI_MODEL,
	resolveCredential,
	type CredentialSource,
} from "@/lib/runtime/client-runtime";

import {
	analysisOutputSchema,
	counterArgumentOutputSchema,
	type AnalysisOutput,
	type CounterArgumentOutput,
} from "./schemas";

type LlmRuntime =
	| {
			provider: "openai";
			apiKey: string;
			model: string;
			source: "server";
	  }
	| {
			provider: "google";
			apiKey: string;
			model: string;
			source: Exclude<CredentialSource, "none">;
	  };

export type ChatInputMessage = {
	role: "assistant" | "user";
	content: string;
};

export type ChatReplyOutput = {
	content: string;
	mode: "live";
	provider: "openai" | "google";
	credentialSource: CredentialSource;
};

export function resolveLlmRuntime(): LlmRuntime | null {
	const openAiKey =
		cleanSecret(process.env.LLM_API_KEY) ??
		cleanSecret(process.env.OPENAI_API_KEY);
	if (openAiKey) {
		return {
			provider: "openai",
			apiKey: openAiKey,
			model: process.env.LLM_MODEL ?? "gpt-4.1-mini",
			source: "server",
		};
	}

	const googleCredential = resolveCredential(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
	if (!googleCredential) return null;

	return {
		provider: "google",
		apiKey: googleCredential.value,
		model:
			cleanSecret(process.env.GOOGLE_GENERATIVE_AI_MODEL) ??
			DEFAULT_GOOGLE_GENERATIVE_AI_MODEL,
		source: googleCredential.source,
	};
}

function getModelRuntime() {
	const resolved = resolveLlmRuntime();
	if (!resolved) return null;

	if (resolved.provider === "google") {
		const provider = createGoogleGenerativeAI({ apiKey: resolved.apiKey });
		return { model: provider(resolved.model), resolved };
	}

	const provider = createOpenAI({
		apiKey: resolved.apiKey,
		baseURL: process.env.LLM_BASE_URL,
		name: process.env.LLM_BASE_URL ? "openai-compatible" : "openai",
	});

	return { model: provider(resolved.model), resolved };
}

export function getChatModelRuntime() {
	return getModelRuntime();
}

function getModel() {
	return getModelRuntime()?.model ?? null;
}

export async function analyzeEvidence(
	evidence: Array<Pick<EvidenceItemRow, "id" | "quote" | "summary" | "riskLevel">>,
): Promise<AnalysisOutput> {
	const model = getModel();
	if (!model) throw new Error("LLM provider is not configured");
	if (evidence.length === 0) throw new Error("Cannot analyze a scan without evidence");

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
}

export async function generateCounterArgument(options: {
	evidence: Array<Pick<EvidenceItemRow, "id" | "quote" | "summary">>;
	tone: string;
	voice: string;
	audience: string;
	language: string;
	length: string;
	operatorNotes?: string | null;
	draftKind?: "response" | "comment" | "counter_argument" | "internal_brief";
}): Promise<CounterArgumentOutput> {
	const model = getModel();
	if (!model || options.evidence.length === 0) {
		throw new Error(
			!model
				? "LLM provider is not configured"
				: "Cannot draft a response without evidence",
		);
	}

	const { output } = await generateText({
		model,
		output: Output.object({ schema: counterArgumentOutputSchema }),
		system:
			`You create internal communication drafts for human review. Use only supplied evidence, avoid unsupported claims and demographic targeting, never publish or automate posting, and write in Vietnamese unless another language is requested. ${NATURAL_VIETNAMESE_WRITING_GUIDANCE}`,
		prompt: JSON.stringify({
			task: `Prepare an evidence-only ${options.draftKind ?? "counter_argument"} draft.`,
			...options,
		}),
	});
	return output;
}

export async function reviseCounterArgument(options: {
	audience: string;
	currentBody: string;
	evidence: Array<Pick<EvidenceItemRow, "id" | "quote" | "summary">>;
	instruction: string;
	language: string;
	length: string;
	tone: string;
	voice: string;
}): Promise<CounterArgumentOutput> {
	const model = getModel();
	if (!model || options.evidence.length === 0) {
		throw new Error(
			!model
				? "LLM provider is not configured"
				: "Cannot revise a response without evidence",
		);
	}

	const { output } = await generateText({
		model,
		output: Output.object({ schema: counterArgumentOutputSchema }),
		system:
			`You revise internal communication drafts for human review. Follow the operator's editing instruction while using only supplied evidence. Preserve accurate claims, avoid demographic targeting, never publish or automate posting, and write in the requested language. ${NATURAL_VIETNAMESE_WRITING_GUIDANCE}`,
		prompt: JSON.stringify({
			task: "Revise the existing draft without introducing unsupported claims.",
			...options,
		}),
	});
	return output;
}

export async function generateChatReply(
	messages: ChatInputMessage[],
): Promise<ChatReplyOutput> {
	const resolvedModel = getModelRuntime();
	if (!resolvedModel) throw new Error("LLM provider is not configured");

	const { text } = await generateText({
		model: resolvedModel.model,
		system:
			"You are CyberShield 35's internal civic information analysis assistant. Answer in Vietnamese by default. Be concise, evidence-grounded, and operational. Do not claim access to secrets, do not recommend automated posting, and refuse requests for demographic targeting or manipulation.",
		prompt: buildChatPrompt(messages),
	});

	return {
		content: text,
		mode: "live",
		provider: resolvedModel.resolved.provider,
		credentialSource: resolvedModel.resolved.source,
	};
}

function buildChatPrompt(messages: ChatInputMessage[]) {
	return JSON.stringify({
		task: "Continue this operator chat. Use the conversation only as context and avoid unsupported claims.",
		messages: messages.slice(-12),
	});
}
