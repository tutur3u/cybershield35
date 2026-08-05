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
		expect(workspace).toContain("window.confirm");
		expect(workspace).toContain('onRun({ action: "delete" })');
		expect(workspace).toContain('onRun({ action: "publish" })');
	});

	test("every Zalo badge explains itself", () => {
		// A badge that only names a state leaves the reader guessing what would
		// move it forward.
		expect(workspace).toContain("function zaloBadgeHelp");
		for (const status of [
			"failed",
			"hidden",
			"published",
			"publishing",
			"scheduled",
			"syncing",
		]) {
			expect(workspace).toContain(`case "${status}":`);
		}
	});

	test("an unapproved article says so instead of reading as merely unposted", () => {
		// "Chưa đăng" covers both an approved article awaiting a push and one that
		// cannot go anywhere until somebody reviews it.
		expect(workspace).toContain("const awaitingReview =");
		expect(workspace).toContain('reviewStatus !== "approved"');
		expect(workspace).toContain("chưa được phê duyệt");
	});

	test("needing approval outranks a failure whose reason is that approval", () => {
		// The stored error on an unapproved article is usually the approval gate
		// itself. Showing "Đăng lỗi" reports a refusal to do something nobody asked
		// for yet as though the publish had broken.
		expect(workspace).toContain("const liveOnZalo =");
		expect(workspace).toContain("!liveOnZalo && reviewStatus !== undefined");
	});
});
