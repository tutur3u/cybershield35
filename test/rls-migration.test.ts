import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const appTables = [
	"sources",
	"scan_jobs",
	"tracked_sources",
	"provider_runs",
	"evidence_items",
	"analyses",
	"counter_argument_drafts",
	"audit_events",
	"cron_heartbeats",
] as const;

describe("RLS migration", () => {
	const migrationSql = readdirSync("drizzle")
		.filter((file) => file.endsWith(".sql"))
		.map((file) => readFileSync(join("drizzle", file), "utf8"))
		.join("\n");

	test("enables row level security for every application table", () => {
		for (const table of appTables) {
			expect(migrationSql).toContain(
				`ALTER TABLE "public"."${table}" ENABLE ROW LEVEL SECURITY`,
			);
		}
	});

	test("revokes direct public table access for every application table", () => {
		for (const table of appTables) {
			expect(migrationSql).toContain(
				`REVOKE ALL ON TABLE "public"."${table}" FROM PUBLIC`,
			);
		}
	});

	test("does not force RLS for the backend owner/admin connection", () => {
		expect(migrationSql).not.toContain("FORCE ROW LEVEL SECURITY");
	});
});
