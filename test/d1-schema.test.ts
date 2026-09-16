import { readFileSync } from "node:fs";
import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { eq, is } from "drizzle-orm";
import { getTableConfig, SQLiteTable } from "drizzle-orm/sqlite-core";
import { createD1StagingSchema, migrationTables } from "../lib/db/d1-migration";
import * as schema from "../lib/db/schema.d1";

test("native SQLite mappings cover every source table and column", () => {
	const tables = Object.values(schema).filter((value) => is(value, SQLiteTable)).map(getTableConfig);
	expect(tables).toHaveLength(migrationTables.length);
	for (const source of migrationTables) {
		const target = tables.find((table) => table.name === source.name);
		expect(target?.columns.filter((column) => column.name !== "_revision").map((column) => column.name).sort()).toEqual(source.columns.map((column) => column.name).sort());
	}
});

test("native ORM round trips UUID defaults, UTC dates, JSON and booleans", () => {
	const sqlite = new Database(":memory:");
	try {
		sqlite.exec("PRAGMA foreign_keys=ON");
		sqlite.exec(createD1StagingSchema());
		sqlite.exec(readFileSync("drizzle-d1/0001_revisions.sql", "utf8"));
		const db = drizzle(sqlite, { schema });
		const [source] = db.insert(schema.sources).values({
			type: "text", originalInput: "Nội dung kiểm tra", metadata: { nested: ["Tiếng Việt", null, 3] },
		}).returning().all();
		expect(source!.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(source!.createdAt).toBeInstanceOf(Date);
		expect(source!.metadata).toEqual({ nested: ["Tiếng Việt", null, 3] });
		const [account] = db.insert(schema.localAccounts).values({username: "migration-test", passwordHash: "non-credential", disabled: true, mustChangePassword: true}).returning().all();
		expect(account!.disabled).toBe(true);
		expect(account!.mustChangePassword).toBe(true);
		db.update(schema.localAccounts).set({disabled: false}).where(eq(schema.localAccounts.id, account!.id)).run();
		expect(db.select().from(schema.localAccounts).get()!.disabled).toBe(false);
	} finally { sqlite.close(); }
});
