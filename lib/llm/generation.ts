import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, generateText, Output } from "ai";

import type { EvidenceItemRow } from "@/lib/db/schema";
import type { ArticleContent } from "@/lib/articles/schemas";
import type { TuturuuuAdminSession } from "@/lib/auth/tuturuuu-session";
import { cleanDraftContent } from "@/lib/domain/draft-content";
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
		: [
				"google/gemini-3.5-flash-lite",
				"google/gemini-3.1-flash-lite",
				"google/gemini-3.6-flash",
			];
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
				"https://tuturuuu.com/api/v1/external-ai",
			headers: {
				"X-Tuturuuu-Workspace-Id": session.workspaceId,
			},
			name: "tuturuuu-ai",
		});
		return {
			// Tuturuuu exposes an OpenAI-compatible chat-completions contract.
			// Select it explicitly instead of sending Responses API-only fields.
			model: provider.chat(model),
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
			`You are an evidence-grounded civic information analyst. Return Vietnamese analysis only. Distinguish facts, interpretations, and missing context. Write summaries in fluent, idiomatic Vietnamese without mechanical openings or bureaucratic filler. Do not infer identity, do not recommend automated posting, and cite only provided evidence IDs. ${NATURAL_VIETNAMESE_WRITING_GUIDANCE}`,
		prompt: JSON.stringify({
			task: "Analyze public topic discussion, claims, stance, risk flags, and sentiment.",
			evidence,
		}),
	});
	return output;
}

export type CounterArgumentGenerationOptions = {
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
};

