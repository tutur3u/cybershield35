import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("operations observability", () => {
	const schema = read("lib/db/schema.ts");
	const migration = read("drizzle/0010_nasty_jamie_braddock.sql");
	const server = read("lib/operations/server.ts");
	const telemetry = read("lib/operations/telemetry.ts");
	const worker = read("lib/workers/scans.ts");
	const page = read("components/dashboard/operations-page.tsx");

	test("persists append-only pipeline events with query indexes and protected access", () => {
		expect(schema).toContain('"scan_job_events"');
		expect(schema).toContain("scan_job_events_job_time_idx");
		expect(schema).toContain("scan_job_events_stage_status_time_idx");
		expect(migration).toContain("ON DELETE cascade");
		expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
		expect(migration).toContain('REVOKE ALL ON TABLE "public"."scan_job_events" FROM PUBLIC');
	});

	test("records every important worker stage without making telemetry fatal", () => {
		for (const event of [
			"scan_queued",
			"scan_claimed",
			"provider_started",
			"provider_completed",
			"evidence_persisted",
			"analysis_started",
			"analysis_completed",
			"topics_completed",
			"scan_completed",
			"scan_retry_scheduled",
			"scan_failed",
		]) {
			expect(worker).toContain(event);
		}
		expect(telemetry).toContain("Telemetry must never prevent a scan");
		expect(telemetry).toContain("scan_pipeline_event_write_failed");
	});

	test("loads independent operations projections concurrently with short cache lifetime", () => {
		expect(server).toContain('cacheLife({ stale: 10, revalidate: 10, expire: 60 })');
		expect(server).toContain("await Promise.all([");
		expect(server).toContain("oldestQueuedAgeSeconds");
		expect(server).toContain("successRate");
	});

	test("ships live Vietnamese queue, pipeline, service, provider, and event UX", () => {
		expect(page).toContain('title="Vận hành hệ thống"');
		expect(page).toContain("Pipeline xử lý");
		expect(page).toContain("Scan gần đây");
		expect(page).toContain("Dịch vụ & heartbeat");
		expect(page).toContain("Độ tin cậy provider · 24 giờ");
		expect(page).toContain("Dòng sự kiện pipeline");
		expect(page).toContain("Tự làm mới 15 giây");
	});

	test("uses structured logs without logging provider payloads", () => {
		expect(telemetry).toContain('service: "cybershield35"');
		expect(telemetry).not.toContain("originalInput");
		expect(telemetry).not.toContain("accessToken");
	});
});
