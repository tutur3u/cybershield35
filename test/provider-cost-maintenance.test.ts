import { expect, test } from "bun:test";
import { runCostMaintenance } from "../lib/costs/maintenance";

test("billing failures preserve delivery and report only sanitized diagnostics", async () => {
  const reports: unknown[] = [];
  let delivered = false;
  await runCostMaintenance([
    { stage: "account_history", run: async () => { throw Object.assign(new Error("secret billing payload"), {code: "22007"}); } },
    { stage: "delivery", run: async () => { delivered = true; return { status: "ready", synced: 12 }; } },
  ], result => reports.push(result));
  expect(delivered).toBe(true);
  expect(reports).toEqual([
    {stage: "account_history", status: "pending", errorType: "Error", errorCode: "22007"},
    {stage: "delivery", status: "ready", synced: 12},
  ]);
  expect(JSON.stringify(reports)).not.toContain("secret");
});

test("unsuccessful receipts remain visible and unsafe error codes are omitted", async () => {
  const reports: unknown[] = [];
  await runCostMaintenance([
    {stage: "run_reconciliation", run: async () => { throw {code: "https://secret"}; }},
    {stage: "delivery", run: async () => ({status: "upstream_403", synced: 0})},
  ], result => reports.push(result));
  expect(JSON.stringify(reports)).not.toContain("https");
  expect(reports[1]).toEqual({stage: "delivery", status: "upstream_403", synced: 0});
});
