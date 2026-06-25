import type { ProviderName, SourceRow } from "@/lib/db/schema";

import { createApifyAdapter } from "./apify";
import { runBrowserUse } from "./browser-use";
import { runFirecrawl, runFirecrawlParse } from "./firecrawl";
import { runLocalText } from "./local-text";
import type { ProviderResult } from "./types";

export async function runProvider(
	provider: ProviderName,
	source: SourceRow,
): Promise<ProviderResult> {
	switch (provider) {
		case "apify_facebook_posts":
		case "apify_facebook_comments":
		case "apify_facebook_groups":
			return createApifyAdapter(provider)(source);
		case "firecrawl":
			return runFirecrawl(source);
		case "firecrawl_parse":
			return runFirecrawlParse(source);
		case "browser_use":
			return runBrowserUse(source);
		case "local_text":
			return runLocalText(source);
		default:
			throw new Error(`Provider ${provider} is not available in production`);
	}
}

export function getProviderAvailability() {
	const openAiConfigured = Boolean(
		process.env.OPENAI_API_KEY ||
			(process.env.LLM_BASE_URL && process.env.LLM_API_KEY),
	);
	const googleConfigured = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

	return {
		apify: Boolean(process.env.APIFY_TOKEN),
		firecrawl: Boolean(process.env.FIRECRAWL_API_KEY),
		browserUse: Boolean(process.env.BROWSER_USE_API_KEY),
		openai: openAiConfigured,
		googleGenerativeAi: googleConfigured,
		llm: openAiConfigured || googleConfigured,
	};
}
