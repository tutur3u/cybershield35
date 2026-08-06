import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { articleBulkActionSchema } from "@/lib/articles/schemas";
import { articleStatusStep } from "@/lib/articles/status-step";

/** Only the fields a case cares about; the rest take their common values. */
const step = (overrides: {
	remote?: boolean;
	reviewStatus: string;
	status: string;
}) => articleStatusStep({ reason: null, ...overrides });

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
		expect(workspace).toContain("Tiếp theo:");
		expect(workspace).not.toContain("function ZaloStatusBadge");

		// Every position on the pipeline is reachable, including the two the
		// status alone cannot distinguish (draft vs awaiting review).
		const labels = [
			step({ reviewStatus: "draft", status: "not_synced" }),
			step({ reviewStatus: "needs_review", status: "not_synced" }),
			step({ reviewStatus: "approved", status: "not_synced" }),
			step({ reviewStatus: "approved", status: "hidden" }),
			step({ reviewStatus: "approved", status: "published" }),
			step({ reviewStatus: "rejected", status: "not_synced" }),
			step({ reviewStatus: "approved", status: "failed" }),
		].map((entry) => entry.label);
		expect(labels).toEqual([
			"Bản nháp",
			"Chờ duyệt",
			"Đã duyệt",
			"Ẩn trên Zalo",
			"Đang hiển thị",
			"Đã từ chối",
			"Đăng lỗi",
		]);
		// The track advances monotonically along that same order.
		expect(step({ reviewStatus: "draft", status: "not_synced" }).index).toBe(0);
		expect(step({ reviewStatus: "approved", status: "published" }).index).toBe(4);
	});

	test("an unapproved article never reads as a Zalo publish state", () => {
		// A queued sync the rules reject leaves "failed"/"syncing" behind on an
		// article nobody approved. Reporting that verbatim tells the operator a
		// publish went wrong — or is in flight — when none was ever attempted.
		for (const status of ["failed", "syncing", "publishing", "scheduled"]) {
			expect(step({ reviewStatus: "needs_review", status }).label).toBe(
				"Chờ duyệt",
			);
		}
		expect(step({ reviewStatus: "approved", status: "failed" }).label).toBe(
			"Đăng lỗi",
		);
	});

	test("an unapproved article still on Zalo says so", () => {
		// The one Zalo fact worth reporting without approval, because it is
		// something the operator has to act on rather than wait for.
		for (const status of ["hidden", "published"]) {
			const entry = step({ remote: true, reviewStatus: "needs_review", status });
			expect(entry.label).toBe("Còn trên Zalo");
			expect(entry.tone).toBe("danger");
			expect(entry.next).toContain("Gỡ khỏi Zalo OA");
		}
		// Without a remote article there is nothing on the OA to report.
		expect(
			step({ remote: false, reviewStatus: "needs_review", status: "hidden" })
				.label,
		).toBe("Chờ duyệt");
	});
});

describe("hidden file inputs stay inside their layout", () => {
	// `sr-only` positions an element absolutely. Inside a scroll container with
	// no positioned ancestor it resolves against the document, so its static
	// position — hundreds of pixels down the scrolled content — stretched the
	// page to reach it: a second scrollbar ending in blank space.
	const files = [
		"components/dashboard/article-editor/media-fields.tsx",
		"components/dashboard/profile-settings-panel.tsx",
	];

	for (const file of files) {
		test(`${file} gives its sr-only input a containing block`, () => {
			const source = readFileSync(file, "utf8");
			const at = source.indexOf('className="sr-only"');
			expect(at).toBeGreaterThan(-1);
			// The containing block is declared on an ancestor within a few lines.
			expect(source.slice(Math.max(0, at - 500), at)).toContain("relative");
		});
	}
});
