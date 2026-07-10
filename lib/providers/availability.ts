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
