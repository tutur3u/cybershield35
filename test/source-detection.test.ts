import { describe, expect, test } from "bun:test";

import { detectSource } from "@/lib/domain/source-detection";

describe("detectSource", () => {
	test("routes Facebook groups to the groups actor", () => {
		expect(detectSource("https://www.facebook.com/groups/daklak").provider).toBe(
			"apify_facebook_groups",
		);
	});

	test("routes Facebook posts to the comments actor", () => {
		expect(
			detectSource("https://www.facebook.com/example/posts/pfbid123").provider,
		).toBe("apify_facebook_comments");
	});

	test("routes Facebook pages to the posts actor", () => {
		expect(detectSource("https://www.facebook.com/daklakgov").provider).toBe(
			"apify_facebook_posts",
		);
	});

	test("labels Facebook pages with their public handle", () => {
		expect(
			detectSource("https://www.facebook.com/taynguyennanggiodaingan").label,
		).toBe("taynguyennanggiodaingan");
	});

	test("routes generic URLs to Firecrawl", () => {
		expect(detectSource("https://ai.daklak.gov.vn").provider).toBe("firecrawl");
	});

	test("routes plain text to local text analysis", () => {
		expect(detectSource("nội dung cần phân tích").provider).toBe("local_text");
	});
});
