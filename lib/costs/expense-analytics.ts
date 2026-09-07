import { summarizeUsage } from "./usage";
export type ExpenseLine = {
	day: string;
	provider: string;
	service: string;
	mode: string;
	amountUsd: number;
	requests: number;
	inputTokens: number;
	outputTokens: number;
	source: string;
};
export function expenseAnalytics(lines: ExpenseLine[], now = new Date()) {
	const dayMap = new Map<string, number>();
	for (const row of lines)
		dayMap.set(row.day, (dayMap.get(row.day) ?? 0) + row.amountUsd);
	const summary = summarizeUsage(
		[...dayMap]
			.map(([day, amountUsd]) => ({ day, amountUsd, records: 0, synced: 0 }))
			.sort((a, b) => b.day.localeCompare(a.day)),
		now,
	);
	const breakdown = (
		selected: ExpenseLine[],
		key: "provider" | "service" | "mode",
	) => {
		const groups = new Map<
			string,
			{ name: string; amountUsd: number; requests: number; tokens: number }
		>();
		for (const row of selected) {
			const group = groups.get(row[key]) ?? {
				name: row[key],
				amountUsd: 0,
				requests: 0,
				tokens: 0,
			};
			group.amountUsd += row.amountUsd;
			group.requests += row.requests;
			group.tokens += row.inputTokens + row.outputTokens;
			groups.set(row[key], group);
		}
		return [...groups.values()].sort((a, b) => b.amountUsd - a.amountUsd);
	};
	const valid = lines.filter((row) => row.day <= summary.today);
	const recent = valid.filter((row) => row.day >= summary.from);
	return {
		...summary,
		providers: breakdown(valid, "provider"),
		providers30: breakdown(recent, "provider"),
		services: breakdown(valid, "service"),
		services30: breakdown(recent, "service"),
		modes: breakdown(valid, "mode"),
		modes30: breakdown(recent, "mode"),
		lines: valid,
	};
}
export type ExpenseAnalytics = ReturnType<typeof expenseAnalytics>;

/** Retain saved expenses when sessions disappear; never add a fresh snapshot twice. */
export function mergeBrowserExpenses(
	saved: ExpenseLine[],
	live: ExpenseLine[],
) {
	const liveByDay = new Map<string, ExpenseLine[]>();
	for (const row of live)
		liveByDay.set(row.day, [...(liveByDay.get(row.day) ?? []), row]);
	const result = saved.filter((row) => row.provider !== "Browser Use");
	const days = new Set([
		...saved
			.filter((row) => row.provider === "Browser Use")
			.map((row) => row.day),
		...liveByDay.keys(),
	]);
	for (const day of days) {
		const stored = saved.filter(
			(row) => row.provider === "Browser Use" && row.day === day,
		);
		const fresh = liveByDay.get(day) ?? [];
		const sum = (rows: ExpenseLine[]) =>
			rows.reduce((n, row) => n + row.amountUsd, 0);
		result.push(...(sum(stored) > sum(fresh) ? stored : fresh));
	}
	return result;
}
