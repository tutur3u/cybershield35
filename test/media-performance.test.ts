import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("article images load at the size they are shown", () => {
	const image = read("components/dashboard/safe-image.tsx");
	const config = read("next.config.ts");

	test("our own media goes through the optimiser", () => {
		// Every cover used to download at full upload size with no re-encoding,
		// for a slot a few hundred pixels wide.
		expect(image).toContain("unoptimized={!ours}");
		expect(image).toContain("function isSameOriginMedia");
		expect(config).toContain('formats: ["image/avif", "image/webp"]');
	});

	test("foreign hosts are still passed through untouched", () => {
		// Pointing the optimiser at hosts we do not control makes it an open image
		// proxy, and the foreign covers we show are expiring links that would only
		// poison its cache.
		expect(config).toContain('localPatterns: [{ pathname: "/api/articles/**" }]');
		expect(config).not.toContain("remotePatterns");
	});
});

describe("media responses are cached for what they are", () => {
	const route = read("app/api/articles/[id]/media/[mediaId]/route.ts");

	test("the bytes are immutable, because the id addresses one file forever", () => {
		expect(route).toContain("max-age=31536000");
		expect(route).toContain("immutable");
	});

	test("the redirect is not, because its target expires", () => {
		// A permanent redirect to a signed storage URL outlives its own target.
		expect(route).toContain("public, max-age=300, stale-while-revalidate=600");
		expect(route).toContain("status: 307,");
		expect(route).not.toContain("status: 308,");
	});

	test("a failed fetch is never cached", () => {
		expect(route).toContain('"private, no-store"');
	});
});

describe("publishing has one canonical action", () => {
	const rail = read("components/dashboard/article-editor/publish-rail.tsx");
	const hook = read("components/dashboard/article-editor/use-article-editor.ts");

	test("the optional hidden-preview step is gone", () => {
		// It duplicated what the primary button already does end to end, and its
		// explanation had to describe the relationship between the two.
		expect(rail).not.toContain("Tạo bản xem trước ẩn trên Zalo");
		expect(rail).not.toContain("onSyncPreview");
		expect(hook).not.toContain("syncPreview");
	});
});
