import { afterEach, beforeEach, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

const originalFetch = globalThis.fetch;

// A 1x1 PNG, so the test never depends on a network image staying reachable.
const PNG_BYTES = Uint8Array.from(
	atob(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
	),
	(character) => character.charCodeAt(0),
);

beforeEach(() => {
	globalThis.fetch = mock(async (input: string | URL | Request) => {
		const url = String(input instanceof Request ? input.url : input);
		if (url.includes("missing")) return new Response("no", { status: 404 });
		if (url.includes("not-an-image")) {
			return new Response("<html>", {
				headers: { "content-type": "text/html" },
			});
		}
		return new Response(PNG_BYTES, {
			headers: { "content-type": "image/png" },
		});
	}) as unknown as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

async function exports() {
	// Imported lazily so the `server-only` stub above is in place first.
	return import("@/lib/exports/content-export");
}

test("the cover image reaches both document exports", async () => {
	const { createDocxExport, createPdfExport, fetchExportCover } =
		await exports();
	expect(await fetchExportCover("https://cdn.example/cover.png")).not.toBeNull();

	const input = { content: "Đoạn một.\n\nĐoạn hai.", title: "Bài kiểm thử" };
	const [withCover, without] = await Promise.all([
		createDocxExport({ ...input, coverUrl: "https://cdn.example/cover.png" }),
		createDocxExport(input),
	]);
	expect(withCover.byteLength).toBeGreaterThan(without.byteLength);

	const [pdfWith, pdfWithout] = await Promise.all([
		createPdfExport({ ...input, coverUrl: "https://cdn.example/cover.png" }),
		createPdfExport(input),
	]);
	expect(pdfWith.byteLength).toBeGreaterThan(pdfWithout.byteLength);
});

test("cover fetching identifies itself and leaks no referrer", async () => {
	// Several image CDNs reject a request with no User-Agent, which would have
	// silently dropped the cover from every export.
	const { fetchExportCover } = await exports();
	await fetchExportCover("https://cdn.example/cover.png");
	const call = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } })
		.mock.calls[0];
	const init = call?.[1] as RequestInit & { referrerPolicy?: string };
	expect(new Headers(init.headers).get("user-agent")).toContain("CyberShield35");
	expect(init.referrerPolicy).toBe("no-referrer");
});

test("an unusable cover is skipped rather than failing the export", async () => {
	const { createDocxExport, fetchExportCover } = await exports();
	// Plain http, a malformed URL, no cover, a 404 and a non-image response must
	// all be ignored: an export is worth more than a perfect cover.
	expect(await fetchExportCover("http://cdn.example/x.png")).toBeNull();
	expect(await fetchExportCover("not a url")).toBeNull();
	expect(await fetchExportCover(null)).toBeNull();
	expect(await fetchExportCover("https://cdn.example/missing.png")).toBeNull();
	expect(
		await fetchExportCover("https://cdn.example/not-an-image"),
	).toBeNull();

	const bytes = await createDocxExport({
		content: "Nội dung.",
		coverUrl: "https://cdn.example/missing.png",
		title: "Không có ảnh bìa",
	});
	expect(bytes.byteLength).toBeGreaterThan(0);
});
