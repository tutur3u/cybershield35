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
		// The instruction was rewritten to forbid field names outright after the
		// model started citing the JSON path instead of the number.
		expect(summary).toContain('Trường "evidence" phải là con số viết ra cho người đọc');
	});

	test("the model runs when the data moves, not when a reader arrives", () => {
		// It is the only part of this page that costs money to produce, and the
		// answer is identical for everyone looking at the same window. It used to
		// lean on `"use cache"`, which a dynamic route holds per serverless
		// instance — see the stored-checkpoint suite below for why that failed.
		expect(cached).toContain("intelligenceSummaryIsStale");
		expect(cached).toContain("export async function regenerateIntelligenceSummary");
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

describe("the summary is a stored checkpoint, not a cache", () => {
	const stored = readFileSync("lib/dashboard/intelligence-summary.ts", "utf8");
	const scheduler = readFileSync("lib/managed-scheduler/server.ts", "utf8");
	const schema = readFileSync("lib/db/schema.ts", "utf8");

	test("it survives in Postgres rather than in an instance", () => {
		// `"use cache"` in a dynamic route handler is held per serverless
		// instance; instances are short-lived, so nearly every reader landed on a
		// cold one and paid the full generation on every refresh.
		expect(schema).toContain("export const intelligenceSummaries = pgTable(");
		expect(schema).toContain('"intelligence_summaries"');
		expect(stored).toContain("intelligenceSummaries");
		// Asserted on the API rather than the directive string, which appears in
		// the file's own explanation of why it no longer uses it.
		expect(stored).not.toContain("cacheLife(");
		expect(stored).not.toContain("cacheTag(");
	});

	test("regeneration is keyed to the data having actually changed", () => {
		// The count and newest timestamp in the window: a completed scan moves
		// both, and nothing else does.
		expect(stored).toContain("async function fingerprintFor");
		expect(stored).toContain("coalesce(max(created_at)::text, 'none') as newest");
	});

	test("a stale summary is served rather than withheld", () => {
		// Last hour's read beats a spinner for somebody opening the page; the
		// refresh belongs to the scheduled run that should be paying for it.
		const read = stored.slice(
			stored.indexOf("export async function readIntelligenceSummary"),
		);
		expect(read).toContain('status: stored.fingerprint === fingerprint ? "ready" : "stale"');
	});

	test("a read never generates inside the request", () => {
		// The first reader used to wait forty seconds for generation and the
		// request often died first, which the panel rendered as a skeleton that
		// then disappeared.
		const read = stored.slice(
			stored.indexOf("export async function readIntelligenceSummary"),
			stored.indexOf("/** Back-compat"),
		);
		expect(read).not.toContain("regenerateIntelligenceSummary");
		expect(read).toContain('return { status: "generating", summary: null }');
	});

	test("only one reader generates, however many are looking", () => {
		expect(stored).toContain("onConflictDoNothing");
		expect(stored).toContain("export async function claimSummaryGeneration");
	});

	test("the claim placeholder is never served as an answer", () => {
		expect(stored).toContain("if (row.fingerprint === GENERATING) return null;");
	});

	test("a run that collected nothing new never calls the model", () => {
		expect(scheduler).toContain("intelligenceSummaryIsStale");
		expect(scheduler).toContain("unchanged: true");
	});

	test("an empty result is not stored as though it were an answer", () => {
		// Otherwise a missing row stops meaning "not yet generated".
		const regen = stored.slice(stored.indexOf("export async function regenerateIntelligenceSummary"));
		expect(regen).toContain("if (!summary) return null;");
	});
});

describe("a citation is a figure, not a field name", () => {
	const summary = readFileSync("lib/llm/intelligence-summary.ts", "utf8");
	// Copied verbatim from the module, which cannot be imported here: it is
	// `server-only` and pulls in the database client.
	const KEY_PATH = /(^|\s)[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)+(\s|$)/u;
	const usable = (value: string) => !KEY_PATH.test(value) && /\d/u.test(value);

	test("the module still uses the pattern this test copies", () => {
		expect(summary).toContain("const KEY_PATH =");
		expect(summary).toContain("function usableEvidence");
	});

	test("the numbers are handed over already written out", () => {
		// A nested object gives the model a path to quote when asked to cite its
		// figure, and it took it: "soLieu.soSanhKyTruoc.tongKyTruoc" reached the
		// page. A flat list of formatted pairs has no path in it.
		expect(summary).toContain("chiSo: string; giaTri: string");
		expect(summary).not.toContain("tongSoBai:");
		expect(summary).not.toContain("soSanhKyTruoc:");
	});

	test("a leaked key path is rejected", () => {
		for (const leaked of [
			"soLieu.tongSoBai",
			"soLieu.soSanhKyTruoc.tongKyTruoc",
			"soLieu.mucRuiRo.high",
		]) {
			expect(usable(leaked)).toBe(false);
		}
	});

	test("a real figure is kept", () => {
		expect(usable("Tổng số bài: 1.626 (kỳ trước 150)")).toBe(true);
		expect(usable("Chủ đề · Kinh tế & Tài chính: 872 bài")).toBe(true);
	});

	test("a citation with no number in it is not a citation", () => {
		expect(usable("theo dữ liệu thu thập được")).toBe(false);
	});

	test("a rejected citation loses the chip rather than showing empty", () => {
		const panel = readFileSync(
			"components/dashboard/intelligence/analytics-summary.tsx",
			"utf8",
		);
		expect(panel).toContain("{trend.evidence ? (");
	});
});
