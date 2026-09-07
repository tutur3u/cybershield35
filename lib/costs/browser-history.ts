import "server-only";
import { adminSqlClient as sql } from "@/lib/db/client";
import { readBrowserUsage } from "./other-usage-server";

/** Only import account-wide sessions after explicit dedicated-account configuration. */
export async function reconcileBrowserAccountCosts() {
	if (process.env.BROWSER_USE_ACCOUNT_DEDICATED_TO_CS35 !== "true")
		return { status: "disabled", days: 0 };
	const report = await readBrowserUsage();
	if (report.status !== "ready" || !report.accountId)
		return { status: report.status, days: 0 };
	const accountId = report.accountId;
	const days = new Map<string, number>();
	for (const row of report.lines)
		days.set(row.day, (days.get(row.day) ?? 0) + row.amountUsd);
	let reviewRequired = false;
	await sql.begin(async (tx) => {
		for (const [day, amount] of days) {
			const id = `browser-${accountId}-${day}`;
			const [existing] = await tx<
				{ amount_usd: string }[]
			>`select amount_usd::text from provider_account_costs where id=${id}`;
			// Deleted sessions must not silently erase a previously recorded expense.
			if (existing && Number(existing.amount_usd) > amount + 1e-9) {
				reviewRequired = true;
				continue;
			}
			await tx`insert into provider_account_costs(id,provider,account_id,day,amount_usd,observed_at)
    values(${id},'browser_use',${accountId},${day},${amount.toFixed(12)},now())
    on conflict(id) do update set amount_usd=excluded.amount_usd,observed_at=excluded.observed_at,synced_at=null,synced_workspace_id=null
    where excluded.amount_usd > provider_account_costs.amount_usd`;
		}
	});
	return {
		status: reviewRequired ? "review_required" : "ready",
		days: days.size,
	};
}
