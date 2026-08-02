import type { AnalysisOutput } from "@/lib/llm/schemas";

type EvidenceForAnalysis = {
	id: string;
	quote?: string | null;
	summary?: string | null;
	sourceLabel?: string | null;
	author?: string | null;
	stance?: string | null;
	sentiment?: string | null;
};

type RiskFlagForAnalysis = {
	label: string;
	evidenceIds?: string[];
};

type RiskConcept = keyof typeof CONCEPT_PATTERNS;

const CONCEPT_PATTERNS = {
	childSafety: [
		"an toan tre em",
		"bao ve tre em",
		"tre nho",
		"be gai",
		"be trai",
		"con nho",
		"bat coc",
		"du do",
		"xam hai",
		"nguoi la",
		"dan mot be",
		"tiep can tre",
	],
	trafficViolation: [
		"vi pham giao thong",
		"vi pham atgt",
		"an toan giao thong",
		"vuot den do",
		"nong do con",
		"qua toc do",
		"khong doi mu",
		"lan lan",
		"di nguoc chieu",
		"dua xe",
		"tai nan giao thong",
		"va cham giao thong",
		"tong xe",
	],
	violenceCrime: [
		"bao luc",
		"hanh hung",
		"dam chem",
		"cuop giat",
		"giet nguoi",
		"vu khi",
	],
	pettyCrime: [
		"toi pham vat",
		"trom cap",
		"lay trom",
		"lay cap",
		"lay luon",
		"moc tui",
		"trom vat",
	],
	fireExplosion: ["chay no", "hoa hoan", "dam chay", "ro ri khi", "phat no"],
	healthSafety: [
		"an toan thuc pham",
		"ngo doc",
		"dich benh",
		"suc khoe cong dong",
		"thuoc gia",
	],
	fraudScam: [
		"lua dao",
		"gia mao",
		"chiem doat",
		"lua tien",
		"scam",
		"da cap",
	],
	cyberSecurity: [
		"an ninh mang",
		"tan cong mang",
		"lo du lieu",
		"ma doc",
		"hack tai khoan",
		"danh cap du lieu",
	],
	misinformation: [
		"tin gia",
		"thong tin sai lech",
		"tin don",
		"xuyen tac",
		"gia thuyet vo can cu",
	],
} as const;

const STOP_WORDS = new Set([
	"anh",
	"bao",
	"bang",
	"cac",
	"cai",
	"cho",
	"cua",
	"dang",
	"day",
	"den",
	"duoc",
	"gio",
	"khac",
	"khi",
	"khong",
	"la",
	"lien",
	"lo",
	"mot",
	"nay",
	"nghiem",
	"nhung",
	"quan",
	"su",
	"tin",
	"trong",
	"tren",
	"ve",
	"voi",
]);

export type RiskFlagEvidenceResolution<T extends EvidenceForAnalysis> = {
	evidence: T[];
	rejectedCitationCount: number;
	source: "cited" | "semantic" | "none";
};

export function resolveRiskFlagEvidence<T extends EvidenceForAnalysis>(
	flag: RiskFlagForAnalysis,
	evidence: T[],
	limit = 3,
): RiskFlagEvidenceResolution<T> {
	const evidenceById = new Map(evidence.map((item) => [item.id, item]));
	const citedIds = uniqueStrings(flag.evidenceIds ?? []);
	const cited = citedIds
		.map((id) => evidenceById.get(id))
		.filter((item): item is T => Boolean(item));
	const compatibleCitations = cited.filter(
		(item) => scoreRiskFlagEvidence(flag.label, item) > 0,
	);

	if (citedIds.length) {
		return {
			evidence: compatibleCitations.slice(0, limit),
			rejectedCitationCount: citedIds.length - compatibleCitations.length,
			source: compatibleCitations.length ? "cited" : "none",
		};
	}

	const semanticMatches = evidence
		.map((item) => ({ item, score: scoreRiskFlagEvidence(flag.label, item) }))
		.filter((row) => row.score > 0)
		.sort((a, b) => b.score - a.score)
		.map((row) => row.item)
		.slice(0, limit);

	return {
		evidence: semanticMatches,
		rejectedCitationCount: 0,
		source: semanticMatches.length ? "semantic" : "none",
	};
}

export function scoreRiskFlagEvidence(
	label: string,
	evidence: EvidenceForAnalysis,
) {
	const normalizedLabel = normalizeAnalysisText(label);
	const normalizedEvidence = normalizeAnalysisText(
		[
			evidence.quote,
			evidence.summary,
			evidence.sourceLabel,
			evidence.author,
			evidence.stance,
			evidence.sentiment,
		]
			.filter(Boolean)
			.join(" "),
	);
	const labelConcepts = detectConcepts(normalizedLabel);
	const evidenceConcepts = detectConcepts(normalizedEvidence);

	if (labelConcepts.length) {
		const sharedConcepts = labelConcepts.filter((concept) =>
			evidenceConcepts.includes(concept),
		);
		if (!sharedConcepts.length) return 0;
		return 100 + sharedConcepts.length * 20;
	}

	const labelTokens = meaningfulTokens(normalizedLabel);
	const evidenceTokens = new Set(meaningfulTokens(normalizedEvidence));
	const exactMatches = labelTokens.filter((token) => evidenceTokens.has(token));
	return exactMatches.length >= 2 ? exactMatches.length * 10 : 0;
}

export function validateAnalysisEvidenceLinks(
	analysis: AnalysisOutput,
	evidence: EvidenceForAnalysis[],
): AnalysisOutput {
	const evidenceIds = new Set(evidence.map((item) => item.id));
	const claims = analysis.claims.map((claim) => ({
		...claim,
		evidenceIds: uniqueStrings(claim.evidenceIds).filter((id) =>
			evidenceIds.has(id),
		),
	}));
	const riskFlags = analysis.riskFlags
		.map((flag) => {
			const resolution = resolveRiskFlagEvidence(flag, evidence, evidence.length);
			const linkedIds = resolution.evidence.map((item) => item.id);
			return { ...flag, count: linkedIds.length, evidenceIds: linkedIds };
		})
		.filter((flag) => flag.evidenceIds.length > 0);

	return { ...analysis, claims, riskFlags };
}

export function normalizeAnalysisText(value: string) {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/đ/g, "d")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function detectConcepts(value: string) {
	return (Object.entries(CONCEPT_PATTERNS) as Array<
		[RiskConcept, readonly string[]]
	>)
		.filter(([, patterns]) => patterns.some((pattern) => value.includes(pattern)))
		.map(([concept]) => concept);
}

function meaningfulTokens(value: string) {
	return value
		.split(" ")
		.filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function uniqueStrings(values: string[]) {
	return [...new Set(values.filter(Boolean))];
}
