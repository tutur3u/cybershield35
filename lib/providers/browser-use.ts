import { BrowserUse } from "browser-use-sdk/v3";
import { z } from "zod";

import { resolveCredential } from "@/lib/runtime/client-runtime";

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
	const credential = resolveCredential(process.env.BROWSER_USE_API_KEY);
	if (!credential) {
		throw new Error("BROWSER_USE_API_KEY is required for Browser Use scans");
	}

	const client = new BrowserUse({ apiKey: credential.value });
	const target = source.normalizedUrl ?? source.originalInput;
	const result = await client.run(
		`Extract public discussion evidence from ${target}. Return only public, non-sensitive topic discussion excerpts relevant to policy analysis. Do not post or interact beyond reading.`,
		{ schema: browserUseSchema, timeout: 180_000 },
	);
	const items = result.output.items;

	if (items.length === 0) {
		throw new Error("Browser Use returned no evidence for the URL");
	}

	return {
		provider: "browser_use",
		mode: "live",
		credentialSource: credential.source,
		raw: { sessionId: result.id, output: result.output },
		evidence: items.map((item) => ({
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
