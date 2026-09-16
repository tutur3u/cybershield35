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
    const writes = [];
    for (const [day, amount] of days) {
        const id = `browser-${accountId}-${day}`;
        writes.push(sql`insert into provider_account_costs(id,provider,account_id,day,amount_usd,observed_at)
          values(${id},'browser_use',${accountId},${day},${amount.toFixed(12)},strftime('%Y-%m-%dT%H:%M:%fZ','now'))
          on conflict(id) do update set amount_usd=excluded.amount_usd,observed_at=excluded.observed_at,synced_at=null,synced_workspace_id=null
          where cast(excluded.amount_usd as real) > cast(provider_account_costs.amount_usd as real)`);
    }
    if (writes.length) await sql.batch(writes);
    // Read after the guarded writes so concurrent reconciliation cannot erase costs.
    const recorded = await sql<{day:string;amount_usd:string}[]>`select day,amount_usd from provider_account_costs where provider='browser_use' and account_id=${accountId}`;
    reviewRequired = recorded.some(row => days.has(row.day) && Number(row.amount_usd) > days.get(row.day)! + 1e-9);
	return {
		status: reviewRequired ? "review_required" : "ready",
		days: days.size,
	};
}
