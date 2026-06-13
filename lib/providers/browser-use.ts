import { BrowserUse } from "browser-use-sdk/v3";
import { z } from "zod";

import type { ProviderAdapter } from "./types";

const browserUseSchema = z.object({
	items: z.array(
		z.object({
			url: z.string().optional(),
			sourceLabel: z.string().optional(),
			quote: z.string(),
			summary: z.string(),
			stance: z.string().optional(),
			sentiment: z.string().optional(),
		}),
	),
});

export const runBrowserUse: ProviderAdapter = async (source) => {
	const apiKey = process.env.BROWSER_USE_API_KEY;
	if (!apiKey || process.env.DEMO_MODE === "true") {
		const { runDemoProvider } = await import("./demo");
		return runDemoProvider(source);
	}

	const client = new BrowserUse({ apiKey });
	const target = source.normalizedUrl ?? source.originalInput;
	const result = await client.run(
		`Extract public discussion evidence from ${target}. Return only public, non-sensitive topic discussion excerpts relevant to policy analysis. Do not post or interact beyond reading.`,
		{ schema: browserUseSchema, timeout: 180_000 },
	);

	return {
		provider: "browser_use",
		mode: "live",
		raw: { sessionId: result.id, output: result.output },
		evidence: result.output.items.map((item) => ({
			sourceUrl: item.url ?? target,
			sourceLabel: item.sourceLabel ?? "Social source",
			author: null,
			publishedAt: null,
			quote: item.quote.slice(0, 1200),
			summary: item.summary,
			engagement: {},
			stance: item.stance ?? "unknown",
			sentiment: item.sentiment ?? "neutral",
			riskLevel: "medium",
			metadata: { browserUseSessionId: result.id },
		})),
	};
};
