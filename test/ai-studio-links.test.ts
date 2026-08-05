import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";

mock.module("server-only", () => ({}));

const originalEnv = { ...process.env };

async function links() {
	// Imported lazily so the `server-only` stub above is in place first.
	return import("@/lib/tuturuuu/ai-studio-links");
}

beforeEach(() => {
	process.env = { ...originalEnv };
});

afterEach(() => {
	process.env = { ...originalEnv };
});

describe("AI Studio workspace deep links", () => {
	test("points at this workspace's usage on the studio", async () => {
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID =
			"449cdd3b-121b-40f7-9cee-28f5b582e204";
		delete process.env.TUTURUUU_AI_APP_URL;
		const { aiStudioWorkspaceUrl } = await links();

		// The team reads costs in đồng, so the link opens there; the studio's own
		// currency switcher still works from that starting point.
		expect(aiStudioWorkspaceUrl("runs")).toBe(
			"https://ai.tuturuuu.com/449cdd3b-121b-40f7-9cee-28f5b582e204/runs?currency=VND",
		);
		expect(aiStudioWorkspaceUrl("credits")).toBe(
			"https://ai.tuturuuu.com/449cdd3b-121b-40f7-9cee-28f5b582e204/credits?currency=VND",
		);
	});

	test("honours a configured studio origin without doubling the slash", async () => {
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "ws-1";
		process.env.TUTURUUU_AI_APP_URL = "https://ai.example.test/";
		const { aiStudioWorkspaceUrl } = await links();

		expect(aiStudioWorkspaceUrl("runs")).toBe(
			"https://ai.example.test/ws-1/runs?currency=VND",
		);
	});

	test("returns null rather than a broken link when unconfigured", async () => {
		// The sidebar hides the entry entirely on null, which is better than
		// sending an operator to a 404 on someone else's workspace.
		delete process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID;
		const { aiStudioWorkspaceUrl } = await links();
		expect(aiStudioWorkspaceUrl("usage")).toBeNull();

		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "   ";
		expect((await links()).aiStudioWorkspaceUrl("usage")).toBeNull();
	});

	test("a malformed origin yields no link instead of a bad one", async () => {
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID = "ws-1";
		process.env.TUTURUUU_AI_APP_URL = "not a url";
		const { aiStudioWorkspaceUrl } = await links();

		expect(aiStudioWorkspaceUrl("usage")).toBeNull();
	});
});

describe("the AI usage link reaches the sidebar", () => {
	test("the server layout computes it and the sidebar renders it", () => {
		// The workspace id is private configuration, so the href is built on the
		// server and passed down rather than shipped to every client.
		const layout = readFileSync("app/layout.tsx", "utf8");
		const shell = readFileSync("components/dashboard/shell.tsx", "utf8");

		expect(layout).toContain('aiUsageHref={aiStudioWorkspaceUrl("runs")}');
		expect(shell).toContain("Mức dùng AI");
		expect(shell).toContain('target="_blank"');
		expect(shell).toContain('rel="noopener noreferrer"');
	});
});
