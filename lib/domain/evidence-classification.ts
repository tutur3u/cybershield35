/**
 * The vocabulary shared by the classifier, the filters and the labels.
 *
 * These started as three separate lists. The model wrote one set of values, the
 * filter offered another ("opposed" against a stored "critical"), and the label
 * map knew a third — so a filter could be picked, look right, and match nothing.
 * One list means a value that cannot be produced also cannot be offered.
 */

export const EVIDENCE_SENTIMENT_LABELS = {
	negative: "Tiêu cực",
	neutral: "Trung tính",
	positive: "Tích cực",
} as const;

export const EVIDENCE_STANCE_LABELS = {
	critical: "Phản đối",
	neutral: "Trung lập",
	supportive: "Ủng hộ",
	/** Not about the state, a policy or an agency at all. */
	unknown: "Không liên quan",
} as const;

export const EVIDENCE_TRIAGE_LABELS = {
	action_required: "Cần hành động",
	dismissed: "Bỏ qua",
	new: "Mới",
	resolved: "Đã giải quyết",
	reviewing: "Đang xem xét",
} as const;

export const EVIDENCE_RISK_LEVEL_LABELS = {
	high: "Cao",
	low: "Thấp",
	medium: "Trung bình",
} as const;

export type EvidenceSentimentValue = keyof typeof EVIDENCE_SENTIMENT_LABELS;
export type EvidenceStanceValue = keyof typeof EVIDENCE_STANCE_LABELS;

export function sentimentLabel(value: string) {
	return (
		EVIDENCE_SENTIMENT_LABELS[value as EvidenceSentimentValue] ?? value
	);
}

export function stanceLabel(value: string) {
	return EVIDENCE_STANCE_LABELS[value as EvidenceStanceValue] ?? value;
}

/** `[value, label]` pairs in the order the filters should offer them. */
export function optionsFrom(labels: Record<string, string>) {
	return Object.entries(labels) as [string, string][];
}
