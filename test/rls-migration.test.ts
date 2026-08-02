import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const appTables = [
	"sources",
	"scan_jobs",
	"scan_job_events",
	"tracked_sources",
	"provider_runs",
	"evidence_items",
	"evidence_semantic_profiles",
	"evidence_triage",
	"evidence_triage_notes",
	"analyses",
	"counter_argument_drafts",
	"audit_events",
	"cron_heartbeats",
	"managed_scheduler_integrations",
	"chat_conversations",
	"chat_messages",
	"chat_attachments",
	"chat_attachment_chunks",
	"chat_model_runs",
	"chat_tool_runs",
	"counter_argument_draft_versions",
	"facebook_page_profiles",
	"draft_automation_jobs",
	"ai_prompt_presets",
	"article_evidence",
	"article_media",
	"article_publication_jobs",
	"article_versions",
	"articles",
	"zalo_oa_connections",
] as const;

describe("RLS migration", () => {
	const migrationSql = readdirSync("drizzle")
		.filter((file) => file.endsWith(".sql"))
		.map((file) => readFileSync(join("drizzle", file), "utf8"))
		.join("\n");

	test("enables row level security for every application table", () => {
		for (const table of appTables) {
			expect(migrationSql).toContain(
				`ALTER TABLE "public"."${table}" ENABLE ROW LEVEL SECURITY`,
			);
		}
	});

	test("revokes direct public table access for every application table", () => {
		for (const table of appTables) {
			expect(migrationSql).toContain(
				`REVOKE ALL ON TABLE "public"."${table}" FROM PUBLIC`,
			);
		}
	});

	test("does not force RLS for the backend owner/admin connection", () => {
		expect(migrationSql).not.toContain("FORCE ROW LEVEL SECURITY");
	});
});
