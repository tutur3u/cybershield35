import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
	parseTimelineSearchParams,
	serializeTimelineFilters,
	timelineFiltersFromRecord,
} from "@/lib/dashboard/timeline-query";

describe("timeline query contract", () => {
	test("uses all posts and newest published first by default", () => {
		const parsed = parseTimelineSearchParams(new URLSearchParams());
		expect(parsed).toMatchObject({
			cursor: null,
			filters: { due: "all", risk: "all", sort: "published-desc", timeRange: "all", triageStatus: "all" },
			limit: 30,
		});
	});

	test("strictly validates dates, enums, limits, and ranges", () => {
		expect(() => parseTimelineSearchParams(new URLSearchParams("dateFrom=2026-13-01"))).toThrow();
		expect(() => parseTimelineSearchParams(new URLSearchParams("sort=random"))).toThrow();
		expect(() => parseTimelineSearchParams(new URLSearchParams("limit=51"))).toThrow();
		expect(() => parseTimelineSearchParams(new URLSearchParams("dateFrom=2026-07-11&dateTo=2026-07-10"))).toThrow();
	});

	test("renderer view never enters the data filters or query key", () => {
		const filters = timelineFiltersFromRecord({ q: "chiến dịch", view: "list" });
		expect(filters.query).toBe("chiến dịch");
		expect(serializeTimelineFilters(filters)).toEqual({ q: "chiến dịch" });
	});

	test("round-trips every collaboration filter", () => {
		const params = serializeTimelineFilters({
			assignee: "unassigned",
			dateFrom: "2026-07-01",
			dateTo: "2026-07-11",
			due: "overdue",
			isPinned: true,
			risk: "high",
			sentiment: "negative",
			sort: "triage-updated-desc",
			stance: "opposed",
			timeRange: "all",
			topic: "an-ninh",
			triageStatus: "action_required",
		});
		const parsed = parseTimelineSearchParams(new URLSearchParams(params));
		expect(parsed.filters).toMatchObject({
			assignee: "unassigned",
			dateFrom: "2026-07-01",
			dateTo: "2026-07-11",
			due: "overdue",
			isPinned: true,
			risk: "high",
			sentiment: "negative",
			sort: "triage-updated-desc",
			stance: "opposed",
			topic: "an-ninh",
			triageStatus: "action_required",
		});
	});
});

describe("timeline implementation safety", () => {
	const server = readFileSync("lib/dashboard/timeline-server.ts", "utf8") +
		readFileSync("lib/dashboard/timeline-shared.ts", "utf8") +
		readFileSync("lib/dashboard/timeline-mapping.ts", "utf8") +
		readFileSync("lib/dashboard/timeline-related.ts", "utf8") +
		readFileSync("lib/dashboard/timeline-triage.ts", "utf8");
	const migration = readFileSync("drizzle/0009_flashy_dark_beast.sql", "utf8");

	test("uses stable keyset ordering and safe engagement parsing", () => {
		expect(server).toContain("effectivePublishedAt");
		expect(server).toContain("timelineCursorCondition");
		expect(server).toContain("~ '^\\\\d+$'");
		expect(server).not.toContain(".offset(");
	});

	test("keeps note bodies out of audit and activity payloads", () => {
		const noteAudit = server.slice(server.indexOf('action: "evidence_triage_note_added"'));
		expect(noteAudit).toContain("noteId");
		const auditPayload = noteAudit.slice(0, noteAudit.indexOf("tx.insert(intelligenceActivityRollups)"));
		const activityPayload = noteAudit.slice(
			noteAudit.indexOf("tx.insert(intelligenceActivityRollups)"),
			noteAudit.indexOf("return created"),
		);
		expect(auditPayload).not.toContain("body:");
		expect(activityPayload).not.toContain("body:");
	});

	test("migration includes cascades, RLS, revokes, and timeline indexes", () => {
		expect(migration).toContain("ON DELETE cascade");
		expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
		expect(migration).toContain('REVOKE ALL ON TABLE "public"."evidence_triage" FROM PUBLIC');
		expect(migration).toContain('evidence_items_engagement_published_idx');
		expect(migration).toContain('evidence_triage_assignee_status_idx');
	});
});
