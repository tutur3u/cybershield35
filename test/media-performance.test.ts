import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("article images load at the size they are shown", () => {
	const image = read("components/dashboard/safe-image.tsx");
	const config = read("next.config.ts");

	test("our own media goes through the optimiser", () => {
		// Every cover used to download at full upload size with no re-encoding,
		// for a slot a few hundred pixels wide.
		expect(image).toContain("unoptimized={!optimisable}");
		expect(config).toContain('formats: ["image/avif", "image/webp"]');
	});

	test("our own host is allow-listed, narrowly", () => {
		// Covers are stored as absolute URLs, which the optimiser classifies as
		// remote even though they point back here — so allow-listing the local
		// path alone matched nothing and every article image failed to load.
		expect(config).toContain('localPatterns: [{ pathname: "/api/articles/**" }]');
		expect(config).toContain("remotePatterns:");
		expect(config).toContain("hostname: publicAppHostname");
		// Narrow: the media route only, never an arbitrary path.
		expect(config).not.toContain('pathname: "/**"');
	});

	test("optimisability does not depend on the browser", () => {
		// The server and the browser must agree on the rendered attributes; a
		// window-only check would render one src during SSR and another after.
		expect(image).toContain("function isOptimisableMedia");
		expect(image).not.toContain("window.location.origin");
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

describe("an uploaded cover is actually viewable", () => {
	const media = read("lib/articles/cms-media.ts");
	const route = read("app/api/articles/rehost-covers/route.ts");

	test("uploading publishes the entry", () => {
		// A draft asset refuses anonymous resolution, and the request that renders
		// it — from the image optimiser, or from Zalo's fetcher — carries no
		// session. Unpublished covers answered 401, so every thumbnail rendered as
		// a placeholder even for a signed-in operator.
		expect(media).toContain("await publishArticleCmsMedia(article.id, input.session)");
		const uploadAt = media.indexOf("await publishArticleCmsMedia(article.id, input.session)");
		const urlAt = media.indexOf("const previewUrl =");
		expect(uploadAt).toBeLessThan(urlAt);
	});

	test("covers copied before that can be repaired", () => {
		expect(route).toContain("publishExisting: z.boolean().default(false)");
		expect(route).toContain("if (publishExisting) {");
		expect(route).toContain("published,");
	});
});
