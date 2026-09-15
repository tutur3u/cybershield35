import { mkdir, writeFile } from "node:fs/promises";
import { createD1StagingSchema, migrationTables } from "../lib/db/d1-migration";

await mkdir("drizzle-d1", { recursive: true });
await writeFile("drizzle-d1/0000_staging.sql", createD1StagingSchema());
console.log(
	`Generated ${migrationTables.length} staging tables. Native query and transaction migration remains required.`,
);
