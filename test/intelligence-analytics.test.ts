import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const analytics = readFileSync("lib/dashboard/intelligence-analytics.ts", "utf8");
const summary = readFileSync("lib/llm/intelligence-summary.ts", "utf8");
const cached = readFileSync("lib/dashboard/intelligence-summary.ts", "utf8");

/**
 * The growth rule, lifted verbatim from the module.
 *
 * It cannot be imported — the file is `server-only` and pulls in the database
 * client — so the ordering it produces is asserted here against the same
 * constant the module uses, and the test fails if that constant moves.
 */
const NEW_TOPIC_RANK_BASE = 1_000_000;
function growth(current: number, previous: number) {
	if (previous === 0) return current > 0 ? NEW_TOPIC_RANK_BASE + current : 0;
	return (current - previous) / previous;
}

describe("ranking topics by how much they moved", () => {
	test("the module still uses the constant this test pins", () => {
		expect(analytics).toContain("const NEW_TOPIC_RANK_BASE = 1_000_000");
		expect(analytics).toContain(
			"return current > 0 ? NEW_TOPIC_RANK_BASE + current : 0",
		);
	});

	test("a topic with no prior window outranks any percentage gain", () => {
		// No previous period is not a 0% change; it is the strongest signal there
		// is, and a ratio cannot express it.
		expect(growth(3, 0)).toBeGreaterThan(growth(500, 5));
	});

	test("among brand-new topics the larger one comes first", () => {
		// The first version subtracted the count from MAX_SAFE_INTEGER, which
		// ranked new topics smallest-first — invisible in a dataset younger than
		// two windows, because every row took that branch.
		expect(growth(40, 0)).toBeGreaterThan(growth(3, 0));
	});

	test("an established topic is ranked by proportional change", () => {
		expect(growth(20, 10)).toBeGreaterThan(growth(110, 100));
		expect(growth(5, 10)).toBeLessThan(0);
	});

	test("a topic that appears in neither window ranks last", () => {
		expect(growth(0, 0)).toBe(0);
	});
});

describe("what the trend summary is allowed to do", () => {
	test("a provider outage costs a paragraph, not the page", () => {
		// Every chart beside it renders from Postgres; only this needs a model.
		expect(summary).toContain("return null");
		expect(summary).toContain("} catch {");
	});

	test("an empty window is never summarised", () => {
		// A model asked to find trends in nothing will find some.
		expect(summary).toContain("if (analytics.total === 0) return null");
	});

	test("the prompt forbids inventing content, identity or intent", () => {
		expect(summary).toContain("Không trích nguyên văn bài viết");
		expect(summary).toContain("Không quy kết ý định, danh tính hay động cơ");
		expect(summary).toContain("Không đề xuất đăng bài tự động");
	});

	test("every trend has to name the figure it rests on", () => {
		expect(summary).toContain("evidence: z.string()");
		expect(summary).toContain('ghi rõ ở trường "evidence"');
	});

	test("the model runs once per window, not once per reader", () => {
		// It is the only part of this page that costs money to produce and the
		// answer is identical for everyone looking at the same window.
		expect(cached).toContain('"use cache"');
		expect(cached).toContain("cacheLife(");
		expect(cached).toContain("dashboardIntelligenceTag(\"summary\")");
	});
});

describe("analytics read from real rows", () => {
	test("reach is engagement, guarded against non-numeric json", () => {
		// The engagement column is free-form JSON; a stray "1,2k" would abort the
		// whole aggregate without the regex guard.
		expect(analytics).toContain("~ '^\\\\d+$'");
		expect(analytics).toContain("as engagement");
	});

	test("sources are named from the tracked source, not the scraped handle", () => {
		expect(analytics).toContain("from tracked_sources ts");
		expect(analytics).toContain("pageIdentity({");
	});

	test("the comparison window is the same length as the one it follows", () => {
		expect(analytics).toContain("${days * 2}");
	});
});
