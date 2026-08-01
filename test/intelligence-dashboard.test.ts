import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { dashboardSnapshotRequirements } from "@/lib/dashboard/route-requirements";

const root = process.cwd();

function read(path: string) {
	return readFileSync(join(root, path), "utf8");
}

describe("executive intelligence dashboard architecture", () => {
	test("declares persistent intelligence projections and backfill command", () => {
		const schema = read("lib/db/schema.ts");
		const pkg = JSON.parse(read("package.json")) as {
			dependencies: Record<string, string>;
			scripts: Record<string, string>;
		};

		for (const table of [
			"intelligence_daily_rollups",
			"intelligence_topic_rollups",
			"intelligence_source_rollups",
			"intelligence_provider_rollups",
			"intelligence_claim_index",
			"intelligence_activity_rollups",
		]) {
			expect(schema).toContain(table);
		}
		expect(pkg.dependencies["@tanstack/react-virtual"]).toBeTruthy();
		expect(pkg.scripts["db:backfill-intelligence"]).toContain(
			"scripts/backfill-intelligence.ts",
		);
		expect(pkg.scripts["db:analyze-intelligence"]).toContain(
			"scripts/analyze-intelligence-db.ts",
		);
	});

	test("adds authenticated intelligence endpoints for overview and drilldowns", () => {
		for (const endpoint of [
			"overview",
			"topics",
			"evidence",
			"claims",
			"sources",
			"activity",
			"facebook-pages",
		]) {
			const source = read(`app/api/intelligence/${endpoint}/route.ts`);
			expect(source).toContain("requireAdminSession");
			expect(source).toContain("authHeaders");
			expect(source).not.toContain("raw");
			expect(source).not.toContain("tokenHash");
		}
	});

	test("uses TanStack Query, infinite loading, URL filters, and virtualization", () => {
		const widgets = read("components/dashboard/intelligence-widgets.tsx");
		const evidenceVault = read(
			"components/dashboard/intelligence-evidence-vault.tsx",
		);
		const shared = read(
			"components/dashboard/intelligence-workspace-shared.tsx",
		);
		const queries = read("lib/dashboard/client-queries.ts");
		const keys = read("lib/dashboard/query-keys.ts");

		expect(widgets).toContain("useInfiniteQuery");
		expect(evidenceVault).toContain("useVirtualizer");
		expect(evidenceVault).toContain("ref={rowVirtualizer.measureElement}");
		expect(shared).toContain("useSearchParams");
		expect(shared).toContain("window.history.replaceState");
		expect(shared).toContain("DashboardTooltip");
		expect(queries).toContain("intelligenceOverviewQueryOptions");
		expect(queries).toContain("intelligenceEvidenceInfiniteQueryOptions");
		expect(queries).toContain("intelligenceFacebookPagesQueryOptions");
		expect(keys).toContain("intelligenceEvidenceInfinite");
		expect(keys).toContain("intelligenceFacebookPages");
		expect(shared).toContain("facebookPage");
		expect(shared).toContain("Tất cả fanpage");
	});

	test("exposes Facebook page context for evidence and filters", () => {
		const types = read("components/dashboard/types.ts");
		const server = read("lib/dashboard/intelligence-server.ts");
		const shared = read("app/api/intelligence/_shared.ts");

		expect(types).toContain("IntelligenceFacebookPageOption");
		expect(types).toContain("facebookPageId");
		expect(types).toContain("facebookUsername");
		expect(types).toContain("originalPostHref");
		expect(server).toContain("listIntelligenceFacebookPages");
		expect(server).toContain("facebookEvidenceCondition");
		expect(server).toContain("metadata}->>'facebookId'");
		expect(shared).toContain("facebookPage");
	});

	test("keeps automatic draft controls actionable and explains blocked pages", () => {
		const sourcesPage = read("components/dashboard/sources-page.tsx");

		expect(sourcesPage).toContain('role="switch"');
		expect(sourcesPage).toContain(
			"Tự động tạo bản nháp cần duyệt cho ${page.label}",
		);
		expect(sourcesPage).toContain(
			"Chọn “Đáng tin” hoặc “Có rủi ro” phía trên",
		);
		expect(sourcesPage).toContain("feedbackByPage");
		expect(sourcesPage).toContain("updateCachedPage");
		expect(sourcesPage).not.toContain('type="checkbox"');
	});

	test("keeps broad dashboard routes off selected scan detail fetches", () => {
		for (const page of ["overview", "evidence", "alerts", "audit"] as const) {
			expect(dashboardSnapshotRequirements(page).includeDetail).toBe(false);
		}
		expect(dashboardSnapshotRequirements("audit")).toEqual({
			includeDetail: false,
			includeScans: false,
			includeTrackedSources: false,
		});
		expect(dashboardSnapshotRequirements("analysis").includeDetail).toBe(true);
		expect(dashboardSnapshotRequirements("reports").includeDetail).toBe(true);
	});

	test("isolates intelligence routes from the dashboard controller", () => {
		const dashboard = read("components/dashboard/cybershield-dashboard.tsx");
		const dashboardPages = read("components/dashboard/dashboard-pages.tsx");
		const auditPage = read("components/dashboard/audit-page.tsx");
		const evidencePage = read("components/dashboard/evidence-page.tsx");
		const topicsPage = read("components/dashboard/topics-page.tsx");
		const auditRoute = read("app/audit/page.tsx");
		const evidenceRoute = read("app/evidence/page.tsx");
		const topicsRoute = read("app/topics/page.tsx");
		const topicDetailRoute = read("app/topics/[slug]/page.tsx");

		expect(auditRoute).toContain("<AuditContent />");
		expect(auditRoute).toContain("HydrationBoundary");
		expect(auditRoute).not.toContain(
			'from "@/components/dashboard/dashboard-route"',
		);
		expect(auditPage).toContain("<IntelligenceActivityStream />");
		expect(auditPage).toContain("intelligence-activity-stream");
		expect(auditPage).not.toContain("props.detail");
		expect(evidencePage).toContain("evidence-timeline");
		expect(topicsPage).toContain("intelligence-topics-workspace");
		expect(evidenceRoute).toContain("<EvidenceWorkspace");
		expect(evidenceRoute).not.toContain(
			'from "@/components/dashboard/dashboard-route"',
		);
		expect(topicsRoute).toContain("<TopicsWorkspace");
		expect(topicsRoute).not.toContain(
			'from "@/components/dashboard/dashboard-route"',
		);
		expect(topicDetailRoute).toContain("<TopicDetailsContent");
		expect(topicDetailRoute).not.toContain(
			'from "@/components/dashboard/dashboard-route"',
		);
		expect(dashboard).toContain('import("@/components/dashboard/topics-page")');
		expect(dashboard).toContain('import("@/components/dashboard/evidence-page")');
		expect(dashboard).toContain('import("@/components/dashboard/audit-page")');
		expect(dashboard).not.toContain("const AlertsPage = dynamic");
		expect(dashboardPages).not.toContain("export function TopicsPage");
		expect(dashboardPages).not.toContain("export function EvidencePage");
		expect(dashboardPages).not.toContain("export function AuditPage");
	});

	test("refreshes projections from mutation paths and cache invalidation", () => {
		const scans = read("lib/workers/scans.ts");
		const cache = read("lib/dashboard/cache-invalidation.ts");
		const rollups = read("lib/dashboard/intelligence-rollups.ts");
		const backfillScript = read("scripts/backfill-intelligence.ts");

		expect(scans).toContain("refreshIntelligenceRollupsBestEffort");
		expect(cache).toContain("DASHBOARD_INTELLIGENCE_TAG");
		expect(rollups).toContain("refreshDailyRollups");
		expect(rollups).toContain("refreshTopicRollups");
		expect(rollups).toContain("refreshClaimIndex");
		expect(rollups).toContain("parsed <= 1 ? parsed * 100 : parsed");
		expect(backfillScript).toContain("loadLocalEnvFile");
		expect(backfillScript).toContain("adminSqlClient.end");
	});
});
