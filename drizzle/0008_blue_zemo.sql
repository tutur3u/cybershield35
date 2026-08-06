CREATE INDEX "audit_events_entity_created_idx" ON "audit_events" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "counter_argument_drafts_job_created_idx" ON "counter_argument_drafts" USING btree ("scan_job_id","created_at");--> statement-breakpoint
CREATE INDEX "evidence_items_job_created_idx" ON "evidence_items" USING btree ("scan_job_id","created_at");--> statement-breakpoint
CREATE INDEX "provider_runs_job_started_idx" ON "provider_runs" USING btree ("scan_job_id","started_at");--> statement-breakpoint
CREATE INDEX "scan_jobs_created_at_idx" ON "scan_jobs" USING btree ("created_at");--> statement-breakpoint
-- The seed INSERT that stood here named two real Facebook pages. Which pages a
-- unit follows is operational information about an investigation, not a
-- property of the software, and this repository may be published, so the seeds
-- moved to CYBERSHIELD35_SEED_SOURCE_URLS. Existing databases keep the rows
-- this migration already created; a fresh one starts empty and is seeded from
-- the environment.
