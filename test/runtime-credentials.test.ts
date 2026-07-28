import { afterEach, describe, expect, test } from "bun:test";

import {
	generateChatReply,
	getInteractiveModelRuntime,
	resolveLlmRuntime,
} from "@/lib/llm/generation";
import {
	parseClientRuntime,
	redactRuntimeSecrets,
	resolveCredential,
} from "@/lib/runtime/client-runtime";
import { readFileSync } from "node:fs";

const originalEnv = { ...process.env };

afterEach(() => {
	process.env = { ...originalEnv };
});

describe("runtime credential precedence", () => {
	test("server credentials are the only accepted credential source", () => {
		expect(resolveCredential("server-key", "browser-key")).toEqual({
			value: "server-key",
			source: "server",
		});
		expect(resolveCredential(undefined)).toBeNull();
	});

	test("runtime parsing strips browser-submitted keys", () => {
		const runtime = parseClientRuntime({
			keys: {
				googleGenerativeAiApiKey: " google-key ",
				apifyToken: " apify-key ",
				firecrawlApiKey: " firecrawl-key ",
				browserUseApiKey: " browser-use-key ",
			},
		});

		expect(runtime.keys).toEqual({});
	});

	test("redaction has no browser-submitted secrets to process", () => {
		expect(
			redactRuntimeSecrets("Provider rejected firecrawl-secret-value for request"),
		).toBe("Provider rejected firecrawl-secret-value for request");
	});
});

describe("LLM provider selection", () => {
	test("OpenAI-compatible server keys are used even when browser Google keys are submitted", () => {
		process.env.OPENAI_API_KEY = "openai-server-key";
		process.env.LLM_MODEL = "gpt-4.1-mini";
		process.env.GOOGLE_GENERATIVE_AI_API_KEY = "";

		const runtime = parseClientRuntime({
			keys: { googleGenerativeAiApiKey: "google-browser-key" },
		});

		expect(runtime.keys).toEqual({});
		expect(resolveLlmRuntime()).toMatchObject({
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

	test("browser Google keys are ignored when server keys are missing", () => {
		process.env.OPENAI_API_KEY = "";
		process.env.LLM_API_KEY = "";
		process.env.GOOGLE_GENERATIVE_AI_API_KEY = "";

		const runtime = parseClientRuntime({
			keys: { googleGenerativeAiApiKey: "google-browser-key" },
		});

		expect(runtime.keys).toEqual({});
		expect(resolveLlmRuntime()).toBeNull();
	});

	test("authenticated CS35 sessions use Tuturuuu chat completions without provider keys", () => {
		process.env.OPENAI_API_KEY = "";
		process.env.LLM_API_KEY = "";
		process.env.GOOGLE_GENERATIVE_AI_API_KEY = "";
		const runtime = getInteractiveModelRuntime(
			{
				accessToken: "ttr_app_external-session",
				workspaceId: "workspace-id",
			},
			"google/gemini-3.1-flash-lite",
		);

		expect(runtime?.resolved).toMatchObject({
			model: "google/gemini-3.1-flash-lite",
			provider: "tuturuuu",
			source: "external-app-session",
		});
		expect(runtime?.model.provider).toBe("tuturuuu-ai.chat");
	});

	test("chat requires a configured LLM provider", async () => {
		process.env.OPENAI_API_KEY = "";
		process.env.LLM_API_KEY = "";
		process.env.GOOGLE_GENERATIVE_AI_API_KEY = "";

		await expect(
			generateChatReply([
				{ role: "user", content: "Tóm tắt rủi ro của scan hiện tại" },
			]),
		).rejects.toThrow("LLM provider is not configured");
	});
});

describe("browser key entry removal", () => {
	test("dashboard client code does not expose or submit runtime keys", () => {
		const dashboard = readFileSync(
			"components/dashboard/cybershield-dashboard.tsx",
			"utf8",
		);
		const actions = readFileSync("components/dashboard/client-actions.ts", "utf8");
		const widgets = readFileSync("components/dashboard/page-widgets.tsx", "utf8");

		expect(dashboard).not.toContain("TestingKeysDialog");
		expect(dashboard).not.toContain("useClientRuntimeCredentials");
		expect(actions).not.toContain("clientRuntime");
		expect(widgets).not.toContain("onOpenTestingKeys");
	});

	test("API routes reject browser runtime keys instead of parsing them", () => {
		for (const file of [
			"app/api/scans/route.ts",
			"app/api/scans/[id]/counter-arguments/route.ts",
			"app/api/tracked-sources/[id]/scan/route.ts",
		]) {
			const source = readFileSync(file, "utf8");
			expect(source, file).not.toContain("parseClientRuntime");
			expect(source, file).not.toContain("redactRuntimeSecrets");
			expect(source, file).toContain(".strict()");
		}
	});
});
