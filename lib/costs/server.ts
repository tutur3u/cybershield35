import "server-only";
import { getTuturuuuMachineToken } from "@/lib/tuturuuu/machine-credential";

import { ApifyClient } from "apify-client";
import { adminSqlClient as sql } from "@/lib/db/client";
import { isConfirmedApifyCost, readApifyCost } from "./apify-cost";

import { syncAccountCosts } from "./account-history";
import { deliverProviderCost } from "./delivery";

type CostRow = { id: string; provider: string; output: Record<string, unknown> };

/** Only reconcile run IDs already attributed to CS35; an Apify account may be shared. */
export async function reconcileApifyCosts(limit = 25, apply = true) {
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) throw new Error("APIFY_TOKEN is required for cost reconciliation");
  const client = new ApifyClient({ token, maxRetries: 1, timeoutSecs: 15 });
  const rows = await sql<CostRow[]>`
    select id, provider, output from provider_runs
    where provider::text like 'apify_%' and output->>'runId' is not null
      and (output->'cost'->>'status' is distinct from 'confirmed')
    order by coalesce(output->>'costCheckedAt', '') asc, started_at asc
    limit ${Math.max(1, Math.min(limit, 500))}
  `;
  const result = { attempted: 0, confirmed: 0, pending: 0, unavailable: 0, amountUsd: 0 };
  for (const row of rows) {
    result.attempted++;
    try {
      const run = await client.run(String(row.output.runId)).get();
      if (!run) throw new Error("Run unavailable");
      const cost = readApifyCost(run);
      if (isConfirmedApifyCost(cost)) {
        result.confirmed++;
        result.amountUsd += cost.amountUsd;
      } else result.pending++;
      if (apply) await sql`
        update provider_runs set output = output || ${JSON.stringify({ cost, costCheckedAt: new Date().toISOString() })}::jsonb
        where id = ${row.id}
      `;
    } catch {
      result.unavailable++;
      if (apply) await sql`
        update provider_runs set output = output || ${JSON.stringify({ costCheckedAt: new Date().toISOString() })}::jsonb
        where id = ${row.id}
      `;
    }
  }
  result.amountUsd = Math.round(result.amountUsd * 1e9) / 1e9;
  return result;
}

export async function syncProviderCosts(accessToken?: string, workspaceId?: string | null) {
  const token = accessToken ?? getTuturuuuMachineToken();
  const workspace = workspaceId ?? process.env.TUTURUUU_AI_WORKSPACE_ID?.trim()
    ?? process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID?.trim();
  if (process.env.TUTURUUU_PROVIDER_COST_SYNC_ENABLED !== "true") return { synced: 0, status: "disabled" };
  if (!token || !workspace) return { synced: 0, status: "credential_missing" };
  const accountSync = await syncAccountCosts(token, workspace,
    process.env.TUTURUUU_AI_MACHINE_BASE_URL?.trim() || "https://ai.tuturuuu.com/v1");
  if (accountSync.status !== "ready") return accountSync;
  const rows = await sql<CostRow[]>`
    select distinct on (output->>'runId') id, provider, output from provider_runs
    where provider::text like 'apify_%' and output->>'runId' is not null
      and output->'cost'->>'status' = 'confirmed'
      and (output->'costSync'->>'observedAt' is distinct from output->'cost'->>'observedAt'
        or output->'costSync'->>'workspaceId' is distinct from ${workspace})
    order by output->>'runId', started_at desc limit 50
  `;
  let synced = accountSync.synced;
  for (const row of rows) {
    const cost = row.output.cost;
    if (!isConfirmedApifyCost(cost)) continue;
    const status = await deliverProviderCost({ cost, runId: String(row.output.runId), service: row.provider,
      token, workspace, baseUrl: process.env.TUTURUUU_AI_MACHINE_BASE_URL?.trim() || "https://ai.tuturuuu.com/v1" });
    if (status !== "accepted") return { synced, status };
    await sql`update provider_runs set output = output || ${JSON.stringify({ costSync: {
      observedAt: cost.observedAt, workspaceId: workspace, syncedAt: new Date().toISOString(),
    } })}::jsonb where id = ${row.id} and output->'cost'->>'observedAt' = ${cost.observedAt}`;
    synced++;
  }
  return { synced, status: "ready" };
}

export async function getProviderCostOverview() {
  const workspace = process.env.TUTURUUU_AI_WORKSPACE_ID?.trim() || process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID?.trim();
  const rows = await sql<Array<{ month: string; runs: number; confirmed: number; amount_usd: string; synced: number }>>`
    with attributed as (
      select distinct on (coalesce(output->>'runId', id::text)) * from provider_runs
      where provider::text like 'apify_%'
      order by coalesce(output->>'runId', id::text), started_at desc
    )
    select to_char(coalesce((output->'cost'->>'occurredAt')::timestamptz, started_at) at time zone 'UTC', 'YYYY-MM') as month,
      count(*)::int as runs,
      count(*) filter (where output->'cost'->>'status' = 'confirmed')::int as confirmed,
      coalesce(sum((output->'cost'->>'amountUsd')::numeric) filter (where output->'cost'->>'status' = 'confirmed'), 0)::text as amount_usd,
      count(*) filter (where output->'costSync'->>'observedAt' = output->'cost'->>'observedAt'
        and output->'costSync'->>'workspaceId' = ${workspace ?? ''})::int as synced
    from attributed group by month order by month desc
  `;
  const [storage] = await sql<Array<{ ready: boolean }>>`select to_regclass('public.provider_account_costs') is not null as ready`;
  const accountMonths = storage?.ready ? await sql<Array<{month: string; days: number; amount_usd: string; synced: number}>>`
    select to_char(day, 'YYYY-MM') as month, count(*)::int as days, sum(amount_usd)::text as amount_usd,
      count(*) filter(where synced_at is not null and synced_workspace_id = ${workspace ?? ''})::int as synced
    from provider_account_costs group by month order by month desc
  ` : [];
  const [coverage] = await sql<Array<{ missing_run_ids: number }>>`
    select count(*)::int as missing_run_ids from provider_runs
    where provider::text like 'apify_%' and output->>'runId' is null
  `;
  return {
    currency: "USD", timezone: "UTC", months: rows.map(row => ({ month: row.month,
      runs: row.runs, confirmed: row.confirmed, amountUsd: Number(row.amount_usd), synced: row.synced })),
    accountStorageReady: Boolean(storage?.ready),
    accountMonths: accountMonths.map(row => ({month:row.month, days:row.days, amountUsd:Number(row.amount_usd), synced:row.synced})),
    missingRunIds: coverage?.missing_run_ids ?? 0,
    machineAiConfigured: Boolean(getTuturuuuMachineToken() && workspace),
    syncEnabled: process.env.TUTURUUU_PROVIDER_COST_SYNC_ENABLED === "true",
    studioUrl: workspace ? `https://ai.tuturuuu.com/${encodeURIComponent(workspace)}/usage#provider-costs` : null,
  };
}
