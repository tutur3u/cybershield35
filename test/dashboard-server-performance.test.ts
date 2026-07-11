import { readFileSync } from "node:fs";

import { describe, expect, test } from "bun:test";

import {
	DASHBOARD_HEALTH_TAG,
	DASHBOARD_INTELLIGENCE_TAG,
	DASHBOARD_SCANS_TAG,
	DASHBOARD_TOPICS_TAG,
	DASHBOARD_TRACKED_SOURCES_TAG,
	dashboardIntelligenceTag,
	dashboardScanDetailTag,
	dashboardTopicTag,
} from "@/lib/dashboard/cache-tags";
import { dashboardInitialDataQueryOptions } from "@/lib/dashboard/client-queries";

function read(path: string) {
	return readFileSync(path, "utf8");
}

describe("dashboard server performance", () => {
	test("defers authenticated shell code and expensive font weights from public routes", () => {
		const layout = read("app/layout.tsx");

		expect(layout).not.toContain(
			'import { DashboardLayoutShell } from "@/components/dashboard/dashboard-layout-shell"',
		);
		expect(layout).not.toContain(
			'import { QueryProvider } from "@/components/providers/query-provider"',
		);
		expect(layout).toContain("await import(");
		expect(layout).toContain(
			"@/components/dashboard/dashboard-layout-shell",
		);
		expect(layout).not.toContain("QueryProvider");
		expect(read("components/dashboard/dashboard-route.tsx")).toContain(
			"<QueryProvider>",
		);
		expect(layout).toContain('weight: ["400", "600", "700"]');
		expect(layout).not.toContain('"800", "900"');
	});

	test("stops Tuturuuu member reads at the static shell and refreshes mutations in the background", () => {
		const membersRoute = read("app/members/page.tsx");
		const membersClient = read(
			"components/dashboard/workspace-members-page.tsx",
		);

		expect(membersRoute.indexOf("await io()"))
			.toBeLessThan(membersRoute.indexOf("getWorkspaceMembersInitialData()"));
		expect(membersClient).toContain("void queryClient.invalidateQueries");
		expect(membersClient).toContain('loading="lazy"');
		expect(membersClient).toContain("[content-visibility:auto]");
		expect(membersClient).not.toContain("@tuturuuu/ui/avatar");
	});

	test("keeps meaningful route headings in the instant app shell", () => {
		const skeleton = read("components/dashboard/dashboard-skeleton.tsx");
		const route = read("components/dashboard/dashboard-route.tsx");
		const sourcesPage = read("app/sources/page.tsx");

		expect(skeleton).toContain("<h1");
		expect(skeleton).toContain("{title}");
		expect(route).toContain('title: "Nguồn & Quét"');
		expect(route).toContain('title: "Tổng quan tình báo điều hành"');
		expect(sourcesPage).toContain(
			'<DashboardRouteSkeleton page="sources" />',
		);
	});

	test("defers scan snapshots and mutation bundles until evidence or topic intent", () => {
		for (const page of ["app/evidence/page.tsx", "app/topics/page.tsx"]) {
			expect(read(page)).not.toContain("getDashboardInitialData");
		}

		for (const workspace of [
			"components/dashboard/evidence-workspace.tsx",
			"components/dashboard/topics-workspace.tsx",
		]) {
			const source = read(workspace);
			expect(source).toContain("queryClient.fetchQuery");
			expect(source).toContain("await import(");
			expect(source).toContain("@/components/dashboard/client-actions");
			expect(source).toContain("void queryClient.invalidateQueries");
		}
	});

	test("uses distinct list, entity, topic, intelligence, and health tags", () => {
		expect(DASHBOARD_SCANS_TAG).toBe("dashboard:scans:list");
		expect(dashboardScanDetailTag("scan-1")).toBe("dashboard:scan:scan-1");
		expect(DASHBOARD_TRACKED_SOURCES_TAG).toBe("dashboard:tracked-sources");
		expect(DASHBOARD_TOPICS_TAG).toBe("dashboard:topics:list");
		expect(dashboardTopicTag("security")).toBe("dashboard:topic:security");
		expect(DASHBOARD_INTELLIGENCE_TAG).toBe("dashboard:intelligence:all");
		expect(dashboardIntelligenceTag("overview")).toBe(
			"dashboard:intelligence:overview",
		);
		expect(DASHBOARD_HEALTH_TAG).toBe("dashboard:health");
	});

	test("shares the cached scan-detail projection with the API and polls active detail efficiently", () => {
		const source = read("lib/dashboard/server-data.ts");
		const detailRoute = read("app/api/scans/[id]/route.ts");
		const detailCache = source.slice(
			source.indexOf("export async function getCachedDashboardScanDetail"),
		);

		expect(source).toContain(
			"cacheLife({ stale: 30, revalidate: 30, expire: 300 })",
		);
		expect(detailCache).toContain(
			"? { stale: 30, revalidate: 15, expire: 60 }",
		);
		expect(source).toContain(
			"cacheLife({ stale: 300, revalidate: 300, expire: 3600 })",
		);
		expect(detailCache).toContain("cacheTag(dashboardScanDetailTag(scanId))");
		expect(detailCache).not.toContain("cacheTag(DASHBOARD_SCANS_TAG");
		expect(detailRoute).toContain("getCachedDashboardScanDetail(id)");
		expect(detailRoute).not.toContain("getScanDetail(id)");
	});

	test("uses one active-scan polling owner and projects its status into the visible scan", () => {
		const withDetail = dashboardInitialDataQueryOptions({
			includeDetail: true,
			includeScans: true,
			includeTrackedSources: false,
		});
		const withoutDetail = dashboardInitialDataQueryOptions({
			includeDetail: false,
			includeScans: true,
			includeTrackedSources: false,
		});

		expect(withDetail.refetchInterval).toBe(false);
		expect(typeof withoutDetail.refetchInterval).toBe("function");
		const controller = read(
			"components/dashboard/cybershield-dashboard.tsx",
		);
		expect(controller).toContain("activeDetail?.job?.status");
		expect(controller).toContain("scanProgressForStatus(detailStatus)");
	});

	test("does not prefetch the unused intelligence overview for sources", () => {
		const source = read("lib/dashboard/server-prefetch.ts");
		const overviewPrefetch = source.slice(
			source.indexOf('if (["overview", "reports"].includes(page))'),
			source.indexOf('if (["alerts", "overview"'),
		);

		expect(overviewPrefetch).toContain('if (["overview", "reports"].includes(page))');
		expect(overviewPrefetch).not.toContain('"sources"');
	});

	test("clears rollup tables before rebuilding independent projections concurrently", () => {
		const source = read("lib/dashboard/intelligence-rollups.ts");
		const refresh = source.slice(
			source.indexOf("export async function refreshIntelligenceRollups"),
			source.indexOf("export async function refreshIntelligenceRollupsBestEffort"),
		);
		const clear = source.slice(
			source.indexOf("async function clearRollups"),
			source.indexOf("async function refreshDailyRollups"),
		);
		const claimIndex = source.slice(
			source.indexOf("async function refreshClaimIndex"),
			source.indexOf("async function refreshActivityRollups"),
		);

		expect(refresh.indexOf("await clearRollups()"))
			.toBeLessThan(refresh.indexOf("await Promise.all(["));
		for (const projection of [
			"refreshDailyRollups()",
			"refreshTopicRollups()",
			"refreshSourceRollups()",
			"refreshProviderRollups()",
			"refreshClaimIndex()",
			"refreshActivityRollups(reason)",
		]) {
			expect(refresh).toContain(projection);
		}
		expect(clear).toContain("await Promise.all([");
		expect(clear.match(/adminSqlClient`delete from intelligence_/gu)).toHaveLength(6);
		expect(claimIndex).toContain("const [analysesRows, contextRows] = await Promise.all([");
	});

	test("loads independent scan-detail children concurrently and scopes audit rows", () => {
		const source = read("lib/workers/scans.ts");
		const detailRead = source.slice(
			source.indexOf("export async function getScanDetail"),
			source.indexOf("export async function listEvidenceForScanPage"),
		);

		expect(detailRead).toContain(
			"const [analysisRows, evidence, drafts, runs, audit] = await Promise.all([",
		);
		expect(detailRead).toContain(
			'eq(auditEvents.entityType, "scan_job")',
		);
	});

	test("declares indexes for each hot dashboard ordering path", () => {
		const schema = read("lib/db/schema.ts");
		const migration = read("drizzle/0008_blue_zemo.sql");
		const indexes = [
			"scan_jobs_created_at_idx",
			"evidence_items_job_created_idx",
			"counter_argument_drafts_job_created_idx",
			"provider_runs_job_started_idx",
			"audit_events_entity_created_idx",
		];

		for (const index of indexes) {
			expect(schema).toContain(index);
			expect(migration).toContain(`CREATE INDEX "${index}"`);
		}
	});
});
