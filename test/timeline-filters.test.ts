import { describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";

mock.module("server-only", () => ({}));

const { atOrAfter, before, effectivePublishedAt } = await import(
	"@/lib/dashboard/timeline-shared"
);

/**
 * Every time-range filter on the timeline answered 503. The operand is a
 * `coalesce(...)` expression rather than a column, so Drizzle had no column type
 * to encode the parameter with and sent the Date through JavaScript's own
 * `toString` — a format Postgres rejects outright.
 */
describe("timestamp comparisons on computed expressions", () => {
	const moment = new Date("2026-07-07T10:56:58.000Z");
	// Flattened by hand: the chunk tree contains cycles, so it cannot be
	// stringified wholesale.
	const chunks = (value: { queryChunks: unknown[] }) => {
		const parts: string[] = [];
		const walk = (node: unknown, depth: number) => {
			if (depth > 6 || node == null) return;
			if (typeof node === "string") return void parts.push(node);
			if (Array.isArray(node)) return void node.forEach((n) => walk(n, depth + 1));
			if (typeof node === "object") {
				const record = node as Record<string, unknown>;
				if (typeof record.value === "string") parts.push(record.value);
				// Static SQL text arrives as a StringChunk holding an array.
				else if (Array.isArray(record.value)) walk(record.value, depth + 1);
				else if (record.value instanceof Date) parts.push(String(record.value));
				walk(record.queryChunks, depth + 1);
			}
		};
		walk(value.queryChunks, 0);
		return parts.join(" | ");
	};

	test("the moment is sent as an ISO string, never a Date", () => {
		const rendered = chunks(atOrAfter(effectivePublishedAt, moment));
		expect(rendered).toContain("2026-07-07T10:56:58.000Z");
		// The shape Postgres rejected, and the reason the filter 503'd.
		expect(rendered).not.toContain("GMT+0000");
	});

	test("the comparison casts explicitly, leaving nothing to infer", () => {
		expect(chunks(atOrAfter(effectivePublishedAt, moment))).toContain(
			"::timestamptz",
		);
		expect(chunks(before(effectivePublishedAt, moment))).toContain(
			"::timestamptz",
		);
	});

	test("the timeline uses them instead of raw column comparisons", () => {
		const server = readFileSync("lib/dashboard/timeline-server.ts", "utf8");
		expect(server).toContain("atOrAfter(effectivePublishedAt, range.from)");
		expect(server).toContain("before(effectivePublishedAt, range.to)");
		expect(server).not.toContain("gte(effectivePublishedAt");
		expect(server).not.toContain("lt(effectivePublishedAt");
	});
});
