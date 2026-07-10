import type { ProviderName, SourceRow } from "@/lib/db/schema";

import type { ProviderResult } from "./types";

export async function runProvider(
	provider: ProviderName,
	source: SourceRow,
): Promise<ProviderResult> {
	switch (provider) {
		case "apify_facebook_posts":
		case "apify_facebook_comments":
		case "apify_facebook_groups": {
			const { createApifyAdapter } = await import("./apify");
			return createApifyAdapter(provider)(source);
		}
		case "firecrawl": {
			const { runFirecrawl } = await import("./firecrawl");
			return runFirecrawl(source);
		}
		case "firecrawl_parse": {
			const { runFirecrawlParse } = await import("./firecrawl");
			return runFirecrawlParse(source);
		}
		case "browser_use": {
			const { runBrowserUse } = await import("./browser-use");
			return runBrowserUse(source);
		}
		case "local_text": {
			const { runLocalText } = await import("./local-text");
			return runLocalText(source);
		}
		default:
			throw new Error(`Provider ${provider} is not available in production`);
	}
}

export { getProviderAvailability } from "./availability";
