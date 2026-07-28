import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";

import type { EvidenceItemRow } from "@/lib/db/schema";
import type { ArticleContent } from "@/lib/articles/schemas";
import type { TuturuuuAdminSession } from "@/lib/auth/tuturuuu-session";
import {
	draftWritingBriefForMode,
	type DraftGenerationMode,
	NATURAL_VIETNAMESE_WRITING_GUIDANCE,
} from "@/lib/domain/draft-style";
import {
	type DraftKind,
	draftIntentGuidance,
} from "@/lib/domain/draft-intent";
import {
	cleanSecret,
	DEFAULT_GOOGLE_GENERATIVE_AI_MODEL,
	resolveCredential,
	type CredentialSource,
} from "@/lib/runtime/client-runtime";

import {
	analysisOutputSchema,
	articleAiOutputSchema,
	counterArgumentOutputSchema,
	type AnalysisOutput,
	type ArticleAiOutput,
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

export function getAllowedAiModels() {
	const configured = process.env.AI_MODEL_ALLOWLIST?.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
	return configured?.length
		? [...new Set(configured)]
		: ["google/gemini-3.6-flash", "google/gemini-3.1-flash-lite"];
}

export function getInteractiveModelRuntime(
	session: Pick<TuturuuuAdminSession, "accessToken" | "workspaceId">,
	requestedModel?: string | null,
) {
	const allowed = getAllowedAiModels();
	const configuredModel = process.env.TUTURUUU_AI_MODEL?.trim();
	const model =
		requestedModel && allowed.includes(requestedModel)
			? requestedModel
			: configuredModel && allowed.includes(configuredModel)
				? configuredModel
				: allowed[0]!;
	if (
		session.accessToken !== "local-dev-bypass" &&
		session.workspaceId &&
		session.accessToken.startsWith("ttr_app_")
	) {
		const provider = createOpenAI({
			apiKey: session.accessToken,
			baseURL:
				process.env.TUTURUUU_AI_BASE_URL?.trim() ??
				"https://ai.tuturuuu.com/v1",
			headers: {
				"X-Tuturuuu-Workspace-Id": session.workspaceId,
			},
			name: "tuturuuu-ai",
		});
		return {
			model: provider(model),
			resolved: {
				model,
				provider: "tuturuuu" as const,
				source: "external-app-session" as const,
			},
		};
	}
	const fallback = getModelRuntime();
	if (!fallback) return null;
	return fallback;
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
	draftKind?: DraftKind;
	generationMode?: DraftGenerationMode;
	session?: Pick<TuturuuuAdminSession, "accessToken" | "workspaceId">;
}): Promise<CounterArgumentOutput> {
	const runtime = options.session
		? getInteractiveModelRuntime(options.session)
		: getModelRuntime();
	if (!runtime || options.evidence.length === 0) {
		throw new Error(
			!runtime
				? "LLM provider is not configured"
				: "Cannot draft a response without evidence",
		);
	}
	const draftKind = options.draftKind ?? "counter_argument";

	const { output } = await generateText({
		model: runtime.model,
		output: Output.object({ schema: counterArgumentOutputSchema }),
		system:
			`You create internal communication drafts for human review. Follow the requested editorial intent exactly. Use only supplied evidence, avoid unsupported claims and demographic targeting, never publish or automate posting, and write in Vietnamese unless another language is requested. Do not place numeric citation markers such as [1], [2], or 【1】 inside the prose; citations are returned separately. ${NATURAL_VIETNAMESE_WRITING_GUIDANCE}`,
		prompt: JSON.stringify({
			audience: options.audience,
			draftKind,
			evidence: options.evidence,
			intent: draftIntentGuidance(draftKind),
			language: options.language,
			length: options.length,
			operatorNotes: options.operatorNotes,
			task: "Prepare an evidence-grounded draft that visibly fulfills the selected intent.",
			tone: options.tone,
			voice: options.voice,
			writingBrief: draftWritingBriefForMode(
				options.generationMode ?? "operator",
			),
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
	draftKind?: DraftKind;
	session?: Pick<TuturuuuAdminSession, "accessToken" | "workspaceId">;
}): Promise<CounterArgumentOutput> {
	const runtime = options.session
		? getInteractiveModelRuntime(options.session)
		: getModelRuntime();
	if (!runtime || options.evidence.length === 0) {
		throw new Error(
			!runtime
				? "LLM provider is not configured"
				: "Cannot revise a response without evidence",
		);
	}
	const draftKind = options.draftKind ?? "counter_argument";

	const { output } = await generateText({
		model: runtime.model,
		output: Output.object({ schema: counterArgumentOutputSchema }),
		system:
			`You revise internal communication drafts for human review. Follow the operator's editing instruction and the selected editorial intent while using only supplied evidence. Preserve accurate claims, avoid demographic targeting, never publish or automate posting, and write in the requested language. Do not place numeric citation markers such as [1], [2], or 【1】 inside the prose. ${NATURAL_VIETNAMESE_WRITING_GUIDANCE}`,
		prompt: JSON.stringify({
			audience: options.audience,
			currentBody: options.currentBody,
			draftKind,
			evidence: options.evidence,
			instruction: options.instruction,
			intent: draftIntentGuidance(draftKind),
			language: options.language,
			length: options.length,
			task: "Revise the existing draft without introducing unsupported claims.",
			tone: options.tone,
			voice: options.voice,
			writingBrief: draftWritingBriefForMode("operator"),
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

export async function generateArticleRevision(options: {
	action:
		| "draft"
		| "outline"
		| "rewrite"
		| "shorten"
		| "expand"
		| "title_description"
		| "claim_check";
	content: ArticleContent;
	context?: string;
	evidence: Array<Pick<EvidenceItemRow, "id" | "quote" | "summary">>;
	instruction?: string;
	session: Pick<TuturuuuAdminSession, "accessToken" | "workspaceId">;
	tone: string;
	voice: string;
}): Promise<ArticleAiOutput> {
	const runtime = getInteractiveModelRuntime(options.session);
	if (!runtime) throw new Error("LLM provider is not configured");
	const { output } = await generateText({
		model: runtime.model,
		output: Output.object({ schema: articleAiOutputSchema }),
		system: [
			"Bạn là biên tập viên tiếng Việt cho CyberShield35.",
			"Viết tự nhiên, mạch lạc, đúng ngữ cảnh Việt Nam và chỉ dùng các bằng chứng được cung cấp.",
			"Không dịch từng chữ, không dùng giọng hành chính máy móc, không lặp lại kết luận và không tiết lộ quy trình nội bộ.",
			"Không tự xuất bản. Mọi đầu ra là bản đề xuất để con người xem xét.",
			NATURAL_VIETNAMESE_WRITING_GUIDANCE,
		].join(" "),
		prompt: JSON.stringify({
			action: options.action,
			currentArticle: options.content,
			evidence: options.evidence,
			extraContext: options.context,
			instruction: options.instruction,
			outputRequirements: {
				keepImageBlocksUnlessAsked: true,
				returnCompleteArticle: true,
				reviewNotes:
					"Liệt kê ngắn các điểm cần kiểm tra; claim_check không tự sửa dữ kiện chưa đủ căn cứ.",
			},
			tone: options.tone,
			voice: options.voice,
		}),
	});
	return output;
}

function buildChatPrompt(messages: ChatInputMessage[]) {
	return JSON.stringify({
		task: "Continue this operator chat. Use the conversation only as context and avoid unsupported claims.",
		messages: messages.slice(-12),
	});
}
