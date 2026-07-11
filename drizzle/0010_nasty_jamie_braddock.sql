CREATE TABLE "scan_job_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_job_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"stage" text NOT NULL,
	"status" text NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scan_job_events" ADD CONSTRAINT "scan_job_events_scan_job_id_scan_jobs_id_fk" FOREIGN KEY ("scan_job_id") REFERENCES "public"."scan_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scan_job_events_job_time_idx" ON "scan_job_events" USING btree ("scan_job_id","occurred_at");--> statement-breakpoint
CREATE INDEX "scan_job_events_time_idx" ON "scan_job_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "scan_job_events_stage_status_time_idx" ON "scan_job_events" USING btree ("stage","status","occurred_at");
--> statement-breakpoint
ALTER TABLE "public"."scan_job_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "public"."scan_job_events" FROM PUBLIC;
--> statement-breakpoint
COMMENT ON TABLE "public"."scan_job_events" IS 'Append-only scan pipeline telemetry. RLS enabled; CyberShield35 accesses this table only through the server-only backend admin database client.';
