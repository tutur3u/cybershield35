import "server-only";
import { adminSqlClient as sql } from "@/lib/db/client";

import { parseApifyBillingCycle, accountCostPayload } from "./account-cost";

/** Account totals can replace run totals only for an explicitly dedicated account. */
export async function reconcileApifyAccountHistory(
	dates: string[],
	apply = false,
) {
	if (process.env.APIFY_ACCOUNT_DEDICATED_TO_CS35 !== "true")
		throw new Error(
			"Dedicated Apify account attribution must be configured first",
		);
	const token = process.env.APIFY_TOKEN?.trim();
	if (!token) throw new Error("APIFY_TOKEN is required");
	const get = async (path: string) => {
		const response = await fetch(`https://api.apify.com/v2/${path}`, {
			headers: { Authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(20_000),
		});
		if (!response.ok)
			throw new Error(`Apify billing request failed (${response.status})`);
		return (await response.json()).data;
	};
	const account = await get("users/me");
	if (typeof account?.id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(account.id))
		throw new Error("Apify account identity unavailable");
	const daily = new Map<string, number>();
	for (const date of dates) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
			throw new Error("Invalid billing date");
		const data = await get(`users/me/usage/monthly?date=${date}`);
		for (const [day, amount] of parseApifyBillingCycle(data))
			daily.set(day, amount);
	}
	const observedAt = new Date();
	if (apply) {
		await sql.begin(async (tx) => {
			for (const [day, amount] of daily) {
				const id = `account-${account.id}-${day}`;
				await tx`insert into provider_account_costs (id, provider, account_id, day, amount_usd, observed_at)
          values (${id}, 'apify', ${account.id}, ${day}, ${amount.toFixed(12)}, ${observedAt.toISOString()}::timestamptz)
          on conflict (id) do update set amount_usd=excluded.amount_usd, observed_at=excluded.observed_at,
            synced_at=null, synced_workspace_id=null
          where provider_account_costs.amount_usd is distinct from excluded.amount_usd`;
			}
		});
	}
	const months = new Map<string, number>();
	for (const [day, amount] of daily)
		months.set(day.slice(0, 7), (months.get(day.slice(0, 7)) ?? 0) + amount);
	return {
		days: daily.size,
		totalUsd: [...daily.values()].reduce((s, n) => s + n, 0),
		months: [...months].map(([month, amountUsd]) => ({ month, amountUsd })),
	};
}

export async function syncAccountCosts(
	token: string,
	workspace: string,
	baseUrl: string,
) {
	const rows = await sql<
		Array<{
			id: string;
			provider: string;
			account_id: string;
			day: string;
			amount_usd: string;
			observed_at: string;
		}>
	>`
    select id, provider, account_id, day::text, amount_usd::text, observed_at::text from provider_account_costs
    where synced_at is null or synced_workspace_id is distinct from ${workspace}
    order by day limit 100
  `;
	let synced = 0;
	for (const row of rows) {
		const response = await fetch(
			`${baseUrl.replace(/\/+$/, "")}/provider-costs`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
					"X-Tuturuuu-Workspace-Id": workspace,
				},
				body: JSON.stringify(accountCostPayload(row)),
				signal: AbortSignal.timeout(15_000),
			},
		);
		if (!response.ok) return { synced, status: `upstream_${response.status}` };
		const receipt = await response.json().catch(() => null);
		if (receipt?.accepted !== true || receipt.externalRunId !== row.id)
			return { synced, status: "invalid_receipt" };
		await sql`update provider_account_costs set synced_at=now(), synced_workspace_id=${workspace}
      where id=${row.id} and observed_at=${row.observed_at}::timestamptz`;
		synced++;
	}
	return { synced, status: "ready" };
}
