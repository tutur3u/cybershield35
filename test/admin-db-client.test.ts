import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("admin database client boundary", () => {
	const dbClientSource = readFileSync("lib/db/client.ts", "utf8");

	test("marks the database client module as server-only", () => {
		expect(dbClientSource).toContain('import "server-only";');
	});

	test("uses explicit admin client names for privileged backend queries", () => {
		expect(dbClientSource).toContain("export const adminSqlClient");
		expect(dbClientSource).toContain("export const adminDb");
	});
});
