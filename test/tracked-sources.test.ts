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
	test("ships no seed sources unless the environment names them", () => {
		// Which pages a unit follows is operational information about an
		// investigation, not a property of the software, and this repository may
		// be published.
		delete process.env.CYBERSHIELD35_SEED_SOURCE_URLS;
		expect(defaultTrackedSourceSeeds()).toEqual([]);

		process.env.CYBERSHIELD35_SEED_SOURCE_URLS =
			"https://www.facebook.com/example-page";
		expect(defaultTrackedSourceSeeds()).toEqual([
			expect.objectContaining({
				isActive: true,
				normalizedUrl: "https://www.facebook.com/example-page",
				provider: "apify_facebook_posts",
				type: "facebook_page",
			}),
		]);
		delete process.env.CYBERSHIELD35_SEED_SOURCE_URLS;
	});

	test("normalizes tracked source input without persisting credentials", () => {
		expect(
			toTrackedSourceSeed("facebook.com/example-page", "Trang ví dụ"),
		).toEqual({
			displayName: "Trang ví dụ",
			normalizedUrl: "https://facebook.com/example-page",
			provider: "apify_facebook_posts",
			type: "facebook_page",
			isActive: true,
			metadata: { label: "example-page" },
		});
	});

	test("seeds built-in tracked sources in migration while keeping reads pure", () => {
		const worker = readFileSync("lib/workers/tracked-sources.ts", "utf8");
		const migration = readFileSync("drizzle/0008_blue_zemo.sql", "utf8");

		expect(worker).not.toContain("ensureDefaultTrackedSources");
		// The seed INSERT named two real pages; it is gone, and the migration says
		// where the seeds live now.
		expect(migration).not.toContain('INSERT INTO "tracked_sources"');
		expect(migration).not.toContain("facebook.com/");
		expect(migration).toContain("CYBERSHIELD35_SEED_SOURCE_URLS");
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
