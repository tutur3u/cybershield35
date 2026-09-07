import { describe, expect, test } from "bun:test";
import { summarizeUsage, type UsageDay } from "../lib/costs/usage";
const day = (day: string, amountUsd: number): UsageDay => ({
	day,
	amountUsd,
	records: 1,
	synced: 1,
});
describe("UTC account cost summaries", () => {
	test("includes exactly thirty calendar days and excludes future charges", () => {
		const result = summarizeUsage(
			[
				day("2026-08-08", 4),
				day("2026-08-09", 2),
				day("2026-09-07", 3),
				day("2026-09-08", 99),
			],
			new Date("2026-09-07T23:59:59Z"),
		);
		expect(result.from).toBe("2026-08-09");
		expect(result.allTime).toBe(9);
		expect(result.last30Days).toBe(5);
		expect(result.thisMonth).toBe(3);
		expect(result.todayCost).toBe(3);
		expect(result.records).toBe(3);
	});
	test("uses UTC across a local timezone month boundary", () => {
		const result = summarizeUsage(
			[day("2026-08-31", 0.1), day("2026-08-30", 0.2)],
			new Date("2026-09-01T01:00:00+07:00"),
		);
		expect(result.today).toBe("2026-08-31");
		expect(result.thisMonth).toBe(0.3);
	});
	test("preserves missing coverage and unsynced records instead of inventing days", () => {
		const result = summarizeUsage(
			[{ ...day("2026-09-01", 0), synced: 0 }],
			new Date("2026-09-07T00:00:00Z"),
		);
		expect(result.days).toHaveLength(1);
		expect(result.synced).toBe(0);
		expect(result.firstDay).toBe("2026-09-01");
		expect(summarizeUsage([]).firstDay).toBeNull();
	});
});

import {
	expenseAnalytics,
	type ExpenseLine,
} from "../lib/costs/expense-analytics";
test("combines account costs and AI once, preserving provider and execution breakdowns", () => {
	const base = {
		day: "2026-09-07",
		service: "account",
		mode: "Nhà cung cấp",
		requests: 0,
		inputTokens: 0,
		outputTokens: 0,
		source: "api",
	};
	const lines: ExpenseLine[] = [
		{ ...base, provider: "Apify", amountUsd: 2 },
		{
			...base,
			provider: "AI",
			service: "google/gemini",
			mode: "AI nền",
			amountUsd: 0.2,
			requests: 2,
			inputTokens: 100,
			outputTokens: 20,
		},
		{
			...base,
			provider: "AI",
			service: "google/gemini",
			mode: "AI tương tác",
			amountUsd: 0.3,
			requests: 1,
		},
	];
	const result = expenseAnalytics(lines, new Date("2026-09-07T12:00:00Z"));
	expect(result.allTime).toBe(2.5);
	expect(result.days).toHaveLength(1);
	expect(result.providers.find((row) => row.name === "AI")).toMatchObject({
		amountUsd: 0.5,
		requests: 3,
		tokens: 120,
	});
	expect(result.modes).toHaveLength(3);
});

import { mergeBrowserExpenses } from "../lib/costs/expense-analytics";
test("saved Browser Use costs survive deleted sessions and never double count fresh totals", () => {
	const base: ExpenseLine = {
		day: "2026-09-01",
		provider: "Browser Use",
		service: "session",
		mode: "provider",
		amountUsd: 0.5,
		requests: 1,
		inputTokens: 0,
		outputTokens: 0,
		source: "api",
	};
	expect(mergeBrowserExpenses([base], [{ ...base, amountUsd: 0.2 }])).toEqual([
		base,
	]);
	expect(
		mergeBrowserExpenses(
			[base],
			[
				{ ...base, amountUsd: 0.3 },
				{ ...base, amountUsd: 0.4 },
			],
		).reduce((n, row) => n + row.amountUsd, 0),
	).toBe(0.7);
	expect(mergeBrowserExpenses([base], [])).toEqual([base]);
});
