import { describe, expect, test } from "bun:test";

import { managedSchedulerCallbackFailureBody } from "@/lib/managed-scheduler/callback";

describe("managed scheduler callback errors", () => {
	test("returns sanitized callback diagnostics without raw error details", () => {
		const body = managedSchedulerCallbackFailureBody({
			error: new Error(
				"Failed query: select * from secrets where token='raw-token'",
			),
			operation: "process-queue",
		});

		expect(body).toMatchObject({
			code: "CS35_MANAGED_SCHEDULER_CALLBACK_FAILED",
			developerDebug: {
				operation: "process-queue",
				reason: "internal_error",
			},
			operation: "process-queue",
		});
		expect(body.error).toContain("CS35 could not process the scan queue");
		expect(JSON.stringify(body)).not.toContain("raw-token");
		expect(JSON.stringify(body)).not.toContain("select * from secrets");
	});

	test("classifies dependency failures without exposing the dependency message", () => {
		const body = managedSchedulerCallbackFailureBody({
			error: new Error("fetch failed"),
			operation: "enqueue-tracked-sources",
		});

		expect(body.developerDebug).toMatchObject({
			operation: "enqueue-tracked-sources",
			reason: "dependency_unavailable",
		});
		expect(body.error).toContain("CS35 could not enqueue tracked sources");
		expect(body.error).not.toContain("fetch failed");
	});
});
