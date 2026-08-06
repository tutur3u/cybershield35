import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Tuturuuu is the only provider boundary CS35 is allowed to talk to. Anything
 * that reaches a model host directly bypasses workspace attribution, metering
 * and cost reporting, so this guard fails the build rather than letting a new
 * escape path appear.
 *
 * `KNOWN_DIRECT_PROVIDER_FILES` is a shrinking ledger of the paths that still
 * have to be migrated. It exists so the guard can be enforced today instead of
 * after the whole migration lands. Entries may only be removed, never added —
 * the test asserts that too, so a new violation cannot be waved through by
 * appending to the list.
 */
const SOURCE_ROOTS = ["app", "components", "lib", "scripts"];

const KNOWN_DIRECT_PROVIDER_FILES = new Set([
	// Builds the AI SDK runtime from Google/OpenAI keys. Replaced by the
	// Tuturuuu gateway client once the machine credential is issued.
	"lib/llm/generation.ts",
	// Calls generativelanguage.googleapis.com for speech. Blocked on speech
	// parity at the canonical gateway.
	"lib/exports/google-tts.ts",
	// Reports which provider keys are present on the settings screen.
	"lib/providers/availability.ts",
	"components/auth/centralized-login-screen.tsx",
]);

const FORBIDDEN_IMPORTS = [
	"@ai-sdk/google",
	"@ai-sdk/openai",
	"@google/generative-ai",
	"openai/",
];

const FORBIDDEN_HOSTS = [
	"generativelanguage.googleapis.com",
	"api.openai.com",
	"api.anthropic.com",
	"generativelanguage.google.com",
];

const FORBIDDEN_ENV_VARS = [
	"GOOGLE_GENERATIVE_AI_API_KEY",
	"GOOGLE_API_KEY",
	"OPENAI_API_KEY",
	"LLM_API_KEY",
	"LLM_BASE_URL",
];

const APPROVED_AI_HOSTS = ["ai.tuturuuu.com", "tuturuuu.com"];

function sourceFiles() {
	const files: string[] = [];
	const walk = (directory: string) => {
		for (const entry of readdirSync(directory)) {
			if (entry === "node_modules" || entry.startsWith(".")) continue;
			const path = join(directory, entry);
			if (statSync(path).isDirectory()) {
				walk(path);
				continue;
			}
			if (/\.(ts|tsx)$/u.test(entry)) files.push(path);
		}
	};
	for (const root of SOURCE_ROOTS) walk(root);
	return files;
}

function violations(needles: string[]) {
	const found: Array<{ file: string; needle: string }> = [];
	for (const file of sourceFiles()) {
		const contents = readFileSync(file, "utf8");
		for (const needle of needles) {
			if (contents.includes(needle)) found.push({ file, needle });
		}
	}
	return found;
}

function unexpected(found: Array<{ file: string; needle: string }>) {
	return found.filter((entry) => !KNOWN_DIRECT_PROVIDER_FILES.has(entry.file));
}

describe("Tuturuuu is the only AI provider boundary", () => {
	test("no new file imports a hosted-provider SDK", () => {
		expect(unexpected(violations(FORBIDDEN_IMPORTS))).toEqual([]);
	});

	test("no new file calls a model host directly", () => {
		expect(unexpected(violations(FORBIDDEN_HOSTS))).toEqual([]);
	});

	test("no new file reads a provider API key from the environment", () => {
		expect(unexpected(violations(FORBIDDEN_ENV_VARS))).toEqual([]);
	});

	test("every outbound AI host is an approved Tuturuuu host", () => {
		const hosts = new Set<string>();
		for (const file of sourceFiles()) {
			for (const match of readFileSync(file, "utf8").matchAll(
				/https:\/\/([a-z0-9.-]+)/gu,
			)) {
				const host = match[1];
				if (host && /(^|\.)(googleapis|openai|anthropic)\.com$/u.test(host)) {
					hosts.add(host);
				}
			}
		}
		const unapproved = [...hosts].filter(
			(host) => !APPROVED_AI_HOSTS.some((approved) => host.endsWith(approved)),
		);
		// Only the ledgered files may still reference a provider host.
		const ledgeredOnly = unapproved.every((host) =>
			[...KNOWN_DIRECT_PROVIDER_FILES].some((file) =>
				readFileSync(file, "utf8").includes(host),
			),
		);
		expect(ledgeredOnly).toBe(true);
	});

	test("the migration ledger only shrinks", () => {
		// Guards against silencing a new violation by extending the list. Update
		// this number downward as each file is migrated; never upward.
		expect(KNOWN_DIRECT_PROVIDER_FILES.size).toBeLessThanOrEqual(4);
	});

	test("every ledgered file still exists and still violates", () => {
		// A stale entry would quietly widen the exemption, so a migrated file must
		// be removed from the ledger.
		const stillViolating = new Set(
			violations([
				...FORBIDDEN_IMPORTS,
				...FORBIDDEN_HOSTS,
				...FORBIDDEN_ENV_VARS,
			]).map((entry) => entry.file),
		);
		expect([...KNOWN_DIRECT_PROVIDER_FILES].filter((file) => !stillViolating.has(file))).toEqual(
			[],
		);
	});

	test("requested models stay within the platform catalog", async () => {
		// The gateway rejects anything outside the workspace policy, and the policy
		// cannot exceed the platform catalog.
		const { getAllowedAiModels } = await import("@/lib/llm/generation");
		const platformCatalog = new Set([
			"google/gemini-3.5-flash-lite",
			"google/gemini-3.6-flash",
			"google/gemini-3.1-flash-tts-preview",
			"google/gemini-embedding-2",
		]);
		expect(
			getAllowedAiModels().filter((model) => !platformCatalog.has(model)),
		).toEqual([]);
	});
});

describe("work without a user still bills the workspace", () => {
	const generation = readFileSync("lib/llm/generation.ts", "utf8");

	test("batch work prefers the metered gateway over a raw provider key", () => {
		// Chat borrows the reader's session and is counted; scans, drafts and the
		// analysis summary have no session and fell through to a provider key, so
		// the heaviest use of the model was the part nobody was billed for.
		expect(generation).toContain("function getMachineModelRuntime");
		expect(generation).toContain(
			"return getMachineModelRuntime() ?? getModelRuntime()",
		);
	});

	test("the machine credential carries workspace attribution", () => {
		// A token without the workspace header reaches the gateway but cannot be
		// attributed, which looks identical to not being tracked at all.
		const machine = generation.slice(
			generation.indexOf("function getMachineModelRuntime"),
		);
		expect(machine.slice(0, machine.indexOf("function getModel("))).toContain(
			'"X-Tuturuuu-Workspace-Id": workspaceId',
		);
	});

	test("a missing credential degrades rather than stopping the scanner", () => {
		const machine = generation.slice(
			generation.indexOf("function getMachineModelRuntime"),
		);
		expect(machine).toContain("if (!token || !workspaceId) return null");
	});
});
