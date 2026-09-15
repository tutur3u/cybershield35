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

if (!process.argv.includes("--apply-staging"))
	throw new Error(
		"Pass --apply-staging to populate and verify the isolated D1 copy",
	);
const config = JSON.parse(await readFile("wrangler.migration.jsonc", "utf8"));
if (
	config.d1_databases?.[0]?.database_id !==
	"5ecf345c-e585-480a-a746-71a1a3624d06"
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
	configPath: "wrangler.migration.jsonc",
	remoteBindings: true,
});
const db = proxy.env.CS35_DB;
const identifier = (name: string) => `"${name.replaceAll('"', '""')}"`;
const verified: string[] = [];
try {
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
		"migration-private/d1-verification.json",
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
	console.log(
		`Verified ${verified.length} D1 tables against the captured snapshot. This does not establish live replication or application compatibility.`,
	);
} catch (error) {
	console.error(
		"Staging transfer stopped. No production changes were made.",
		error instanceof Error && error.message.startsWith("D1 parity mismatch:")
			? error.message
			: "Inspect the failed table before retrying.",
	);
	process.exitCode = 1;
} finally {
	local.close();
	await proxy.dispose();
}
