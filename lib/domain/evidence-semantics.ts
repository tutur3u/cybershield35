import { createHash } from "node:crypto";

export const EVIDENCE_EMBEDDING_DIMENSIONS = 768;
export const EVIDENCE_EMBEDDING_MODEL = "google/gemini-embedding-2";
export const LOCAL_EVIDENCE_EMBEDDING_MODEL = "local/vietnamese-event-hash-v1";
export const LOCAL_RELATED_EVIDENCE_MIN_RELEVANCE = 0.5;
export const RELATED_EVIDENCE_MIN_RELEVANCE = 0.72;

export type EvidenceRelationship = "same_event" | "strongly_related" | "related";

export type EvidenceRelationshipInput = {
	author: string | null;
	publishedAt: string | null;
	quote: string;
	sourceUrl: string | null;
	summary: string;
	topicSlugs: string[];
};

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
	"theft": /\b(cuop|giat|lay luon|mat cap|tien tay lay|trom|trom cap)\b/,
};

const eventConceptLabels: Record<string, string> = {
	"child-safety": "Cùng mối lo an toàn trẻ em",
	"dropped-property": "Cùng tình huống thất lạc tài sản",
	fraud: "Cùng dấu hiệu lừa đảo",
	health: "Cùng vấn đề sức khỏe",
	"traffic-violation": "Cùng hành vi vi phạm giao thông",
	theft: "Cùng hành vi trộm cắp",
};

export type EvidenceSemanticInput = {
	author: string | null;
	id: string;
	quote: string;
	sourceLabel: string | null;
	summary: string;
};

export function evidenceSemanticText(input: EvidenceSemanticInput) {
	const quote = compactEmbeddingField(input.quote, 6_000);
	const normalizedQuote = compactText(input.quote);
	const normalizedSummary = compactText(input.summary);
	const includeSummary =
		Boolean(normalizedSummary) &&
		normalizedSummary !== normalizedQuote &&
		!normalizedQuote.startsWith(normalizedSummary);
	return [
		`Sự kiện: ${quote}`,
		includeSummary
			? `Diễn giải: ${compactEmbeddingField(input.summary, 1_200)}`
			: null,
	]
		.filter(Boolean)
		.join("\n");
}

export function rankEvidenceRelationship(
	target: EvidenceRelationshipInput,
	candidate: EvidenceRelationshipInput,
	semanticSimilarity: number,
) {
	const targetText = normalizeVietnamese(`${target.quote} ${target.summary}`);
	const candidateText = normalizeVietnamese(
		`${candidate.quote} ${candidate.summary}`,
	);
	const normalizedTargetQuote = compactText(target.quote);
	const normalizedCandidateQuote = compactText(candidate.quote);
	const exactContent = normalizedTargetQuote === normalizedCandidateQuote;
	const exactUrl = Boolean(
		target.sourceUrl && candidate.sourceUrl && target.sourceUrl === candidate.sourceUrl,
	);
	if (exactContent || exactUrl) {
		return {
			reasons: [exactContent ? "Nội dung trùng khớp" : "Cùng bài viết gốc"],
			relationship: "same_event" as const,
			score: 1,
			semanticSimilarity: clamp01(semanticSimilarity),
		};
	}

	const targetTokens = meaningfulTokens(targetText);
	const candidateTokens = meaningfulTokens(candidateText);
	const lexicalOverlap = containmentOverlap(targetTokens, candidateTokens);
	const targetConcepts = detectEventConcepts(targetText);
	const candidateConcepts = detectEventConcepts(candidateText);
	const sharedConcepts = targetConcepts.filter((concept) =>
		candidateConcepts.includes(concept),
	);
	const conceptConflict =
		targetConcepts.length > 0 &&
		candidateConcepts.length > 0 &&
		sharedConcepts.length === 0;
	const sharedTopics = candidate.topicSlugs.filter((slug) =>
		target.topicSlugs.includes(slug),
	);
	const daysApart = dateDistanceDays(target.publishedAt, candidate.publishedAt);
	const closeInTime = daysApart !== null && daysApart <= 7;
	const conceptBonus = Math.min(0.16, sharedConcepts.length * 0.12);
	const topicBonus = Math.min(0.025, sharedTopics.length * 0.01);
	const timeBonus = closeInTime ? 0.02 : 0;
	const conflictPenalty = conceptConflict ? 0.18 : 0;
	const score = clamp01(
		clamp01(semanticSimilarity) * 0.72 +
			lexicalOverlap * 0.2 +
			conceptBonus +
			topicBonus +
			timeBonus -
			conflictPenalty,
	);
	const reasons = sharedConcepts
		.map((concept) => eventConceptLabels[concept])
		.filter((reason): reason is string => Boolean(reason));
	if (lexicalOverlap >= 0.34) reasons.push("Chung chi tiết sự kiện");
	if (sharedTopics.length > 0) {
		reasons.push(`Chung ${sharedTopics.length} chủ đề`);
	}
	if (closeInTime && (sharedConcepts.length > 0 || lexicalOverlap >= 0.34)) {
		reasons.push("Gần thời điểm");
	}
	if (
		target.author &&
		candidate.author &&
		target.author === candidate.author &&
		(sharedConcepts.length > 0 || lexicalOverlap >= 0.34)
	) {
		reasons.push("Cùng nguồn đăng");
	}
	if (reasons.length === 0 && semanticSimilarity >= 0.82) {
		reasons.push("Ngữ nghĩa sự kiện tương đồng cao");
	}

	return {
		reasons: reasons.slice(0, 3),
		relationship:
			score >= 0.82 && (sharedConcepts.length > 0 || lexicalOverlap >= 0.48)
				? ("strongly_related" as const)
				: ("related" as const),
		score,
		semanticSimilarity: clamp01(semanticSimilarity),
	};
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

function compactText(value: string) {
	return normalizeVietnamese(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function compactEmbeddingField(value: string, maximumLength: number) {
	const compacted = value.replace(/\s+/g, " ").trim();
	if (compacted.length <= maximumLength) return compacted;
	const tailLength = Math.min(800, Math.floor(maximumLength / 4));
	return `${compacted.slice(0, maximumLength - tailLength - 3)}...${compacted.slice(-tailLength)}`;
}

function meaningfulTokens(value: string) {
	return new Set(
		value
			.split(/[^a-z0-9]+/)
			.map(canonicalToken)
			.filter((token) => token.length > 1 && !stopWords.has(token)),
	);
}

function canonicalToken(token: string) {
	if (token === "non") return "mu";
	if (token === "tre" || token === "chau") return "be";
	if (token === "lay" || token === "trom") return "cuop-tai-san";
	return token;
}

function containmentOverlap(left: Set<string>, right: Set<string>) {
	if (!left.size || !right.size) return 0;
	let intersection = 0;
	for (const token of left) {
		if (right.has(token)) intersection += 1;
	}
	return intersection / Math.min(left.size, right.size);
}

function detectEventConcepts(value: string) {
	return Object.entries(eventConcepts)
		.filter(([, pattern]) => pattern.test(value))
		.map(([concept]) => concept);
}

function dateDistanceDays(left: string | null, right: string | null) {
	if (!left || !right) return null;
	const distance = Math.abs(new Date(left).getTime() - new Date(right).getTime());
	return Number.isFinite(distance) ? distance / 86_400_000 : null;
}

function clamp01(value: number) {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
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
