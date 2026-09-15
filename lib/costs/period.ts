import type { ExpenseLine } from "./expense-analytics";

export type CostPeriod = "30" | "month" | "all";

/** One date boundary shared by the ledger, breakdowns and exported rows. */
export function selectCostPeriod<T extends { day: string }>(
	rows: T[],
	period: CostPeriod,
	today: string,
): T[] {
	const start = new Date(`${today}T00:00:00Z`);
	start.setUTCDate(start.getUTCDate() - 29);
	const from =
		period === "month"
			? `${today.slice(0, 7)}-01`
			: period === "30"
				? start.toISOString().slice(0, 10)
				: "0000-01-01";
	return rows.filter((row) => row.day >= from && row.day <= today);
}

export function summarizeCostPeriod(
	lines: ExpenseLine[],
	period: CostPeriod,
	today: string,
) {
	const selected = selectCostPeriod(lines, period, today);
	const total =
		selected.reduce((sum, row) => sum + Math.round(row.amountUsd * 1e9), 0) /
		1e9;
	const invoiceTotal =
		selected
			.filter((row) => row.source === "reviewed_provider_invoice")
			.reduce((sum, row) => sum + Math.round(row.amountUsd * 1e9), 0) / 1e9;
	return {
		lines: selected,
		total,
		invoiceTotal,
		meteredTotal: Math.round((total - invoiceTotal) * 1e9) / 1e9,
		recordedDays: new Set(selected.map((row) => row.day)).size,
		providers: new Set(selected.map((row) => row.provider)).size,
	};
}