export async function generateCounterArgument(
	options: CounterArgumentGenerationOptions,
): Promise<CounterArgumentOutput> {
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

export async function generateCounterArgumentWithEvidenceFallback(
	options: CounterArgumentGenerationOptions,
	generate: (
		input: CounterArgumentGenerationOptions,
	) => Promise<CounterArgumentOutput> = generateCounterArgument,
) {
	try {
		return await generate(options);
	} catch (error) {
		if (
			options.evidence.length < 2 ||
			!isContextReducibleAiError(error)
		) {
			throw error;
		}
		const output = await generate({
			...options,
			evidence: options.evidence.slice(0, 1),
		});
		return {
			...output,
			safetyNotes: [
				...output.safetyNotes,
				"Nhà cung cấp AI không xử lý được toàn bộ ngữ cảnh liên quan; bản nháp này chỉ dùng bằng chứng đang mở.",
			],
		};
	}
}

export function isContextReducibleAiError(error: unknown) {
	const pending: unknown[] = [error];
	const seen = new Set<unknown>();
	while (pending.length) {
		const current = pending.shift();
		if (!current || seen.has(current)) continue;
		seen.add(current);
		if (
			APICallError.isInstance(current) &&
			(current.statusCode === 400 || current.statusCode === 413)
		) {
			return true;
		}
		if (
			current instanceof Error &&
			/bad request|payload too large/iu.test(current.message)
		) {
			return true;
		}
		if (typeof current !== "object") continue;
		const record = current as Record<string, unknown>;
		for (const key of ["cause", "lastError"]) {
			if (record[key]) pending.push(record[key]);
		}
		if (Array.isArray(record.errors)) pending.push(...record.errors);
	}
	return false;
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

export async function reviseCounterArgumentWithEvidenceFallback(
	options: Parameters<typeof reviseCounterArgument>[0],
	revise: (
		input: Parameters<typeof reviseCounterArgument>[0],
	) => Promise<CounterArgumentOutput> = reviseCounterArgument,
) {
	try {
		return await revise(options);
	} catch (error) {
		if (options.evidence.length < 2 || !isContextReducibleAiError(error)) {
			throw error;
		}
		const output = await revise({
			...options,
			evidence: options.evidence.slice(0, 1),
		});
		return {
			...output,
			safetyNotes: [
				...output.safetyNotes,
				"Nhà cung cấp AI không xử lý được toàn bộ ngữ cảnh liên quan; bản sửa này chỉ dùng bằng chứng đang mở.",
			],
		};
	}
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
	editorialIntent: "counter_argument" | "support" | "balanced";
	evidence: Array<Pick<EvidenceItemRow, "id" | "quote" | "summary">>;
	generationMode?: DraftGenerationMode;
	instruction?: string;
	model?: string;
	session?: Pick<TuturuuuAdminSession, "accessToken" | "workspaceId">;
	tone: string;
	voice: string;
}): Promise<ArticleAiOutput> {
	const runtime = options.session
		? getInteractiveModelRuntime(options.session, options.model)
		: getModelRuntime();
	if (!runtime) throw new Error("LLM provider is not configured");
	const { output } = await generateText({
		model: runtime.model,
		output: Output.object({ schema: articleAiOutputSchema }),
		system: [
			"Bạn là biên tập viên tiếng Việt cho CyberShield35.",
			"Viết tự nhiên, mạch lạc, đúng ngữ cảnh Việt Nam và chỉ dùng các bằng chứng được cung cấp.",
			"Không dịch từng chữ, không dùng giọng hành chính máy móc, không lặp lại kết luận và không tiết lộ quy trình nội bộ.",
			"Không tự xuất bản. Mọi đầu ra là bản đề xuất để con người xem xét.",
			"Tiêu đề phải là một dòng độc lập, cụ thể, tự nhiên, không giật gân, tối đa 110 ký tự; tuyệt đối không nối mô tả hoặc câu mở đầu thân bài vào tiêu đề.",
			"Trích yếu phải tóm tắt nội dung thật của bài bằng một hoặc hai câu hoàn chỉnh, tối đa 180 ký tự; không lặp lại tiêu đề, không bị cắt giữa từ và không chứa ký hiệu trích dẫn.",
			"Không dùng emoji, icon trang trí hoặc ký tự trình bày có thể không hiển thị trên Zalo.",
			"Thân bài mặc định gồm ba đến sáu đoạn ngắn, mỗi đoạn phát triển một ý và nối với nhau bằng chuyển ý tự nhiên.",
			"Không lặp lại tiêu đề thành đoạn đầu của thân bài.",
			"Không chèn ký hiệu trích dẫn dạng [1], [2] hoặc 【1】 vào nội dung; mọi lưu ý kiểm chứng phải nằm trong reviewNotes.",
			editorialIntentInstruction(options.editorialIntent),
			NATURAL_VIETNAMESE_WRITING_GUIDANCE,
		].join(" "),
		prompt: JSON.stringify({
			action: options.action,
			currentArticle: options.content,
			editorialIntent: options.editorialIntent,
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
			writingBrief: draftWritingBriefForMode(
				options.generationMode ?? "operator",
			),
		}),
	});
	return {
		...output,
		author: cleanDraftContent(output.author),
		blocks: output.blocks.map((block) =>
			block.type === "text"
				? { ...block, content: cleanDraftContent(block.content) }
				: block,
		),
		description: cleanDraftContent(output.description),
		title: cleanDraftContent(output.title),
	};
}

function editorialIntentInstruction(
	intent: "counter_argument" | "support" | "balanced",
) {
	if (intent === "counter_argument") {
		return "Mục tiêu là phản bác quan điểm nguồn: nêu rõ luận điểm cần phản bác, giải thích điểm chưa thuyết phục, rồi đưa bằng chứng và lập luận đối chiếu. Không chỉ tóm tắt hoặc đổi cách diễn đạt.";
	}
	if (intent === "support") {
		return "Mục tiêu là ủng hộ quan điểm nguồn: nêu rõ điểm đồng tình và củng cố bằng bằng chứng được cung cấp, không phóng đại.";
	}
	return "Mục tiêu là trình bày cân bằng: phân biệt dữ kiện đã có, điểm còn chưa rõ và các góc nhìn hợp lý mà không ép kết luận.";
}

function buildChatPrompt(messages: ChatInputMessage[]) {
	return JSON.stringify({
		task: "Continue this operator chat. Use the conversation only as context and avoid unsupported claims.",
		messages: messages.slice(-12),
	});
}
