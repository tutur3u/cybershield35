/** Read-only by default. Source: vercel api /v1/billing/charges --raw. */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseVercelCharges } from "../lib/costs/vercel-billing";
const file = process.argv.find((arg) => arg.startsWith("--file="))?.slice(7);
const project = process.argv
	.find((arg) => arg.startsWith("--project="))
	?.slice(10);
if (!file || !project)
	throw new Error("Use --file=/path/charges.ndjson --project=prj_id [--apply]");
const rows = parseVercelCharges(await readFile(file, "utf8"), project);
if (!rows.length)
	throw new Error("No project-attributed charges found; nothing imported");
if (process.argv.includes("--apply")) {
	const { adminSqlClient: sql } = await import("../lib/db/client");
	const observed = new Date().toISOString();
	await sql.begin(async (tx) => {
		for (const row of rows) {
			const id = `vercel-${createHash("sha256").update(`${row.accountId}:${row.day}`).digest("hex")}`;
			await tx`insert into provider_account_costs(id,provider,account_id,day,amount_usd,observed_at)
    values(${id},'vercel',${row.accountId},${row.day},${row.amountUsd.toFixed(12)},${observed}::timestamptz)
    on conflict(id) do update set amount_usd=excluded.amount_usd,observed_at=excluded.observed_at,synced_at=null,synced_workspace_id=null
    where provider_account_costs.amount_usd is distinct from excluded.amount_usd`;
		}
	});
	await sql.end();
}
console.log(
	JSON.stringify({
		provider: "vercel",
		applied: process.argv.includes("--apply"),
		records: rows.length,
		days: new Set(rows.map((row) => row.day)).size,
		totalUsd: rows.reduce((n, row) => n + row.amountUsd, 0),
	}),
);
