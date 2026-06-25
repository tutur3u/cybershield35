import { afterEach, describe, expect, mock, test } from "bun:test";

import type { SourceRow } from "@/lib/db/schema";

const originalEnv = { ...process.env };

let browserUseResult: {
	id: string;
	output: { items: Array<Record<string, unknown>> };
} = { id: "session-empty", output: { items: [] } };

mock.module("browser-use-sdk/v3", () => ({
	BrowserUse: class {
		async run() {
			return browserUseResult;
		}
	},
}));

afterEach(() => {
	process.env = { ...originalEnv };
	browserUseResult = { id: "session-empty", output: { items: [] } };
});

describe("runBrowserUse", () => {
	test("maps structured Browser Use output into normalized evidence", async () => {
		process.env.BROWSER_USE_API_KEY = "server-browser-use-key";
		browserUseResult = {
			id: "session-123",
			output: {
				items: [
					{
						url: "https://example.com/thread",
						sourceLabel: "Example thread",
						quote: "Public quote about a policy topic",
						summary: "A concise public discussion summary",
						stance: "critical",
						sentiment: "negative",
					},
				],
			},
		};

		const { runBrowserUse } = await import("@/lib/providers/browser-use");
		const result = await runBrowserUse(urlSource("https://example.com/thread"));

		expect(result).toMatchObject({
			provider: "browser_use",
			mode: "live",
			credentialSource: "server",
		});
		expect(result.raw).toEqual({
			sessionId: "session-123",
			output: browserUseResult.output,
		});
		expect(result.evidence).toEqual([
			expect.objectContaining({
				sourceUrl: "https://example.com/thread",
				sourceLabel: "Example thread",
				quote: "Public quote about a policy topic",
				summary: "A concise public discussion summary",
				stance: "critical",
				sentiment: "negative",
				metadata: { browserUseSessionId: "session-123" },
			}),
		]);
	});

	test("throws a clear error when Browser Use returns no evidence", async () => {
		process.env.BROWSER_USE_API_KEY = "server-browser-use-key";
		const { runBrowserUse } = await import("@/lib/providers/browser-use");

		await expect(runBrowserUse(urlSource("https://example.com"))).rejects.toThrow(
			"Browser Use returned no evidence for the URL",
		);
	});
});

function urlSource(url: string): SourceRow {
	return {
		id: "source-1",
		type: "url",
		originalInput: url,
		normalizedUrl: url,
		title: "Example",
		mimeType: null,
		fileName: null,
		fileText: null,
		metadata: {},
		createdAt: new Date(),
		updatedAt: new Date(),
	} as SourceRow;
}
