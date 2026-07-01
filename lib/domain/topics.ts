import type { RiskLevel } from "@/lib/db/schema";

export type TopicLike = {
	count?: number;
	name: string;
	riskLevel: RiskLevel;
	trend?: string;
};

export type TopicEvidenceLike = {
	id: string;
	quote?: string | null;
	riskLevel?: RiskLevel | null;
	sourceLabel?: string | null;
	summary?: string | null;
};

const STOP_WORDS = new Set([
	"các",
	"cho",
	"của",
	"đang",
	"được",
	"một",
	"những",
	"the",
	"trong",
	"và",
	"về",
	"với",
]);

export function normalizeTopicName(value: string) {
	return value.trim().replace(/\s+/g, " ");
}

export function topicSlug(value: string) {
	const normalized = normalizeTopicName(value)
		.toLocaleLowerCase("vi-VN")
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.replace(/đ/gu, "d")
		.replace(/[^a-z0-9]+/gu, "-")
		.replace(/^-+|-+$/g, "");

	return normalized || "topic";
}

export function topicTokens(value: string) {
	return normalizeTopicName(value)
		.toLocaleLowerCase("vi-VN")
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.replace(/đ/gu, "d")
		.split(/[^a-z0-9]+/u)
		.filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

export function scoreEvidenceForTopic(
	topic: TopicLike,
	evidence: TopicEvidenceLike,
) {
	const tokens = topicTokens(topic.name);
	const haystack = `${evidence.quote ?? ""} ${evidence.summary ?? ""} ${
		evidence.sourceLabel ?? ""
	}`
		.toLocaleLowerCase("vi-VN")
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.replace(/đ/gu, "d");
	const tokenScore = tokens.reduce(
		(score, token) => score + (haystack.includes(token) ? 30 : 0),
		0,
	);
	const riskScore = evidence.riskLevel === topic.riskLevel ? 15 : 0;
	const summaryScore = evidence.summary ? 5 : 0;

	return tokenScore + riskScore + summaryScore;
}

export function selectEvidenceForTopic<TEvidence extends TopicEvidenceLike>(
	topic: TopicLike,
	evidence: TEvidence[],
) {
	const desired = Math.max(1, Math.min(topic.count ?? 3, evidence.length || 1));
	const scored = evidence
		.map((item) => ({ item, score: scoreEvidenceForTopic(topic, item) }))
		.sort((left, right) => {
			if (right.score !== left.score) return right.score - left.score;
			return left.item.id.localeCompare(right.item.id);
		});

	const directMatches = scored.filter((row) => row.score >= 30);
	const candidates = directMatches.length ? directMatches : scored;

	return candidates.slice(0, desired).map((row) => ({
		confidence: Math.max(5, Math.min(100, row.score)),
		item: row.item,
	}));
}
