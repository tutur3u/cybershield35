import type { ProviderAdapter } from "./types";

export const runLocalText: ProviderAdapter = async (source) => {
	const text = source.fileText ?? source.originalInput;
	const excerpt = text.slice(0, 1200);

	return {
		provider: source.type === "file" ? "local_text" : "local_text",
		mode: "demo",
		raw: {
			source: source.fileName ?? "manual-text",
			length: text.length,
		},
		evidence: [
			{
				sourceUrl: source.normalizedUrl,
				sourceLabel: source.fileName ?? "Văn bản nhập thủ công",
				author: null,
				publishedAt: null,
				quote: excerpt || "Không có nội dung.",
				summary: excerpt.slice(0, 220) || "Nội dung văn bản cần phân tích.",
				engagement: {},
				stance: "unknown",
				sentiment: "neutral",
				riskLevel: text.length > 3000 ? "medium" : "low",
				metadata: { mimeType: source.mimeType },
			},
		],
	};
};
