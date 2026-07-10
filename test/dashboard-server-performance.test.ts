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

function read(path: string) {
	return readFileSync(path, "utf8");
}

describe("dashboard server performance", () => {
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

	test("keeps scan detail out of list invalidation and applies max-speed lifetimes", () => {
		const source = read("lib/dashboard/server-data.ts");
		const detailCache = source.slice(source.indexOf("async function getCachedScanDetail"));

		expect(source).toContain(
			"cacheLife({ stale: 30, revalidate: 30, expire: 300 })",
		);
		expect(source).toContain(
			"cacheLife({ stale: 300, revalidate: 300, expire: 3600 })",
		);
		expect(detailCache).toContain("cacheTag(dashboardScanDetailTag(scanId))");
		expect(detailCache).not.toContain("cacheTag(DASHBOARD_SCANS_TAG");
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
