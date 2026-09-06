import { loadLocalEnvFile } from "@/lib/env/load-local-env";
loadLocalEnvFile();
const { reconcileApifyCosts, syncProviderCosts, getProviderCostOverview } = await import("@/lib/costs/server");
const { adminSqlClient } = await import("@/lib/db/client");
const apply = process.argv.includes("--apply");
try {
  let accountHistory = null;
  if (process.argv.includes("--account-history")) {
    const { reconcileApifyAccountHistory } = await import("@/lib/costs/account-history");
    const dates = process.argv.find(arg => arg.startsWith("--dates="))?.slice(8).split(",") ?? [new Date().toISOString().slice(0,10)];
    accountHistory = await reconcileApifyAccountHistory(dates, apply);
  }
  const reconciliation = process.argv.includes("--account-only") ? null : await reconcileApifyCosts(500, apply);
  const sync = apply && process.argv.includes("--sync") ? await syncProviderCosts() : null;
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", reconciliation, accountHistory, sync, overview: await getProviderCostOverview() }, null, 2));
} finally {
  await adminSqlClient.end();
}
