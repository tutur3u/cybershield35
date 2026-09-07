import { describe, expect, test } from "bun:test";
import { operationsHealth } from "../lib/operations/health";

const healthy = {
	services: [{ health: "healthy" as const }, { health: "healthy" as const }],
	throughput24h: { failed: 0 },
	queue: { retrying: 0 },
	oldestQueuedAgeSeconds: null,
};

describe("operations health distinguishes current services from history", () => {
	test("retired worker records do not degrade healthy current services", () => {
		expect(
			operationsHealth({
				...healthy,
				services: [...healthy.services, { health: "inactive" }],
			}).tone,
		).toBe("success");
	});
	test("unknown current service requires attention even when another is healthy", () => {
		expect(
			operationsHealth({
				...healthy,
				services: [...healthy.services, { health: "unknown" }],
			}).tone,
		).toBe("warning");
	});
	test("empty and retired-only inventories cannot claim healthy operation", () => {
		expect(operationsHealth({ ...healthy, services: [] }).tone).toBe("warning");
		expect(
			operationsHealth({ ...healthy, services: [{ health: "inactive" }] }).tone,
		).toBe("warning");
		expect(operationsHealth().tone).toBe("neutral");
	});
	test("failed scans and stale current services remain actionable", () => {
		expect(
			operationsHealth({ ...healthy, throughput24h: { failed: 1 } }).tone,
		).toBe("danger");
		expect(
			operationsHealth({ ...healthy, services: [{ health: "stale" }] }).tone,
		).toBe("danger");
	});
	test("retries and excessive queue age remain warnings", () => {
		expect(operationsHealth({ ...healthy, queue: { retrying: 1 } }).tone).toBe(
			"warning",
		);
		expect(
			operationsHealth({ ...healthy, oldestQueuedAgeSeconds: 3601 }).tone,
		).toBe("warning");
	});
});
