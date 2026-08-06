import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
	EVIDENCE_SENTIMENT_LABELS,
	EVIDENCE_STANCE_LABELS,
	sentimentLabel,
	stanceLabel,
} from "@/lib/domain/evidence-classification";
import {
	EVIDENCE_SENTIMENTS,
	EVIDENCE_STANCES,
} from "@/lib/llm/risk-classification";

/**
 * Every stored value was "neutral" and "unknown", so the two filters built on
 * them could not match a single row — and the filter offered "opposed" against
 * a stored "critical", a choice that looked right and matched nothing.
 */
describe("the classification vocabulary is shared", () => {
	test("every value the model can emit has a label", () => {
		for (const value of EVIDENCE_SENTIMENTS) {
			expect(EVIDENCE_SENTIMENT_LABELS[value]).toBeTruthy();
		}
		for (const value of EVIDENCE_STANCES) {
			expect(EVIDENCE_STANCE_LABELS[value]).toBeTruthy();
		}
	});

	test("no label exists for a value the model cannot emit", () => {
		// This is the direction that bit: a filter offering something unreachable.
		expect(Object.keys(EVIDENCE_SENTIMENT_LABELS).sort()).toEqual(
			[...EVIDENCE_SENTIMENTS].sort(),
		);
		expect(Object.keys(EVIDENCE_STANCE_LABELS).sort()).toEqual(
			[...EVIDENCE_STANCES].sort(),
		);
	});

	test("unknown values pass through rather than vanish", () => {
		expect(sentimentLabel("negative")).toBe("Tiêu cực");
		expect(stanceLabel("critical")).toBe("Phản đối");
		expect(stanceLabel("something-new")).toBe("something-new");
	});
});

describe("the classifier judges sentiment and stance", () => {
	const classifier = readFileSync("lib/llm/risk-classification.ts", "utf8");
	const worker = readFileSync("lib/workers/evidence-risk.ts", "utf8");

	test("both fields are required of the model", () => {
		expect(classifier).toContain("sentiment: z.enum(EVIDENCE_SENTIMENTS)");
		expect(classifier).toContain("stance: z.enum(EVIDENCE_STANCES)");
		// Judged independently: a neutral report of an arrest is still high risk.
		expect(classifier).toContain("Đừng suy ra trường này từ trường kia.");
	});

	test("the rule-based fallback declines to guess", () => {
		// It cannot judge either, and overwriting a model verdict with a guess
		// during a brief provider outage would be worse than leaving it.
		expect(worker).toContain("sentiment: null,");
		expect(worker).toContain("stance: null,");
		expect(worker).toContain(
			"...(assessment.sentiment ? { sentiment: assessment.sentiment } : {}),",
		);
	});

	test("a changed sentiment alone still triggers a write", () => {
		expect(worker).toContain("function hasAssessmentChanged");
		expect(worker).toContain(
			"(assessment.sentiment !== null && assessment.sentiment !== row.sentiment)",
		);
	});

	test("a repeated backfill reaches the backlog", () => {
		// Ordering by recency re-read the same newest page forever; ordering by
		// `riskClassifier` was no better, because every row scored before sentiment
		// existed is marked "llm" while the field still holds a provider default.
		expect(worker).toContain("const CLASSIFIER_VERSION = 2;");
		expect(worker).toContain("(metadata->>'classifierVersion')::int");
		expect(worker).toContain(
			'classifierVersion: assessment.source === "llm" ? CLASSIFIER_VERSION : 0,',
		);
	});
});

describe("the request schema accepts what the classifier writes", () => {
	test("every stored value survives a round trip through the query", async () => {
		// `stance=critical` answered 400: the request schema still said "opposed"
		// after the classifier had moved on, so the filter was rejected before it
		// ever reached the database.
		const { parseTimelineSearchParams } = await import(
			"@/lib/dashboard/timeline-query"
		);
		for (const value of EVIDENCE_STANCES) {
			const parsed = parseTimelineSearchParams(
				new URLSearchParams({ stance: value }),
			);
			expect(parsed.filters.stance).toBe(value);
		}
		for (const value of EVIDENCE_SENTIMENTS) {
			const parsed = parseTimelineSearchParams(
				new URLSearchParams({ sentiment: value }),
			);
			expect(parsed.filters.sentiment).toBe(value);
		}
	});
});
