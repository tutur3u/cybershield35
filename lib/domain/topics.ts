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

type TopicTaxonomyEntry = TopicLike & {
	keywords: string[];
};

export const MIN_TOPIC_CONFIDENCE = 30;

const MAX_INFERRED_TOPICS_PER_EVIDENCE = 3;

const STOP_WORDS = new Set([
	"bang",
	"bao",
	"cac",
	"cai",
	"cho",
	"chung",
	"cua",
	"dang",
	"duoc",
	"mot",
	"nay",
	"nhieu",
	"nhung",
	"qua",
	"tai",
	"the",
	"thong",
	"tin",
	"trong",
	"voi",
]);

const TOPIC_TAXONOMY: TopicTaxonomyEntry[] = [
	{
		keywords: [
			"nghi dinh",
			"phap luat",
			"quy dinh",
			"tin gia",
			"sai su that",
			"xu phat",
			"dinh chi",
			"quan tri vien",
			"fanpage",
			"hoi nhom",
			"xuat ban",
			"bao chi",
		],
		name: "Quy định pháp luật & Quản lý thông tin",
		riskLevel: "high",
		trend: "stable",
	},
	{
		keywords: [
			"cong an",
			"toi pham",
			"lua dao",
			"hiep dam",
			"giet",
			"so de",
			"bat",
			"khoi to",
			"thi hanh an",
			"chong nguoi",
			"fulro",
			"phan dong",
			"xuyen tac",
		],
		name: "An ninh trật tự & Tội phạm",
		riskLevel: "high",
		trend: "stable",
	},
	{
		keywords: [
			"dau tu",
			"quy hoach",
			"cum cong nghiep",
			"cang hang khong",
			"khoi cong",
			"du an",
			"xuat khau",
			"phe duyet",
			"phat trien",
		],
		name: "Phát triển kinh tế & Quy hoạch",
		riskLevel: "low",
		trend: "stable",
	},
	{
		keywords: [
			"vang",
			"trieu",
			"ty",
			"gia",
			"tai chinh",
			"ngan hang",
			"thi truong",
			"mua",
			"ban",
			"ket",
		],
		name: "Kinh tế & Tài chính",
		riskLevel: "low",
		trend: "stable",
	},
	{
		keywords: [
			"va cham",
			"tai nan",
			"duong",
			"cau",
			"xe",
			"oto",
			"o to",
			"defender",
			"mazda",
			"giao thong",
			"ha tang",
		],
		name: "Giao thông & Hạ tầng",
		riskLevel: "medium",
		trend: "stable",
	},
	{
		keywords: [
			"rac",
			"dien",
			"nuoc",
			"cup",
			"song",
			"mua gio",
			"mua lon",
			"ngap",
			"moi truong",
			"dich vu cong",
			"thu gom",
			"duc",
		],
		name: "Môi trường & Dịch vụ công cộng",
		riskLevel: "medium",
		trend: "stable",
	},
	{
		keywords: [
			"toi nay",
			"trua nay",
			"hom nay",
			"cong dong",
			"khen thuong",
			"dung cam",
			"dia phuong",
			"ngay hoi",
			"tiec cuoi",
			"rap cuoi",
			"pho",
			"phan boi chau",
		],
		name: "Sự kiện Địa phương & Cộng đồng",
		riskLevel: "low",
		trend: "stable",
	},
	{
		keywords: [
			"quan",
			"ca phe",
			"du lich",
			"am thuc",
			"view",
			"khach hang",
			"danh gia",
			"nha hang",
		],
		name: "Ẩm thực & Du lịch",
		riskLevel: "low",
		trend: "stable",
	},
	{
		keywords: [
			"bao hiem y te",
			"kham benh",
			"y te",
			"benh vien",
			"xa hoi",
			"chinh sach xa hoi",
		],
		name: "Chính sách xã hội & Y tế",
		riskLevel: "low",
		trend: "stable",
	},
	{
		keywords: [
			"chay",
			"cuu hoa",
			"pccc",
			"phong chay",
			"cuu nan",
			"ho tro",
			"an toan cong dong",
		],
		name: "An toàn cộng đồng & Cứu hỏa",
		riskLevel: "medium",
		trend: "stable",
	},
	{
		keywords: [
			"quoc te",
			"lien hop quoc",
			"xuyen quoc gia",
			"ngoai giao",
		],
		name: "Quan hệ quốc tế",
		riskLevel: "low",
		trend: "stable",
	},
	{
		keywords: ["lich su", "nha xuat ban", "hoi nha van"],
		name: "Lịch sử",
		riskLevel: "low",
		trend: "stable",
	},
];

