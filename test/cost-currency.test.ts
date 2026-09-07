import { expect, test } from "bun:test";
import { formatCost, parseCostExchangeRate } from "../lib/costs/currency";
import { parseBillingInvoices } from "../lib/costs/invoices";

test("converts VND display without changing USD and preserves tiny nonzero costs", () => {
	expect(formatCost(2, "VND", 26000)).toContain("52.000");
	expect(formatCost(2, "USD", 26000)).toContain("2,00");
	expect(formatCost(0.000001, "VND", 26000)).toBe("<1 ₫");
	expect(formatCost(0, "VND", 26000)).toContain("0");
});
test("rejects stale, invalid and non-USD exchange rate responses", () => {
	const now = Date.parse("2026-09-07T00:00:00Z");
	const data = {
		result: "success",
		base_code: "USD",
		time_last_update_unix: now / 1000,
		rates: { VND: 26000 },
	};
	expect(parseCostExchangeRate(data, now).rate).toBe(26000);
	for (const invalid of [
		{ ...data, base_code: "EUR" },
		{ ...data, rates: { VND: 0 } },
		{ ...data, time_last_update_unix: now / 1000 - 8 * 86400 },
	])
		expect(() => parseCostExchangeRate(invalid, now)).toThrow();
});
test("deduplicates reviewed invoices and rejects conflicting or unpaid records", () => {
	const invoice = {
		provider: "neon",
		reference: "test-1",
		issuedOn: "2026-09-02",
		reviewedOn: "2026-09-07",
		amountUsd: 2,
		currency: "USD",
		status: "paid",
	};
	expect(parseBillingInvoices(JSON.stringify([invoice, invoice]))).toHaveLength(
		1,
	);
	expect(() =>
		parseBillingInvoices(
			JSON.stringify([invoice, { ...invoice, amountUsd: 3 }]),
		),
	).toThrow();
	expect(() =>
		parseBillingInvoices(JSON.stringify([{ ...invoice, status: "unpaid" }])),
	).toThrow();
});
