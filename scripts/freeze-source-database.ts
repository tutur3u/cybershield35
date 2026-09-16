import {createHash} from "node:crypto";
import {readFile,writeFile} from "node:fs/promises";
import postgres from "postgres";
import {loadLocalEnvFile} from "../lib/env/load-local-env";

// Run only during the cutover window, after candidate verification.
const freeze = process.argv.includes("--freeze");
const restore = process.argv.includes("--restore");
if (freeze === restore) throw new Error("Choose --freeze or --restore");
loadLocalEnvFile(process.env.CS35_SOURCE_ENV_FILE ?? ".env.local");
const url = process.env.CS35_DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!url) throw new Error("Source database configuration required");
const sourceHash = createHash("sha256").update(new URL(url).hostname).digest("hex");
const sql = postgres(url,{max:1,prepare:false});
const markerPath = "migration-private/source-freeze.json";
try {
 const [identity] = await sql`select current_database() as name, current_user as role`;
 if (!identity) throw new Error("Missing database identity");
 const identifier = '"'+String(identity.name).replaceAll('"','""')+'"';
 if (restore) {
  const marker = JSON.parse(await readFile(markerPath,"utf8"));
  if (marker.sourceHash !== sourceHash || marker.database !== identity.name) throw new Error("Source freeze identity mismatch");
  await sql.unsafe("SET default_transaction_read_only = off");
  await sql.unsafe(`ALTER DATABASE ${identifier} ${marker.previousSetting === null ? "RESET default_transaction_read_only" : "SET default_transaction_read_only = " + (marker.previousSetting === "on" ? "on" : "off")}`);
  await writeFile(markerPath,JSON.stringify({...marker,restoredAt:new Date().toISOString()}),{mode:0o600});
  console.log("Source write setting restored. Reconcile D1 writes before directing traffic back.");
 } else {
  const [active] = await sql`select (select count(*) from scan_jobs where status = 'running') + (select count(*) from article_publication_jobs where status = 'running') as count`;
  if (Number(active?.count)) throw new Error("Wait for active source jobs to finish");
  const previous = await sql`select unnest(setconfig) as setting from pg_db_role_setting where setdatabase = (select oid from pg_database where datname = current_database()) and setrole=0`;
  const setting = previous.map(row=>String(row.setting)).find(value=>value.startsWith("default_transaction_read_only="));
  if (setting?.endsWith("=on")) throw new Error("Source already read-only; preserve the existing freeze audit");
  const marker = {database:identity.name,sourceHash,previousSetting:setting?.split("=")[1] ?? null,frozenAt:new Date().toISOString()};
  // Persist the recovery information before changing source settings.
  await writeFile(markerPath,JSON.stringify(marker),{mode:0o600,flag:"wx"});
  await sql.unsafe(`ALTER DATABASE ${identifier} SET default_transaction_read_only = on`);
  await sql`select pg_terminate_backend(pid) from pg_stat_activity where datname=current_database() and usename=current_user and pid<>pg_backend_pid() and backend_type='client backend'`;
  const probe=postgres(url,{max:1,prepare:false});
  try {const rows=await probe.unsafe("SHOW transaction_read_only");if(rows[0]?.transaction_read_only!=="on")throw new Error("Fresh source connection is not read-only");}finally{await probe.end();}
  await writeFile(markerPath,JSON.stringify({...marker,verifiedAt:new Date().toISOString()}),{mode:0o600});
  console.log("Source write freeze verified on a fresh connection. Capture the final snapshot now.");
 }
} catch (error) {
 console.error("Source freeze operation failed:",error instanceof Error ? error.name : "UnknownError");
 process.exitCode=1;
} finally {await sql.end();}
