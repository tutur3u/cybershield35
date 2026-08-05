import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { articleBulkActionSchema } from "@/lib/articles/schemas";

describe("bulk article actions", () => {
	test("accepts every action the toolbar offers", () => {
		for (const action of ["sync_hidden", "publish", "hide", "delete"] as const) {
			expect(
				articleBulkActionSchema.safeParse({
					action,
					articleIds: ["11111111-1111-4111-8111-111111111111"],
				}).success,
			).toBe(true);
		}

		expect(
			articleBulkActionSchema.safeParse({
				action: "set_review_status",
				articleIds: ["11111111-1111-4111-8111-111111111111"],
				status: "approved",
			}).success,
		).toBe(true);
	});

	test("refuses an empty or oversized batch", () => {
		expect(
			articleBulkActionSchema.safeParse({ action: "delete", articleIds: [] })
				.success,
		).toBe(false);
		expect(
			articleBulkActionSchema.safeParse({
				action: "delete",
				articleIds: Array.from(
					{ length: 101 },
					() => "11111111-1111-4111-8111-111111111111",
				),
			}).success,
		).toBe(false);
	});
});

describe("the articles list drives bulk actions", () => {
	const workspace = readFileSync(
		"components/dashboard/articles-workspace.tsx",
		"utf8",
	);

	test("selection only ever acts on rows still on screen", () => {
		// A selection outliving its rows would silently act on articles the
		// operator can no longer see.
		expect(workspace).toContain(
			"const selectedVisible = visibleIds.filter((id) => selected.has(id));",
		);
		expect(workspace).toContain("articleIds: selectedVisible");
	});

	test("destructive and audience-facing actions confirm first", () => {
		// The product's own dialog, not window.confirm — see test/confirm-dialog.
		expect(workspace).toContain("useConfirmDialog()");
		expect(workspace).toContain("await confirm({");
		expect(workspace).toContain('onRun({ action: "delete" })');
		expect(workspace).toContain('onRun({ action: "publish" })');
	});

	test("one status column says where the article is and what is next", () => {
		// "Duyệt" and "Trên Zalo OA" were separate, so the reader had to combine
		// them to answer the only question that matters, and they contradicted
		// each other — "Chờ duyệt" beside "Chưa đăng" states the same fact twice.
		expect(workspace).toContain("function ArticleStatusCell");
		expect(workspace).toContain("function articleStatusStep");
		expect(workspace).toContain("Tiếp theo:");
		expect(workspace).not.toContain("function ZaloStatusBadge");

		// Every position on the pipeline is reachable, including the two the
		// status alone cannot distinguish (draft vs awaiting review).
		for (const label of [
			"Bản nháp",
			"Chờ duyệt",
			"Đã duyệt",
			"Ẩn trên Zalo",
			"Đang hiển thị",
			"Đã từ chối",
			"Đăng lỗi",
		]) {
			expect(workspace).toContain(`"${label}"`);
		}
	});

	test("an unapproved article never reads as a publish failure", () => {
		// The stored error on an unapproved article is usually the approval gate
		// itself; reporting that as "Đăng lỗi" blames the publish for a refusal
		// nobody had asked for yet.
		expect(workspace).toContain(
			'if (status === "failed" && reviewStatus === "approved")',
		);
		expect(workspace).toContain('if (reviewStatus !== "approved")');
	});
});
