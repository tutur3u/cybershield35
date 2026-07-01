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
	});

	test("adds authenticated intelligence endpoints for overview and drilldowns", () => {
		for (const endpoint of [
			"overview",
			"topics",
			"evidence",
			"claims",
			"sources",
			"activity",
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
		const queries = read("lib/dashboard/client-queries.ts");
		const keys = read("lib/dashboard/query-keys.ts");

		expect(widgets).toContain("useInfiniteQuery");
		expect(widgets).toContain("useVirtualizer");
		expect(widgets).toContain("useSearchParams");
		expect(widgets).toContain("router.replace");
		expect(widgets).toContain("DashboardTooltip");
		expect(queries).toContain("intelligenceOverviewQueryOptions");
		expect(queries).toContain("intelligenceEvidenceInfiniteQueryOptions");
		expect(keys).toContain("intelligenceEvidenceInfinite");
	});

	test("keeps broad dashboard routes off selected scan detail fetches", () => {
		for (const page of ["overview", "evidence", "alerts", "audit"] as const) {
			expect(dashboardSnapshotRequirements(page).includeDetail).toBe(false);
		}
		expect(dashboardSnapshotRequirements("analysis").includeDetail).toBe(true);
		expect(dashboardSnapshotRequirements("reports").includeDetail).toBe(true);
	});

	test("refreshes projections from mutation paths and cache invalidation", () => {
		const scans = read("lib/workers/scans.ts");
		const cache = read("lib/dashboard/cache-invalidation.ts");
		const rollups = read("lib/dashboard/intelligence-rollups.ts");

		expect(scans).toContain("refreshIntelligenceRollupsBestEffort");
		expect(cache).toContain("DASHBOARD_INTELLIGENCE_TAG");
		expect(rollups).toContain("refreshDailyRollups");
		expect(rollups).toContain("refreshTopicRollups");
		expect(rollups).toContain("refreshClaimIndex");
	});
});
