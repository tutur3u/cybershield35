import { expect, test } from "bun:test";
import {
	parseVercelCharges,
	selectVercelCostsForImport,
} from "../lib/costs/vercel-billing";
const charge = {
	Tags: { ProjectId: "prj_cs35" },
	ChargePeriodStart: "2026-09-07T00:00:00Z",
	ServiceName: "CPU",
	BilledCost: 0.2,
	EffectiveCost: 5,
	PricingUnit: "USD",
};
test("omits empty charges but retains zero-dollar corrections for existing ledger entries", () => {
	const rows = [
		{ accountId: "cpu", day: "2026-09-07", amountUsd: 0 },
		{ accountId: "memory", day: "2026-09-07", amountUsd: 0 },
		{ accountId: "network", day: "2026-09-07", amountUsd: 0.1 },
	];
	expect(selectVercelCostsForImport(rows, new Set(["cpu:2026-09-07"]))).toEqual(
		[rows[0], rows[2]],
	);
});
test("attributes only matching project, sums billed cost once and keeps service dimensions", () => {
	const rows = parseVercelCharges(
		[
			charge,
			{ ...charge, BilledCost: 0.3 },
			{ ...charge, ServiceName: "Memory", BilledCost: 0.1 },
			{ ...charge, Tags: { ProjectId: "other" }, BilledCost: 100 },
			{ ...charge, Tags: {}, BilledCost: 20 },
		]
			.map((row) => JSON.stringify(row))
			.join("\n"),
		"prj_cs35",
	);
	expect(rows).toHaveLength(2);
	expect(rows.reduce((n, row) => n + row.amountUsd, 0)).toBe(0.6);
});
test("rejects malformed matched billing records and unsupported currency", () => {
	expect(() =>
		parseVercelCharges(
			JSON.stringify({ ...charge, BillingCurrency: "EUR" }),
			"prj_cs35",
		),
	).toThrow();
	expect(() =>
		parseVercelCharges(
			JSON.stringify({ ...charge, BilledCost: null }),
			"prj_cs35",
		),
	).toThrow();
	expect(() =>
		parseVercelCharges(
			JSON.stringify({ ...charge, PricingUnit: "EUR" }),
			"prj_cs35",
		),
	).toThrow();
	expect(() =>
		parseVercelCharges(
			JSON.stringify({ ...charge, BilledCost: -1 }),
			"prj_cs35",
		),
	).toThrow();
});

import { accountCostPayload } from "../lib/costs/account-cost";
test("daily sync preserves Vercel identity and never relabels hosting as Apify", () => {
	const payload = accountCostPayload({
		id: "vercel-a",
		provider: "vercel",
		account_id: "prj_cs35",
		day: "2026-09-07",
		amount_usd: "0.123456789",
		observed_at: "2026-09-07T12:00:00Z",
	});
	expect(payload).toMatchObject({
		provider: "vercel",
		amountUsd: 0.123456789,
		granularity: "account_day",
		occurredAt: "2026-09-07T00:00:00.000Z",
	});
});
