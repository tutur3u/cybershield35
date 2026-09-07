import type { ExpenseAnalytics } from "./expense-analytics";
export type UsageDay = {
	day: string;
	amountUsd: number;
	records: number;
	synced: number;
};

/** Thirty UTC calendar days including today; account totals already include runs. */
export function summarizeUsage(days: UsageDay[], now = new Date()) {
	const today = now.toISOString().slice(0, 10);
	const start = new Date(`${today}T00:00:00Z`);
	start.setUTCDate(start.getUTCDate() - 29);
	const from = start.toISOString().slice(0, 10);
	const valid = days.filter((day) => day.day <= today);
	const recent = valid.filter((day) => day.day >= from);
	const sum = (rows: UsageDay[]) =>
		Math.round(rows.reduce((total, row) => total + row.amountUsd, 0) * 1e9) /
		1e9;
	return {
		today,
		from,
		allTime: sum(valid),
		last30Days: sum(recent),
		thisMonth: sum(
			valid.filter((row) => row.day.startsWith(today.slice(0, 7))),
		),
		todayCost: sum(valid.filter((row) => row.day === today)),
		firstDay: valid.map((row) => row.day).sort()[0] ?? null,
		records: valid.reduce((n, row) => n + row.records, 0),
		synced: valid.reduce((n, row) => n + row.synced, 0),
		days: valid,
		recentDays: recent,
	};
}
export type UsageOverview = ReturnType<typeof summarizeUsage> & {
	invoices?: import("./invoices").BillingInvoice[];
	bill: ExpenseAnalytics;
	providerSync: { provider: string; records: number; synced: number }[];
	browserStatus: string;
	firecrawl: { status: string; remaining: number | null; plan: number | null };
	aiStatus: "ready" | "unavailable" | "unconfigured";
	aiThrough: string | null;
	storageReady: boolean;
	observedAt: string | null;
	studioUrl: string | null;
	chat: {
		requests: number;
		tokens: number;
		requests30: number;
		tokens30: number;
	};
};
