import { describe, expect, test } from "bun:test";

import { detectSource } from "@/lib/domain/source-detection";
import { resolveScanProvider } from "@/lib/domain/provider-override";

describe("resolveScanProvider", () => {
	test("keeps detected providers when no override is requested", () => {
		const detection = detectSource("https://ai.daklak.gov.vn");

		expect(resolveScanProvider(detection)).toBe("firecrawl");
	});

	test("allows Browser Use override for URL-based sources", () => {
		const detection = detectSource("https://www.facebook.com/taynguyennanggiodaingan");

		expect(resolveScanProvider(detection, "browser_use")).toBe("browser_use");
	});

	test("rejects Browser Use override for manual text", () => {
		const detection = detectSource("nội dung cần phân tích");

		expect(() => resolveScanProvider(detection, "browser_use")).toThrow(
			"Browser Use can only be selected for URL scans",
		);
	});

	test("rejects Browser Use override for uploaded files", () => {
		const detection = detectSource("document.pdf", {
			fileName: "document.pdf",
			mimeType: "application/pdf",
		});

		expect(() => resolveScanProvider(detection, "browser_use")).toThrow(
			"Browser Use can only be selected for URL scans",
		);
	});
});
