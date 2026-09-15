/// <reference types="bun" />
import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { mkdir, open, writeFile } from "node:fs/promises";
import postgres from "postgres";
import {
	createD1StagingSchema,
	encodeD1Value,
	orderedMigrationTables,
} from "../lib/db/d1-migration";
import { loadLocalEnvFile } from "../lib/env/load-local-env";

// Source is read-only. Output contains private application data and is never logged.
loadLocalEnvFile(process.env.CS35_SOURCE_ENV_FILE ?? ".env.local");
const url =
	process.env.CS35_DATABASE_URL ||
	process.env.POSTGRES_URL ||
	process.env.DATABASE_URL;
if (!url) throw new Error("Source database configuration required");
await mkdir("migration-private", { recursive: true, mode: 0o700 });
const output = await open("migration-private/snapshot.sql", "wx", 0o600);
const source = postgres(url, {
	max: 1,
	prepare: false,
	connect_timeout: 15,
	types: {
		timestamp: {
			to: 1184,
			from: [1184, 1114, 1082],
			serialize: String,
			parse: String,
		},
	},
});
const local = new Database(":memory:");
const identifier = (name: string) => `"${name.replaceAll('"', '""')}"`;
const literal = (value: string | number | null) =>
	value === null
		? "NULL"
		: typeof value === "number"
			? String(value)
			: `'${value.replaceAll("'", "''")}'`;
const manifest: { table: string; rows: number; sha256: string }[] = [];
try {
	local.exec("PRAGMA foreign_keys=ON");
	local.exec(createD1StagingSchema());
	local.exec("BEGIN; PRAGMA defer_foreign_keys=ON");
	await output.write("PRAGMA defer_foreign_keys=ON;\n");
	await source.begin(
		"isolation level repeatable read read only",
		async (tx) => {
			for (const table of orderedMigrationTables()) {
				const columns = table.columns.map((c) => identifier(c.name)).join(", ");
				const primary = table.columns
					.filter((c) => c.primary)
					.map((c) => c.name);
				if (!primary.length)
					throw new Error(`No deterministic snapshot key: ${table.name}`);
				const insert = local.prepare(
					`INSERT INTO ${identifier(table.name)} (${columns}) VALUES (${table.columns.map(() => "?").join(", ")})`,
				);
				const digest = createHash("sha256");
				let count = 0;
				for await (const rows of tx
					.unsafe(
						`SELECT ${columns} FROM ${identifier(table.name)} ORDER BY ${primary.map(identifier).join(", ")}`,
					)
					.cursor(200)) {
					for (const row of rows) {
						const values = table.columns.map((c) =>
							encodeD1Value(c.getSQLType(), row[c.name]),
						);
						insert.run(...values);
						digest.update(JSON.stringify(values) + "\n");
						await output.write(
							`INSERT INTO ${identifier(table.name)} (${columns}) VALUES (${values.map(literal).join(", ")});\n`,
						);
						count++;
					}
				}
				manifest.push({
					table: table.name,
					rows: count,
					sha256: digest.digest("hex"),
				});
				console.log(`${table.name}: ${count} rows validated`);
			}
		},
	);
	const violations = local.query("PRAGMA foreign_key_check").all();
	if (violations.length)
		throw new Error(`Snapshot has ${violations.length} foreign key violations`);
	local.exec("COMMIT");
	await writeFile(
		"migration-private/manifest.json",
		JSON.stringify(
			{ capturedAt: new Date().toISOString(), tables: manifest },
			null,
			2,
		),
		{ mode: 0o600, flag: "wx" },
	);
	console.log(
		`Validated ${manifest.length} tables; private export ready for isolated staging import.`,
	);
} catch (error) {
	// Do not log driver errors: queries may contain private content.
	console.error(
		"Snapshot failed; incomplete output must not be imported.",
		error instanceof Error ? error.name : "UnknownError",
	);
	process.exitCode = 1;
} finally {
	local.close();
	await output.close();
	await source.end();
}
