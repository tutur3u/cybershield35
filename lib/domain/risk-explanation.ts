import {
	assessEvidenceRisk,
	EVIDENCE_RISK_CATEGORY_LABELS,
	type EvidenceRiskCategory,
} from "@/lib/domain/evidence-risk";

/**
 * A risk level on its own is an assertion, not information. "Cao" tells a
 * reviewer to look, but not what to look for or whether the machine understood
 * the post at all. Every surface that shows a level therefore shows the same
 * explanation with it: which signals fired, what they were categorised as, how
 * confident the classifier was, and whether a model or the offline rubric
 * decided.
 *
 * The classifier already writes all of this to evidence metadata; this module is
 * the one place that reads it back, so the wording cannot drift between the
 * timeline, the detail page and the intelligence views.
 */
export type RiskExplanation = {
	categoryLabels: string[];
	/** 0–1 when the classifier reported one. */
	confidence: number | null;
	/** True when a model decided, false when the offline rubric did. */
	fromModel: boolean;
	reasons: string[];
};

type RiskMetadata = Record<string, unknown> | null | undefined;

function stringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((entry): entry is string => typeof entry === "string")
		: [];
}

function isRiskCategory(value: string): value is EvidenceRiskCategory {
	return value in EVIDENCE_RISK_CATEGORY_LABELS;
}

/**
 * Builds the explanation for one evidence item.
 *
 * Falls back to re-running the offline rubric when metadata is absent, so rows
 * collected before the classifier existed still explain themselves rather than
 * showing a bare badge.
 */
export function explainEvidenceRisk(item: {
	engagement?: unknown;
	metadata?: RiskMetadata;
	quote?: string | null;
	riskLevel?: string | null;
	summary?: string | null;
}): RiskExplanation {
	const metadata = item.metadata ?? undefined;
	const storedReasons = stringArray(metadata?.riskReasons);
	const storedCategories = stringArray(metadata?.riskCategories).filter(
		isRiskCategory,
	);
	const classifier = metadata?.riskClassifier;
	const confidence = metadata?.riskConfidence;

	if (storedReasons.length || storedCategories.length) {
		return {
			categoryLabels: storedCategories.map(
				(category) => EVIDENCE_RISK_CATEGORY_LABELS[category],
			),
			confidence: typeof confidence === "number" ? confidence : null,
			fromModel: classifier === "llm",
			reasons: storedReasons,
		};
	}

	const engagement = item.engagement as
		| { comments?: number; shares?: number }
		| undefined;
	const assessment = assessEvidenceRisk({
		comments: engagement?.comments,
		shares: engagement?.shares,
		storedRisk: item.riskLevel as never,
		text: item.quote ?? item.summary ?? "",
	});

	return {
		categoryLabels: assessment.categories.map(
			(category) => EVIDENCE_RISK_CATEGORY_LABELS[category],
		),
		confidence: null,
		fromModel: false,
		reasons: assessment.reasons,
	};
}

/**
 * Explanation for an analysis-level risk level, which is derived from its risk
 * flags rather than from text signals.
 */
export function explainAnalysisRisk(flags: unknown): RiskExplanation {
	const reasons = Array.isArray(flags)
		? flags
				.map((flag) => {
					if (typeof flag === "string") return flag;
					if (flag && typeof flag === "object") {
						const record = flag as Record<string, unknown>;
						const label =
							typeof record.label === "string"
								? record.label
								: typeof record.title === "string"
									? record.title
									: null;
						const detail =
							typeof record.description === "string" ? record.description : null;
						if (label && detail) return `${label}: ${detail}`;
						return label ?? detail;
					}
					return null;
				})
				.filter((reason): reason is string => Boolean(reason))
		: [];

	return {
		categoryLabels: [],
		confidence: null,
		fromModel: false,
		reasons: reasons.length
			? reasons
			: ["Mức rủi ro tổng hợp từ toàn bộ bằng chứng của lượt quét này."],
	};
}
