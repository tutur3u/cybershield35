import { getPlatformProxy } from "wrangler";
import type { D1Database } from "@cloudflare/workers-types";
import { maintenanceDatabase } from "../lib/db/context";

const allowed = new Set([
 "analyze-intelligence-db", "backfill-intelligence", "backfill-topics",
 "reclassify-evidence-risk", "regenerate-article-headlines", "cleanup-hidden-zalo-drafts",
]);
const task = process.argv[2];
if (!task || !allowed.has(task)) throw new Error("Choose a supported D1 maintenance task");
const production = process.argv.includes("--production");
const remote = production || process.argv.includes("--remote");
const proxy = await getPlatformProxy<{ CS35_DB: D1Database }>({
 configPath: production ? "wrangler.production-db.jsonc" : remote ? "wrangler.migration.jsonc" : "wrangler.jsonc",
 remoteBindings: remote,
});
try {
 console.log(`Running ${task} against ${production ? "production" : remote ? "staging" : "local"} D1`);
 const taskModule = await import(`./${task}.ts`);
 process.argv = [process.argv[0]!, process.argv[1]!, ...process.argv.slice(3).filter(arg => arg !== "--remote" && arg !== "--production")];
 await maintenanceDatabase.run(proxy.env.CS35_DB, () => taskModule.run());
} finally {
 await proxy.dispose();
}
