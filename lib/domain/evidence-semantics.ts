import { createHash } from "node:crypto";

export const EVIDENCE_EMBEDDING_DIMENSIONS = 768;
export const EVIDENCE_EMBEDDING_MODEL = "google/gemini-embedding-2";
export const RELATED_EVIDENCE_MIN_RELEVANCE = 0.72;

export type EvidenceSemanticInput = {
	author: string | null;
	id: string;
	quote: string;
	sourceLabel: string | null;
	summary: string;
};

export function evidenceSemanticText(input: EvidenceSemanticInput) {
	return [
		"Tài liệu bằng chứng truyền thông cần được so khớp theo sự kiện, chủ thể, hành vi và mối lo ngại cụ thể.",
		input.sourceLabel ? `Nguồn: ${input.sourceLabel}` : null,
		input.author ? `Tác giả: ${input.author}` : null,
		`Nội dung: ${input.quote}`,
		input.summary && input.summary !== input.quote
			? `Tóm tắt: ${input.summary}`
			: null,
	]
		.filter(Boolean)
		.join("\n");
}

export function evidenceSemanticHash(input: EvidenceSemanticInput) {
	return createHash("sha256")
		.update(`${EVIDENCE_EMBEDDING_MODEL}\n${evidenceSemanticText(input)}`)
		.digest("hex");
}
