import type { AnalysisOutput, AnalysisProof } from "@/lib/llm/schemas";

export type EvidenceForAnalysis = {
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
		"giao thong",
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
	const evidenceById = new Map(evidence.map((item) => [item.id, item]));
	const claims = analysis.claims
		.slice(0, 12)
		.map((claim) => {
			const proofs = validateProofs(claim.proofs, evidenceById, (item) =>
				isConclusionCompatible(claim.claim, item),
			);
			return {
				...claim,
				claim: boundedText(claim.claim, 1_500),
				confidence: proofConfidence(proofs),
				evidenceIds: uniqueStrings(proofs.map((proof) => proof.evidenceId)),
				proofs,
				rationale: proofRationale(proofs, 1_500),
				stance: boundedText(claim.stance, 120),
			};
		})
		.filter((claim) => claim.proofs.length > 0);
	const riskFlags = analysis.riskFlags
		.slice(0, 10)
		.map((flag) => {
			const proofs = validateProofs(flag.proofs, evidenceById, (item) =>
				scoreRiskFlagEvidence(flag.label, item) > 0,
			);
			const linkedIds = uniqueStrings(proofs.map((proof) => proof.evidenceId));
			return {
				...flag,
				confidence: proofConfidence(proofs),
				count: linkedIds.length,
				evidenceIds: linkedIds,
				label: boundedText(flag.label, 180),
				proofs,
				rationale: proofRationale(proofs, 1_500),
			};
		})
		.filter((flag) => flag.proofs.length > 0);
	const seenTopics = new Set<string>();
	const topicClusters = analysis.topicClusters
		.slice(0, 12)
		.filter((topic) => {
			const key = normalizeAnalysisText(topic.name);
			if (!key || seenTopics.has(key)) return false;
			seenTopics.add(key);
			return true;
		})
		.map((topic) => ({
			...topic,
			count: Math.min(evidence.length, topic.count),
			name: boundedText(topic.name, 160),
			trend: boundedText(topic.trend, 160),
		}));
	const sentiment = {
		negative: analysis.sentiment.negative,
		neutral: analysis.sentiment.neutral,
		positive: analysis.sentiment.positive,
		total:
			analysis.sentiment.negative +
			analysis.sentiment.neutral +
			analysis.sentiment.positive,
	};

	return {
		...analysis,
		claims,
		riskFlags,
		sentiment,
		stanceSummary: boundedText(analysis.stanceSummary, 2_000),
		summary: boundedText(analysis.summary, 5_000),
		topicClusters,
	};
}

export function isProofExcerptGrounded(
	proof: Pick<AnalysisProof, "excerpt">,
	evidence: EvidenceForAnalysis,
) {
	const excerpt = normalizeProofText(proof.excerpt);
	if (excerpt.length < 12) return false;
	return [evidence.quote, evidence.summary].some(
		(value) => value && normalizeProofText(value).includes(excerpt),
	);
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

function normalizeProofText(value: string) {
	return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

function validateProofs(
	proofs: AnalysisProof[],
	evidenceById: Map<string, EvidenceForAnalysis>,
	isCompatible: (evidence: EvidenceForAnalysis) => boolean = () => true,
) {
	const seenEvidence = new Set<string>();
	return proofs
		.filter((proof) => {
			if (seenEvidence.has(proof.evidenceId)) return false;
			const item = evidenceById.get(proof.evidenceId);
			if (!item || !isCompatible(item) || !isProofExcerptGrounded(proof, item)) {
				return false;
			}
			seenEvidence.add(proof.evidenceId);
			return true;
		})
		.slice(0, 3)
		.map((proof) => ({
			...proof,
			excerpt: boundedText(proof.excerpt, 500),
			limitation: proofLimitation(
				proof,
				evidenceById.get(proof.evidenceId),
			),
			support: boundedText(proof.support, 800),
		}));
}

function isConclusionCompatible(
	conclusion: string,
	evidence: EvidenceForAnalysis,
) {
	const conclusionConcepts = detectConcepts(normalizeAnalysisText(conclusion));
	if (!conclusionConcepts.length) return true;
	const evidenceConcepts = detectConcepts(
		normalizeAnalysisText(
			[evidence.quote, evidence.summary].filter(Boolean).join(" "),
		),
	);
	return conclusionConcepts.some((concept) => evidenceConcepts.includes(concept));
}

function proofConfidence(proofs: AnalysisProof[]) {
	if (!proofs.length) return 0;
	return proofs.reduce((sum, proof) => sum + proof.confidence, 0) / proofs.length;
}

function proofLimitation(
	proof: AnalysisProof,
	evidence: EvidenceForAnalysis | undefined,
) {
	if (proof.limitation) return boundedText(proof.limitation, 500);
	const support = normalizeAnalysisText(proof.support);
	const source = normalizeAnalysisText(
		[evidence?.quote, evidence?.summary].filter(Boolean).join(" "),
	);
	if (support.includes("bat coc") && !source.includes("bat coc")) {
		return "Nguồn mô tả hành vi tiếp cận hoặc dẫn trẻ đi, chưa xác nhận ý định bắt cóc.";
	}
	return null;
}

function proofRationale(proofs: AnalysisProof[], maxLength: number) {
	return boundedText(
		proofs.map((proof) => proof.support.trim()).filter(Boolean).join(" "),
		maxLength,
	);
}

function boundedText(value: string, maxLength: number) {
	return value.trim().slice(0, maxLength);
}

function uniqueStrings(values: string[]) {
	return [...new Set(values.filter(Boolean))];
}
