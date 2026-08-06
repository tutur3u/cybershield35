import { describe, expect, test } from "bun:test";

import {
	classifyTrackedSourceAutomation,
	startOfVietnamDay,
} from "@/lib/domain/tracked-source-automation";

/**
 * The daily run is scheduled for midnight, so under the old rule a source
 * scanned successfully at 00:05 read "Đến hạn" for the next twenty-three hours.
 * The badge described the schedule rather than the source, which made a
 * genuinely missed run impossible to pick out.
 */
describe("a tracked source is only due when it really is", () => {
	const at = (iso: string) => new Date(iso);
	const classify = (nowIso: string, lastIso: string | null) =>
		classifyTrackedSourceAutomation({
			isActive: true,
			lastScannedAt: lastIso ? at(lastIso) : null,
			lastScanStatus: "completed",
			now: at(nowIso),
		});

	test("scanned earlier today reads as done", () => {
		// 09:00 Vietnam, scanned 00:05 Vietnam the same day.
		expect(classify("2026-08-06T02:00:00Z", "2026-08-05T17:05:00Z").kind).toBe(
			"scanned_today",
		);
	});

	test("inside the tolerance it is waiting its turn, not overdue", () => {
		// 00:20 Vietnam, yesterday's scan is the newest.
		expect(classify("2026-08-05T17:20:00Z", "2026-08-04T17:05:00Z").kind).toBe(
			"scheduled",
		);
	});

	test("past the tolerance without today's scan it is overdue", () => {
		// 02:00 Vietnam, still only yesterday's scan.
		expect(classify("2026-08-05T19:00:00Z", "2026-08-04T17:05:00Z").kind).toBe(
			"due",
		);
	});

	test("never scanned is overdue once the window has passed", () => {
		expect(classify("2026-08-05T19:00:00Z", null).kind).toBe("due");
	});

	test("a scan within the hour still holds the duplicate guard", () => {
		// Unchanged: the guard is what stops a second scan of the same source.
		const decision = classify("2026-08-06T02:00:00Z", "2026-08-06T01:30:00Z");
		expect(decision.kind).toBe("recent");
		expect(decision.blocksEnqueue).toBe(true);
	});

	test("the day boundary is Vietnam's, not UTC's", () => {
		// 17:30Z is 00:30 the next day in Vietnam; a UTC "today" would roll over
		// seven hours early and call a scanned source overdue.
		expect(startOfVietnamDay(at("2026-08-05T17:30:00Z")).toISOString()).toBe(
			"2026-08-05T17:00:00.000Z",
		);
	});
});
