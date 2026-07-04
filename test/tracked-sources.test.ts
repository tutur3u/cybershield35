import { readFileSync } from "node:fs";

import { describe, expect, test } from "bun:test";

import {
	classifyTrackedSourceAutomation,
	TRACKED_SOURCE_DUPLICATE_GUARD_MS,
	TRACKED_SOURCE_STALE_ACTIVE_SCAN_MS,
} from "@/lib/domain/tracked-source-automation";
import {
	defaultTrackedSourceSeeds,
	toTrackedSourceSeed,
} from "@/lib/domain/tracked-sources";

describe("tracked sources", () => {
	test("ships the two configured Facebook pages as active default seeds", () => {
		expect(defaultTrackedSourceSeeds).toHaveLength(2);
		expect(defaultTrackedSourceSeeds).toEqual([
			expect.objectContaining({
				displayName: "example-page",
				normalizedUrl: "https://www.facebook.com/example-page",
				provider: "apify_facebook_posts",
				type: "facebook_page",
				isActive: true,
			}),
			expect.objectContaining({
				displayName: "example-fanpage",
				normalizedUrl: "https://www.facebook.com/example-fanpage",
				provider: "apify_facebook_posts",
				type: "facebook_page",
				isActive: true,
			}),
		]);
	});

	test("normalizes tracked source input without persisting credentials", () => {
		expect(
			toTrackedSourceSeed("facebook.com/example-fanpage", "Fanpage ví dụ"),
		).toEqual({
			displayName: "Fanpage ví dụ",
			normalizedUrl: "https://facebook.com/example-fanpage",
			provider: "apify_facebook_posts",
			type: "facebook_page",
			isActive: true,
			metadata: { label: "example-fanpage" },
		});
	});

	test("keeps built-in tracked sources active for daily automation", () => {
		const worker = readFileSync("lib/workers/tracked-sources.ts", "utf8");

		expect(worker).toContain("function insertDefaultTrackedSource");
		expect(worker).toContain(".onConflictDoUpdate({");
		expect(worker).toContain("isActive: seed.isActive");
		expect(worker).not.toContain(
			".onConflictDoNothing({ target: trackedSources.normalizedUrl })",
		);
	});

	test("classifies active tracked source automation states deterministically", () => {
		const now = new Date("2026-07-04T00:00:00.000Z");

		expect(
			classifyTrackedSourceAutomation({
				isActive: true,
				lastScannedAt: null,
				lastScanStatus: null,
				now,
			}),
		).toMatchObject({ blocksEnqueue: false, kind: "due", reason: "due" });
		expect(
			classifyTrackedSourceAutomation({
				isActive: true,
				lastScannedAt: new Date(now.getTime() - TRACKED_SOURCE_DUPLICATE_GUARD_MS + 1),
				lastScanStatus: "completed",
				now,
			}),
		).toMatchObject({
			blocksEnqueue: true,
			kind: "recent",
			reason: "recently_scanned",
		});
		expect(
			classifyTrackedSourceAutomation({
				isActive: true,
				lastScannedAt: new Date(now.getTime() - 30 * 60 * 1000),
				lastScanStatus: "running",
				now,
			}),
		).toMatchObject({
			blocksEnqueue: true,
			kind: "in_progress",
			reason: "scan_in_progress",
		});
		expect(
			classifyTrackedSourceAutomation({
				isActive: true,
				lastScannedAt: new Date(now.getTime() - TRACKED_SOURCE_STALE_ACTIVE_SCAN_MS),
				lastScanStatus: "queued",
				now,
			}),
		).toMatchObject({
			blocksEnqueue: false,
			kind: "stale_active",
			reason: "stale_active_scan",
		});
	});
});
