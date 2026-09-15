import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import {
	createD1StagingSchema,
	d1SnapshotOrderBy,
	encodeD1Value,
	migrationTables,
	orderedMigrationTables,
} from "../lib/db/d1-migration";
import { getTableConfig } from "drizzle-orm/pg-core";

test("D1 chunked imports always insert parent tables before child tables", () => {
	const seen = new Set<string>();
	for (const table of orderedMigrationTables()) {
		for (const key of table.foreignKeys) {
			const parent = getTableConfig(key.reference().foreignTable).name;
			expect(parent === table.name || seen.has(parent)).toBe(true);
		}
		seen.add(table.name);
	}
	expect(seen.size).toBe(42);
});

test("all application tables and constraints build in SQLite", () => {
	const db = new Database(":memory:");
	try {
		db.exec("PRAGMA foreign_keys = ON");
		db.exec(createD1StagingSchema());
		expect(
			db.query("select name from sqlite_schema where type='table'").all(),
		).toHaveLength(migrationTables.length);
		expect(db.query("PRAGMA foreign_key_check").all()).toEqual([]);
		expect(() =>
			db.exec(
				"INSERT INTO sources (id, type, original_input) VALUES ('test', 'invalid', 'test')",
			),
		).toThrow();
		db.exec(
			"INSERT INTO sources (id, type, original_input) VALUES ('test', 'text', 'test')",
		);
		expect(
			db.query("SELECT metadata FROM sources WHERE id='test'").get(),
		).toEqual({ metadata: "{}" });
	} finally {
		db.close();
	}
});

test("migration preserves decimal amounts, Unicode, JSON and UTC timestamps", () => {
	expect(encodeD1Value("numeric(24, 12)", "123456789012.123456789012")).toBe(
		"123456789012.123456789012",
	);
	expect(
		encodeD1Value("jsonb", { text: "Tiếng Việt", nested: [1, null] }),
	).toBe('{"text":"Tiếng Việt","nested":[1,null]}');
	expect(
		encodeD1Value("timestamp with time zone", "2026-09-15T07:00:00+07:00"),
	).toBe("2026-09-15T00:00:00.000Z");
	expect(
		encodeD1Value("timestamp with time zone", "2026-09-15 07:00:00.123456+07"),
	).toBe("2026-09-15T00:00:00.123456Z");
	expect(encodeD1Value("boolean", false)).toBe(0);
	expect(encodeD1Value("text", null)).toBeNull();
	expect(() => encodeD1Value("halfvec(768)", "[1,2]")).toThrow();
});

test("enum primary keys retain PostgreSQL ordering for snapshot checksums", () => {
	const db = new Database(":memory:");
	try {
		db.exec(createD1StagingSchema());
		db.exec(
			"INSERT INTO intelligence_provider_rollups (provider) VALUES ('apify_facebook_comments'), ('apify_facebook_posts')",
		);
		const table = migrationTables.find(
			(table) => table.name === "intelligence_provider_rollups",
		)!;
		expect(
			db
				.query(
					`SELECT provider FROM intelligence_provider_rollups ORDER BY ${d1SnapshotOrderBy(table)}`,
				)
				.all(),
		).toEqual([
			{ provider: "apify_facebook_posts" },
			{ provider: "apify_facebook_comments" },
		]);
	} finally {
		db.close();
	}
});
