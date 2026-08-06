import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * Zalo rendered three authored paragraphs as one run —
 * "…nền kinh tế.Những áp lực…" — with no break and not even a space, while
 * CS35's own preview showed them apart. It drops the newlines inside a text
 * element rather than treating them as breaks, so paragraphs have to arrive as
 * separate elements.
 */
describe("paragraphs survive the trip to Zalo", () => {
	const client = readFileSync("lib/zalo/client.ts", "utf8");

	test("each paragraph becomes its own body element", () => {
		expect(client).toContain("body: content.blocks.flatMap<ZaloBodyElement>");
		expect(client).toContain("split(/\\n{2,}/u)");
		expect(client).toContain('.map((paragraph) => ({ content: paragraph, type: "text" }))');
	});

	test("images still pass through as single elements", () => {
		expect(client).toContain('type: "image",');
		expect(client).toContain("...(block.caption ? { caption: block.caption } : {})");
	});

	test("empty paragraphs are dropped rather than sent as blanks", () => {
		expect(client).toContain(".filter(Boolean)");
	});
});

describe("the confirmation dialog reads as one panel", () => {
	const dialog = readFileSync("components/dashboard/confirm-dialog.tsx", "utf8");

	test("no tinted footer band with a rule through it", () => {
		// The imported footer draws its own divider and background, which made the
		// question and its buttons look like two unrelated panels in one box.
		expect(dialog).not.toContain("DialogFooter");
	});

	test("tone is carried by an icon, and danger confirms in red", () => {
		expect(dialog).toContain("<TriangleAlert size={17} />");
		expect(dialog).toContain("<HelpCircle size={17} />");
		expect(dialog).toContain('bg-[var(--danger-strong)] hover:opacity-90');
		expect(dialog).toContain("bg-[var(--accent-fill)]");
	});

	test("dismissing is still a no", () => {
		expect(dialog).toContain("if (!open) settle(false);");
	});
});
