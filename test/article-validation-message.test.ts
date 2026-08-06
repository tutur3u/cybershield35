import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { articleUpdateSchema } from "@/lib/articles/schemas";
import { validationMessage } from "@/lib/http/validation-message";

/**
 * Pressing "Lưu và duyệt" showed customers
 * `{"errors":[],"properties":{"blocks":{"items":[null,null,{"url":["Invalid URL"]}]}}}`
 * across the top of the editor — precise about the failure, useless to the
 * person reading it.
 */
describe("a rejected save explains itself", () => {
	const failure = (input: unknown) => {
		const result = articleUpdateSchema.safeParse(input);
		expect(result.success).toBe(false);
		if (result.success) throw new Error("expected a rejection");
		return validationMessage(result.error, "Nội dung bài viết chưa hợp lệ.");
	};

	test("an unfilled image block names its position", () => {
		const message = failure({
			blocks: [
				{ content: "một", id: "a", type: "text" },
				{ content: "hai", id: "b", type: "text" },
				{ id: "c", type: "image", url: "" },
			],
		});
		expect(message).toContain("Đường dẫn ảnh");
		expect(message).not.toContain("errors");
		expect(message).not.toContain("{");
	});

	test("an over-long title says so in the reader's terms", () => {
		expect(failure({ title: "x".repeat(400) })).toContain("Tiêu đề");
	});

	test("the route no longer answers with a tree", () => {
		const route = readFileSync("app/api/articles/[id]/route.ts", "utf8");
		expect(route).not.toContain("treeifyError");
		expect(route).toContain("validationMessage(error,");
	});
});

describe("an unfilled image placeholder is not sent", () => {
	test("the editor drops it rather than failing the save", () => {
		// "Thêm ảnh" inserts an empty block for the picker to fill; saving before
		// choosing a file used to be rejected outright.
		const hook = readFileSync(
			"components/dashboard/article-editor/use-article-editor.ts",
			"utf8",
		);
		expect(hook).toContain(
			'(block) => block.type !== "image" || block.url.trim().length > 0,',
		);
	});
});
