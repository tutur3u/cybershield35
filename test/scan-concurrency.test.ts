import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const scans = readFileSync("lib/workers/scans.ts", "utf8");
const errors = readFileSync("lib/providers/errors.ts", "utf8");
const runRoute = readFileSync("app/api/scans/[id]/run/route.ts", "utf8");

describe("not overwhelming the crawler", () => {
	test("at most three scans run at once", () => {
		// Apify bills memory across every concurrent run against one account-wide
		// ceiling; five in flight reached it and the next was refused outright.
		expect(scans).toContain("export const MAX_CONCURRENT_SCAN_RUNS = 3");
	});

	test("a manual run respects the cap the scheduler respects", () => {
		// The cap used to be consulted only by the drain loop, so every "Quét
		// ngay" walked straight past it — which is exactly what a person does on
		// five sources in a row when they want today's data.
		const manual = scans.slice(scans.indexOf("export async function processScanJobNow"));
		expect(manual).toContain("await scanCapacityRemaining()) <= 0");
		expect(manual).toContain("deferred: true");
	});

	test("a deferred scan is reported as queued, not as a failure", () => {
		// It is the one outcome the cap exists to produce; answering 409 made the
		// button claim an error for normal operation.
		expect(runRoute).toContain("status: deferred ? 202 : 409");
	});
});

describe("retrying what is worth retrying", () => {
	test("a memory-limit refusal is transient, not terminal", () => {
		// It clears the moment another run finishes. Read as fatal it would park a
		// recoverable scan forever.
		expect(errors).toContain("provider_capacity_exhausted");
		const memory = errors.slice(errors.indexOf("const memoryExhausted"));
		expect(memory.slice(0, memory.indexOf("}"))).toContain("memory limit");
		const branch = errors.slice(
			errors.indexOf("if (memoryExhausted)"),
			errors.indexOf("const quotaExhausted"),
		);
		expect(branch).toContain("retryable: true");
	});

	test("memory is classified before quota", () => {
		// Both messages talk about limits and only one means the account is out of
		// money; matching quota first would make a passing failure permanent.
		expect(errors.indexOf("const memoryExhausted")).toBeLessThan(
			errors.indexOf("const quotaExhausted"),
		);
	});

	test("an exhausted quota is still terminal", () => {
		const branch = errors.slice(
			errors.indexOf("if (quotaExhausted)"),
			errors.indexOf("if (status === 401"),
		);
		expect(branch).toContain("retryable: false");
	});

	test("a forced retry re-queues rather than launching past the cap", () => {
		// Forcing a run past a capacity limit would recreate the fault it exists
		// to recover from.
		const force = scans.slice(scans.indexOf("export async function forceRetryScan"));
		expect(force).toContain("attempts: 0");
		expect(force).toContain('status: "queued"');
		expect(force).toContain("processScanJobNow(scanId)");
	});

	test("only a stopped scan can be forced", () => {
		// Resetting a running job would collect the same source twice.
		const force = scans.slice(scans.indexOf("export async function forceRetryScan"));
		expect(force).toContain('inArray(scanJobs.status, ["failed", "retrying"])');
	});
});
