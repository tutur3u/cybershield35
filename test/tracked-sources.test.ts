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
				displayName: "taynguyennanggiodaingan",
				normalizedUrl: "https://www.facebook.com/taynguyennanggiodaingan",
				provider: "apify_facebook_posts",
				type: "facebook_page",
				isActive: true,
			}),
			expect.objectContaining({
				displayName: "hongbien47fanpage",
				normalizedUrl: "https://www.facebook.com/hongbien47fanpage",
				provider: "apify_facebook_posts",
				type: "facebook_page",
				isActive: true,
			}),
		]);
	});

	test("normalizes tracked source input without persisting credentials", () => {
		expect(
			toTrackedSourceSeed("facebook.com/hongbien47fanpage", "Hồng Biển 47"),
		).toEqual({
			displayName: "Hồng Biển 47",
			normalizedUrl: "https://facebook.com/hongbien47fanpage",
			provider: "apify_facebook_posts",
			type: "facebook_page",
			isActive: true,
			metadata: { label: "hongbien47fanpage" },
		});
	});
});
