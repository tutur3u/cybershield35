import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createD1Client } from "./d1-client";
import { createD1Sql } from "./d1-sql";
import { maintenanceDatabase } from "./context";

function binding() {
 return maintenanceDatabase.getStore() ?? getCloudflareContext().env.CS35_DB;
}

function database() {
 return createD1Client(binding());
}

/** Resolve each operation from the current request, never a global I/O client. */
export const adminDb = new Proxy({} as ReturnType<typeof createD1Client>, {
 get(_target, key) {
  const db = database();
  const value = Reflect.get(db, key);
  return typeof value === "function" ? value.bind(db) : value;
 },
});
export const adminSqlClient = createD1Sql(binding);
export async function checkDatabase() {
 const started = Date.now();
 await adminSqlClient`select 1 as ok`;
 return { ok: true, latencyMs: Date.now() - started };
}
