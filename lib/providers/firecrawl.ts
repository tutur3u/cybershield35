import { Firecrawl } from "firecrawl";

import { assessEvidenceRisk } from "@/lib/domain/evidence-risk";
import { resolveCredential } from "@/lib/runtime/client-runtime";

import type { ProviderAdapter } from "./types";

export const runFirecrawl: ProviderAdapter = async (source) => {
	const credential = resolveCredential(process.env.FIRECRAWL_API_KEY);
	if (!credential) {
		throw new Error("FIRECRAWL_API_KEY is required for website scraping");
	}

	const client = new Firecrawl({ apiKey: credential.value });
	const url = source.normalizedUrl ?? source.originalInput;
	const result = await client.scrape(url, { formats: ["markdown"] });
	const markdown = result.markdown ?? "";
	const assessment = assessEvidenceRisk({
		text: `${result.metadata?.title ?? ""}\n${result.metadata?.description ?? ""}\n${markdown}`,
	});

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
				riskLevel: assessment.level,
				metadata: {
					firecrawlMetadata: result.metadata ?? {},
					riskReasons: assessment.reasons,
				},
			},
		],
	};
};

export const runFirecrawlParse: ProviderAdapter = async (source) => {
	const credential = resolveCredential(process.env.FIRECRAWL_API_KEY);
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
	const assessment = assessEvidenceRisk({ text: markdown });

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
				riskLevel: assessment.level,
				metadata: { mimeType: source.mimeType, riskReasons: assessment.reasons },
			},
		],
	};
};
