import { afterEach, describe, expect, test } from "bun:test";

import { generateChatReply, resolveLlmRuntime } from "@/lib/llm/generation";
import {
	parseClientRuntime,
	redactRuntimeSecrets,
	resolveCredential,
} from "@/lib/runtime/client-runtime";

const originalEnv = { ...process.env };

afterEach(() => {
	process.env = { ...originalEnv };
});

describe("runtime credential precedence", () => {
	test("server credentials win over browser-session credentials", () => {
		expect(resolveCredential("server-key", "browser-key")).toEqual({
			value: "server-key",
			source: "server",
		});
	});

	test("browser-session credentials are used when the server is missing", () => {
		expect(resolveCredential(undefined, "browser-key")).toEqual({
			value: "browser-key",
			source: "browser_session",
		});
	});

	test("runtime parsing trims keys and defaults the Google model", () => {
		const runtime = parseClientRuntime({
			keys: {
				googleGenerativeAiApiKey: " google-key ",
				apifyToken: " apify-key ",
			},
		});

		expect(runtime.keys.googleGenerativeAiApiKey).toBe("google-key");
		expect(runtime.keys.googleGenerativeAiModel).toBe("gemini-2.5-flash");
		expect(runtime.keys.apifyToken).toBe("apify-key");
	});

	test("redacts browser-session secrets from error messages", () => {
		const runtime = parseClientRuntime({
			keys: { firecrawlApiKey: "firecrawl-secret-value" },
		});

		expect(
			redactRuntimeSecrets(
				"Provider rejected firecrawl-secret-value for request",
				runtime,
			),
		).toBe("Provider rejected [redacted] for request");
	});
});

describe("LLM provider selection", () => {
	test("OpenAI-compatible server keys win over browser Google keys", () => {
		process.env.OPENAI_API_KEY = "openai-server-key";
		process.env.LLM_MODEL = "gpt-4.1-mini";
		process.env.GOOGLE_GENERATIVE_AI_API_KEY = "";

		const runtime = parseClientRuntime({
			keys: { googleGenerativeAiApiKey: "google-browser-key" },
		});

		expect(resolveLlmRuntime(runtime)).toMatchObject({
			provider: "openai",
			model: "gpt-4.1-mini",
			source: "server",
		});
	});

	test("server Google keys are used when OpenAI is not configured", () => {
		process.env.OPENAI_API_KEY = "";
		process.env.LLM_API_KEY = "";
		process.env.GOOGLE_GENERATIVE_AI_API_KEY = "google-server-key";
		process.env.GOOGLE_GENERATIVE_AI_MODEL = "gemini-2.5-pro";

		expect(resolveLlmRuntime()).toMatchObject({
			provider: "google",
			model: "gemini-2.5-pro",
			source: "server",
		});
	});

	test("browser Google keys are live fallback even when demo mode is true", () => {
		process.env.OPENAI_API_KEY = "";
		process.env.LLM_API_KEY = "";
		process.env.GOOGLE_GENERATIVE_AI_API_KEY = "";
		process.env.DEMO_MODE = "true";

		const runtime = parseClientRuntime({
			keys: { googleGenerativeAiApiKey: "google-browser-key" },
		});

		expect(resolveLlmRuntime(runtime)).toMatchObject({
			provider: "google",
			model: "gemini-2.5-flash",
			source: "browser_session",
		});
	});

	test("chat falls back to deterministic demo output without an effective key", async () => {
		process.env.OPENAI_API_KEY = "";
		process.env.LLM_API_KEY = "";
		process.env.GOOGLE_GENERATIVE_AI_API_KEY = "";

		const reply = await generateChatReply([
			{ role: "user", content: "Tóm tắt rủi ro của scan hiện tại" },
		]);

		expect(reply).toMatchObject({
			mode: "demo",
			provider: "demo",
			credentialSource: "demo",
		});
		expect(reply.content).toContain("chế độ demo");
	});
});
