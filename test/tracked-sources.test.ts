import { readFileSync } from "node:fs";

import { describe, expect, test } from "bun:test";

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
});
