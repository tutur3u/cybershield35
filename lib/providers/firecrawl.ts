import { Firecrawl } from "firecrawl";

import { resolveCredential } from "@/lib/runtime/client-runtime";

import type { ProviderAdapter } from "./types";

export const runFirecrawl: ProviderAdapter = async (source, runtime) => {
	const credential = resolveCredential(
		process.env.FIRECRAWL_API_KEY,
		runtime?.keys.firecrawlApiKey,
	);
	if (!credential) {
		throw new Error("FIRECRAWL_API_KEY is required for website scraping");
	}

	const client = new Firecrawl({ apiKey: credential.value });
	const url = source.normalizedUrl ?? source.originalInput;
	const result = await client.scrape(url, { formats: ["markdown"] });
	const markdown = result.markdown ?? "";

	return {
		provider: "firecrawl",
		mode: "live",
		credentialSource: credential.source,
		raw: {
			title: result.metadata?.title,
			description: result.metadata?.description,
			url,
			markdown,
		},
		evidence: [
			{
				sourceUrl: url,
				sourceLabel: new URL(url).hostname.replace(/^www\./, ""),
				author: null,
				publishedAt: null,
				quote: markdown.slice(0, 1200) || result.metadata?.description || url,
				summary:
					result.metadata?.description ??
					markdown.slice(0, 220) ??
					"Nội dung web đã được trích xuất.",
				engagement: {},
				stance: "unknown",
				sentiment: "neutral",
				riskLevel: "medium",
				metadata: { firecrawlMetadata: result.metadata ?? {} },
			},
		],
	};
};

export const runFirecrawlParse: ProviderAdapter = async (source, runtime) => {
	const credential = resolveCredential(
		process.env.FIRECRAWL_API_KEY,
		runtime?.keys.firecrawlApiKey,
	);
	if (!credential) throw new Error("FIRECRAWL_API_KEY is required for document parsing");
	if (!source.fileText) throw new Error("Uploaded file text is required for parsing");

	const client = new Firecrawl({ apiKey: credential.value });
	const file = {
		data: Buffer.from(source.fileText, "utf8"),
		filename: source.fileName ?? "upload.txt",
		contentType: source.mimeType ?? "text/plain",
	};
	const result = await client.parse(file, { formats: ["markdown"] });
	const markdown = result.markdown ?? source.fileText;

	return {
		provider: "firecrawl_parse",
		mode: "live",
		credentialSource: credential.source,
		raw: { filename: source.fileName, markdown },
		evidence: [
			{
				sourceUrl: null,
				sourceLabel: source.fileName ?? "Tệp tải lên",
				author: null,
				publishedAt: null,
				quote: markdown.slice(0, 1200),
				summary: markdown.slice(0, 220) || "Tệp đã được phân tích.",
				engagement: {},
				stance: "unknown",
				sentiment: "neutral",
				riskLevel: "medium",
				metadata: { mimeType: source.mimeType },
			},
		],
	};
};
