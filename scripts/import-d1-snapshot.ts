import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { getPlatformProxy } from "wrangler";
import type { D1Database } from "@cloudflare/workers-types";
import {
	createD1StagingSchema,
	d1SnapshotOrderBy,
	orderedMigrationTables,
} from "../lib/db/d1-migration.ts";

const localOnly = process.argv.includes("--local");
const production = process.argv.includes("--apply-production");
const configPath = production ? "wrangler.production-db.jsonc" : "wrangler.migration.jsonc";
if (production) {
 const freeze = JSON.parse(await readFile("migration-private/source-freeze.json", "utf8"));
 const snapshot = JSON.parse(await readFile("migration-private/manifest.json", "utf8"));
 if (!freeze.verifiedAt || freeze.restoredAt || !freeze.frozenAt || Date.parse(snapshot.capturedAt) < Date.parse(freeze.frozenAt)) throw new Error("Production requires a snapshot captured after the source write freeze");
}
if (!localOnly && !production && !process.argv.includes("--apply-staging"))
	throw new Error(
		"Pass --apply-staging to populate and verify the isolated D1 copy",
	);
const config = JSON.parse(await readFile(configPath, "utf8"));
if (
	config.d1_databases?.[0]?.database_id !==
	(production ? "991e3c70-d792-4597-b40a-b9c7a677f17b" : "5ecf345c-e585-480a-a746-71a1a3624d06")
)
	throw new Error("Refusing an unrecognized migration target");
const manifest = JSON.parse(
	await readFile("migration-private/manifest.json", "utf8"),
) as { tables: { table: string; rows: number; sha256: string }[] };
const local = new DatabaseSync(":memory:");
local.exec(createD1StagingSchema());
local.exec("BEGIN; PRAGMA defer_foreign_keys=ON");
local.exec(await readFile("migration-private/snapshot.sql", "utf8"));
local.exec("COMMIT");
const proxy = await getPlatformProxy<{ CS35_DB: D1Database }>({
	configPath: localOnly ? "wrangler.jsonc" : configPath,
	remoteBindings: !localOnly,
});
const db = proxy.env.CS35_DB;
const identifier = (name: string) => `"${name.replaceAll('"', '""')}"`;
const verified: string[] = [];
try {
    if(localOnly) {
        const exists=await db.prepare("SELECT name FROM sqlite_schema WHERE name='sources'").first();
        if(!exists) for(const statement of createD1StagingSchema().split(";").filter(part=>part.trim())) await db.prepare(statement).run();
    }
	for (const table of orderedMigrationTables()) {
		const expected = manifest.tables.find((row) => row.table === table.name);
		if (!expected)
			throw new Error(`Missing snapshot manifest for ${table.name}`);
		const columns = table.columns.map((c) => identifier(c.name)).join(", ");
		const primary = d1SnapshotOrderBy(table);
		const select = `SELECT ${columns} FROM ${identifier(table.name)} ORDER BY ${primary}`;
		const count = await db
			.prepare(`SELECT count(*) AS count FROM ${identifier(table.name)}`)
			.first<number>("count");
		if (count === 0 && expected.rows > 0) {
			const insert = `INSERT INTO ${identifier(table.name)} (${columns}) VALUES (${table.columns.map(() => "?").join(", ")})`;
			for (let offset = 0; offset < expected.rows; offset += 50) {
				const rows = local.prepare(`${select} LIMIT 50 OFFSET ?`).all(offset);
				await db.batch(
					rows.map((row) =>
						db.prepare(insert).bind(...table.columns.map((c) => row[c.name])),
					),
				);
			}
		}
		// Always re-read D1. Successful insertion alone is not proof of data parity.
		const digest = createHash("sha256");
		let rowsRead = 0;
		for (let offset = 0; ; offset += 100) {
			const { results } = await db
				.prepare(`${select} LIMIT 100 OFFSET ?`)
				.bind(offset)
				.all<Record<string, unknown>>();
			for (const row of results)
				digest.update(
					JSON.stringify(table.columns.map((c) => row[c.name])) + "\n",
				);
			rowsRead += results.length;
			if (results.length < 100) break;
		}
		if (rowsRead !== expected.rows || digest.digest("hex") !== expected.sha256)
			throw new Error(`D1 parity mismatch: ${table.name}; refusing overwrite`);
		verified.push(table.name);
		console.log(`${table.name}: ${rowsRead} rows, SHA-256 matches`);
	}
	const foreignKeys = await db.prepare("PRAGMA foreign_key_check").all();
	if (foreignKeys.results.length)
		throw new Error("D1 foreign key verification failed");
	await writeFile(
		localOnly ? "migration-private/local-d1-verification.json" : production ? "migration-private/production-d1-verification.json" : "migration-private/d1-verification.json",
		JSON.stringify(
			{
				verifiedAt: new Date().toISOString(),
				databaseId: config.d1_databases[0].database_id,
				tables: verified,
				source: manifest,
			},
			null,
			2,
		),
		{ mode: 0o600 },
	);
    if(localOnly) for(const file of ["0001_revisions.sql","0002_attachment_search.sql","0003_timestamp_precision.sql"]) {
        const sql=(await readFile(`drizzle-d1/${file}`,"utf8")).replace(/^--.*$/gm,"").replaceAll("\n"," ");
        await db.exec(sql);
    }
	console.log(
		`Verified ${verified.length} D1 tables against the captured snapshot. This does not establish live replication or application compatibility.`,
	);
} catch (error) {
	console.error(
		"Transfer stopped. The target must not receive production traffic until verification passes.",
		error instanceof Error && error.message.startsWith("D1 parity mismatch:")
			? error.message
			: "Inspect the failed table before retrying.",
	);
	process.exitCode = 1;
} finally {
	local.close();
	await proxy.dispose();
}
