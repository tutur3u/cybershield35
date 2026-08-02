import { createHash } from "node:crypto";

export const EVIDENCE_EMBEDDING_DIMENSIONS = 768;
export const EVIDENCE_EMBEDDING_MODEL = "google/gemini-embedding-2";
export const LOCAL_EVIDENCE_EMBEDDING_MODEL = "local/vietnamese-event-hash-v1";
export const LOCAL_RELATED_EVIDENCE_MIN_RELEVANCE = 0.28;
export const RELATED_EVIDENCE_MIN_RELEVANCE = 0.72;

const stopWords = new Set([
	"bi", "boi", "cac", "cai", "cho", "co", "cua", "da", "dang", "de",
	"den", "duoc", "gia", "khi", "khong", "la", "lai", "mot", "nay",
	"nguoi", "nhung", "o", "qua", "sau", "su", "tai", "theo", "thi",
	"trong", "tu", "va", "ve", "voi",
]);

const eventConcepts: Record<string, RegExp> = {
	"child-safety": /\b(bat coc|dan (mot )?(be|tre)|lo ngai an toan tre em|nguoi la mat.*(be|tre))\b/,
	"dropped-property": /\b(danh roi|kien hang|nhat duoc|roi hang|shipper|tra lai)\b/,
	"fraud": /\b(lua dao|mao danh|chiem doat tai san|chuyen khoan|tai khoan gia)\b/,
	"health": /\b(benh|benh nhan|dich benh|suc khoe|thuoc|y te)\b/,
	"traffic-violation": /\b(nong do con|tai nan giao thong|tong xe|va cham|vi pham giao thong|vuot den|nguoc chieu|qua toc do)\b/,
	"theft": /\b(cuop|giat|lay luon|mat cap|trom|trom cap)\b/,
};

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

export function evidenceSemanticHash(
	input: EvidenceSemanticInput,
	model = EVIDENCE_EMBEDDING_MODEL,
) {
	return createHash("sha256")
		.update(`${model}\n${evidenceSemanticText(input)}`)
		.digest("hex");
}

export function localEvidenceEmbedding(input: EvidenceSemanticInput) {
	const vector = Array.from<number>({ length: EVIDENCE_EMBEDDING_DIMENSIONS }).fill(0);
	const quote = normalizeVietnamese(input.quote);
	const summary = normalizeVietnamese(input.summary);
	const text = summary && summary !== quote ? `${quote} ${summary}` : quote;
	const tokens = text
		.split(/[^a-z0-9]+/)
		.filter((token) => token.length > 1 && !stopWords.has(token));
	for (const token of tokens) addFeature(vector, `word:${token}`, 1);
	for (let index = 1; index < tokens.length; index += 1) {
		addFeature(vector, `pair:${tokens[index - 1]}_${tokens[index]}`, 1.8);
	}
	for (const [concept, pattern] of Object.entries(eventConcepts)) {
		if (pattern.test(text)) addFeature(vector, `concept:${concept}`, 5);
	}
	const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
	return magnitude > 0 ? vector.map((value) => value / magnitude) : vector;
}

function normalizeVietnamese(value: string) {
	return value
		.toLocaleLowerCase("vi")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replaceAll("đ", "d");
}

function addFeature(vector: number[], feature: string, weight: number) {
	let hash = 2166136261;
	for (let index = 0; index < feature.length; index += 1) {
		hash ^= feature.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	const position = (hash >>> 0) % EVIDENCE_EMBEDDING_DIMENSIONS;
	vector[position] = (vector[position] ?? 0) + weight;
}
