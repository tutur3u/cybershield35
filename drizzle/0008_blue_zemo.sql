CREATE INDEX "audit_events_entity_created_idx" ON "audit_events" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "counter_argument_drafts_job_created_idx" ON "counter_argument_drafts" USING btree ("scan_job_id","created_at");--> statement-breakpoint
CREATE INDEX "evidence_items_job_created_idx" ON "evidence_items" USING btree ("scan_job_id","created_at");--> statement-breakpoint
CREATE INDEX "provider_runs_job_started_idx" ON "provider_runs" USING btree ("scan_job_id","started_at");--> statement-breakpoint
CREATE INDEX "scan_jobs_created_at_idx" ON "scan_jobs" USING btree ("created_at");--> statement-breakpoint
INSERT INTO "tracked_sources" (
	"display_name",
	"normalized_url",
	"type",
	"provider",
	"is_active",
	"metadata"
)
VALUES
	(
		'example-page',
		'https://www.facebook.com/example-page',
		'facebook_page',
		'apify_facebook_posts',
		true,
		'{"label":"example-page"}'::jsonb
	),
	(
		'example-fanpage',
		'https://www.facebook.com/example-fanpage',
		'facebook_page',
		'apify_facebook_posts',
		true,
		'{"label":"example-fanpage"}'::jsonb
	)
ON CONFLICT ("normalized_url") DO UPDATE SET
	"type" = excluded."type",
	"provider" = excluded."provider",
	"is_active" = excluded."is_active",
	"metadata" = excluded."metadata",
	"updated_at" = now();
