import { expect, test } from "bun:test";
import { selectCostPeriod, summarizeCostPeriod } from "../lib/costs/period";
import type { ExpenseLine } from "../lib/costs/expense-analytics";

const base: ExpenseLine = {
	day: "2026-09-15",
	provider: "AI",
	service: "model",
	mode: "background",
	source: "api",
	amountUsd: 0.1,
	requests: 1,
	inputTokens: 2,
	outputTokens: 3,
};

test("period boundaries agree for the CSV, totals and daily ledger", () => {
	const rows = [
		"2026-08-16",
		"2026-08-17",
		"2026-09-01",
		"2026-09-15",
		"2026-09-16",
	].map((day) => ({ ...base, day }));
	expect(selectCostPeriod(rows, "30", base.day).map((row) => row.day)).toEqual([
		"2026-08-17",
		"2026-09-01",
		"2026-09-15",
	]);
	expect(selectCostPeriod(rows, "month", base.day)).toHaveLength(2);
	expect(selectCostPeriod(rows, "all", base.day)).toHaveLength(4);
});

test("keeps invoice payments distinct and sums fractional costs consistently", () => {
	const result = summarizeCostPeriod(
		[
			base,
			{ ...base, amountUsd: 0.2 },
			{
				...base,
				source: "reviewed_provider_invoice",
				amountUsd: 5,
				provider: "Neon",
			},
		],
		"30",
		base.day,
	);
	expect(result.total).toBe(5.3);
	expect(result.meteredTotal).toBe(0.3);
	expect(result.invoiceTotal).toBe(5);
	expect(result.recordedDays).toBe(1);
	expect(result.providers).toBe(2);
});

test("empty periods retain absence rather than creating zero-dollar rows", () => {
	const result = summarizeCostPeriod(
		[{ ...base, day: "2026-08-01" }],
		"month",
		base.day,
	);
	expect(result.lines).toEqual([]);
	expect(result.recordedDays).toBe(0);
});
