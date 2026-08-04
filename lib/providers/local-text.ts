import { assessEvidenceRisk } from "@/lib/domain/evidence-risk";

import type { ProviderAdapter } from "./types";

export const runLocalText: ProviderAdapter = async (source) => {
	const text = source.fileText ?? source.originalInput;
	const excerpt = text.slice(0, 1200);
	const assessment = assessEvidenceRisk({ text });

	return {
		provider: source.type === "file" ? "local_text" : "local_text",
		mode: "live",
		credentialSource: "none",
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
				riskLevel: assessment.level,
				metadata: { mimeType: source.mimeType, riskReasons: assessment.reasons },
			},
		],
	};
};