export function normalizeTopicName(value: string) {
	return value.trim().replace(/\s+/g, " ");
}

export function normalizeSearchText(value: string) {
	return normalizeTopicName(value)
		.toLocaleLowerCase("vi-VN")
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.replace(/đ/gu, "d");
}

export function topicSlug(value: string) {
	const normalized = normalizeSearchText(value)
		.replace(/[^a-z0-9]+/gu, "-")
		.replace(/^-+|-+$/g, "");

	return normalized || "topic";
}

export function topicTokens(value: string) {
	return normalizeSearchText(value)
		.split(/[^a-z0-9]+/u)
		.filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

export function scoreEvidenceForTopic(
	topic: TopicLike,
	evidence: TopicEvidenceLike,
) {
	const tokens = topicTokens(topic.name);
	const haystack = evidenceSearchText(evidence);
	const tokenMatches = tokens.filter((token) => haystack.includes(token)).length;
	const taxonomy = findTaxonomyEntry(topic.name);
	const keywordMatches = taxonomy
		? countKeywordMatches(taxonomy.keywords, haystack)
		: 0;
	const lexicalScore = Math.min(45, tokenMatches * 18);
	const keywordScore = Math.min(70, keywordMatches * 25);
	const hasLexicalEvidence = lexicalScore + keywordScore > 0;
	const riskScore =
		hasLexicalEvidence && evidence.riskLevel === topic.riskLevel ? 10 : 0;
	const summaryScore = hasLexicalEvidence && evidence.summary ? 5 : 0;

	return lexicalScore + keywordScore + riskScore + summaryScore;
}

export function inferTopicsForEvidence(evidence: TopicEvidenceLike): TopicLike[] {
	const haystack = evidenceSearchText(evidence);
	return TOPIC_TAXONOMY.map((topic) => ({
		confidence: scoreEvidenceForTopic(topic, evidence),
		keywordMatches: countKeywordMatches(topic.keywords, haystack),
		topic,
	}))
		.filter(
			(candidate) =>
				candidate.confidence >= MIN_TOPIC_CONFIDENCE &&
				candidate.keywordMatches > 0,
		)
		.sort((left, right) => {
			if (right.confidence !== left.confidence) {
				return right.confidence - left.confidence;
			}
			return left.topic.name.localeCompare(right.topic.name);
		})
		.slice(0, MAX_INFERRED_TOPICS_PER_EVIDENCE)
		.map(({ topic }) => ({
			count: 1,
			name: topic.name,
			riskLevel: topic.riskLevel,
			trend: topic.trend,
		}));
}

export function inferTopicsFromEvidence(evidence: TopicEvidenceLike[]): TopicLike[] {
	const inferred = new Map<string, TopicLike>();

	for (const item of evidence) {
		for (const topic of inferTopicsForEvidence(item)) {
			const slug = topicSlug(topic.name);
			const existing = inferred.get(slug);
			if (!existing) {
				inferred.set(slug, topic);
				continue;
			}

			inferred.set(slug, {
				...existing,
				count: (existing.count ?? 0) + 1,
				riskLevel: maxRiskLevel(existing.riskLevel, topic.riskLevel),
			});
		}
	}

	return [...inferred.values()].sort((left, right) => {
		const countDiff = (right.count ?? 0) - (left.count ?? 0);
		if (countDiff !== 0) return countDiff;
		return left.name.localeCompare(right.name);
	});
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

	return scored
		.filter((row) => row.score >= MIN_TOPIC_CONFIDENCE)
		.slice(0, desired)
		.map((row) => ({
			confidence: Math.min(100, row.score),
			item: row.item,
		}));
}

function evidenceSearchText(evidence: TopicEvidenceLike) {
	return normalizeSearchText(
		`${evidence.quote ?? ""} ${evidence.summary ?? ""} ${
			evidence.sourceLabel ?? ""
		}`,
	);
}

function countKeywordMatches(keywords: string[], haystack: string) {
	return keywords.reduce((count, keyword) => {
		const normalized = normalizeSearchText(keyword);
		return count + (normalized && haystack.includes(normalized) ? 1 : 0);
	}, 0);
}

function findTaxonomyEntry(topicName: string) {
	const slug = topicSlug(topicName);
	return TOPIC_TAXONOMY.find((entry) => topicSlug(entry.name) === slug);
}

function maxRiskLevel(left: RiskLevel, right: RiskLevel): RiskLevel {
	const order: Record<RiskLevel, number> = {
		high: 3,
		low: 1,
		medium: 2,
	};
	return order[left] >= order[right] ? left : right;
}
