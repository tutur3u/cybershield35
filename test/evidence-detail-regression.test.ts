import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("evidence detail routing regression", () => {
	test("loads the requested evidence UUID instead of falling back to another scan item", () => {
		const route = read("app/evidence/[id]/page.tsx");
		const server = read("lib/dashboard/timeline-server.ts");
		const legacyDetails = read("components/dashboard/detail-pages.tsx");

		expect(route).toContain("getTimelinePostById(id)");
		expect(route).toContain("if (!evidence) notFound()");
		expect(server).toContain("where(eq(evidenceItems.id, evidenceId))");
		expect(legacyDetails).not.toContain("?? props.evidence[0]");
	});

	test("hydrates and revalidates one stable evidence-detail query key", () => {
		const dashboardRoute = read("components/dashboard/dashboard-route.tsx");
		const queries = read("lib/dashboard/client-queries.ts");
		const keys = read("lib/dashboard/query-keys.ts");

		expect(keys).toContain('["dashboard", "evidence-detail", evidenceId]');
		expect(dashboardRoute).toContain("dashboardQueryKeys.evidenceDetail(evidenceDetail.id)");
		expect(queries).toContain("fetchEvidenceDetail(evidenceId)");
	});

	test("keeps hook-owning topic panels behind an explicit client boundary", () => {
		const widgets = read("components/dashboard/analysis-widgets.tsx");
		expect(widgets.startsWith('"use client";')).toBe(true);
		expect(widgets).toContain("useInfiniteQuery");
		expect(widgets).toContain("Tải thêm bài viết");
	});

	test("shows exact evidence identity and semantically related evidence", () => {
		const details = read("components/dashboard/evidence-details-page.tsx");
		const relatedDetails = read(
			"components/dashboard/evidence-related-panel.tsx",
		);
		const timeline = read("components/dashboard/evidence-timeline.tsx");

		expect(details).toContain("data-evidence-id={evidence.id}");
		expect(relatedDetails).toContain("Bằng chứng liên quan");
		expect(relatedDetails).toContain("kết quả yếu hoặc trùng lặp được ẩn");
		expect(relatedDetails).toContain("Vì sao liên quan");
		expect(relatedDetails).toContain("relationshipLabel(item.relationship)");
		expect(relatedDetails).toContain("item.reasons.map");
		expect(details).toContain("relatedEvidenceQueryOptions");
		expect(details).toContain("requestSemanticRebuild(force)");
		expect(details).toContain("force = false");
		expect(`${details}${relatedDetails}`).not.toContain("Bằng chứng cùng scan");
		expect(details).toContain("Mở bảng xử lý");
		expect(details).toContain("Mức ưu tiên kết hợp tín hiệu");
		expect(details).toContain("Hình ảnh gốc được giữ lại");
		expect(timeline).toContain("Xem chi tiết");
		expect(timeline).toContain("Tải thêm bài viết");
	});
});
