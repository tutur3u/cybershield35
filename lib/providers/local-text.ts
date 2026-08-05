import { assessEvidenceRisk } from "@/lib/domain/evidence-risk";
import { fitTextToLimit } from "@/lib/domain/text-fit";

import type { ProviderAdapter } from "./types";

export const runLocalText: ProviderAdapter = async (source) => {
	const text = source.fileText ?? source.originalInput;
	const excerpt = fitTextToLimit(text, 1_200, { ellipsis: true });
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
				summary:
					fitTextToLimit(excerpt, 220, { preferredLength: 140 }) ||
					"Nội dung văn bản cần phân tích.",
				engagement: {},
				stance: "unknown",
				sentiment: "neutral",
				riskLevel: assessment.level,
				metadata: { mimeType: source.mimeType, riskReasons: assessment.reasons },
			},
		],
	};
};
