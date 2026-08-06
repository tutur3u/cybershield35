import { describe, expect, test } from "bun:test";

import {
	facebookHandleFromUrlText,
	pageIdentity,
} from "@/lib/domain/page-identity";

describe("naming a followed page", () => {
	test("the name a person typed beats every scraped field", () => {
		// tracked_sources is the only one of the three name columns anybody edits.
		expect(
			pageIdentity({
				author: "example-org",
				displayName: "Tổ chức ví dụ",
				handle: "example-org",
				sourceLabel: "facebook.com",
			}),
		).toEqual({ handle: "example-org", name: "Tổ chức ví dụ" });
	});

	test("both are shown whenever they say different things", () => {
		// The whole point of the pair: the name to recognise, the handle to verify.
		const identity = pageIdentity({
			displayName: "Trang tin ví dụ",
			handle: "ExampleNews",
		});
		expect(identity.name).toBe("Trang tin ví dụ");
		expect(identity.handle).toBe("ExampleNews");
	});

	test("a handle that merely repeats the name is dropped", () => {
		// Otherwise the card prints the same word twice, the second with an @.
		expect(pageIdentity({ displayName: "example-org", handle: "example-org" }))
			.toEqual({ handle: null, name: "example-org" });
		expect(pageIdentity({ displayName: "Example-Org", handle: "example-org" }))
			.toEqual({ handle: null, name: "Example-Org" });
	});

	test("with no saved name the handle becomes the name rather than nothing", () => {
		// The bug this replaces: the display name was the handle, so the handle
		// was suppressed as a duplicate and the card led with the provider label.
		expect(pageIdentity({ author: "@example-org" })).toEqual({
			handle: null,
			name: "example-org",
		});
	});

	test("the handle is read out of the page URL when no field carries it", () => {
		expect(
			pageIdentity({
				displayName: "Fanpage ví dụ",
				sourceUrl: "https://www.facebook.com/example-fanpage/posts/123",
			}).handle,
		).toBe("example-fanpage");
	});

	test("a numeric page id is not offered as a handle", () => {
		// "@10012345" is not something a reader can look up or recognise.
		expect(pageIdentity({ displayName: "Trang ví dụ", handle: "100123456789" }))
			.toEqual({ handle: null, name: "Trang ví dụ" });
	});

	test("a name is always produced, even with nothing to go on", () => {
		expect(pageIdentity({}).name).toBe("Nguồn chưa đặt tên");
		expect(pageIdentity({ fallback: "Apify" }).name).toBe("Apify");
	});

	test("only Facebook URLs yield a handle", () => {
		expect(facebookHandleFromUrlText("https://example.com/example-org")).toBeNull();
		expect(facebookHandleFromUrlText("https://facebook.com/example-org")).toBe(
			"example-org",
		);
		expect(facebookHandleFromUrlText("not a url")).toBeNull();
		expect(facebookHandleFromUrlText(null)).toBeNull();
	});
});
