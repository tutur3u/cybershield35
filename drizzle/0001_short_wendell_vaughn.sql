CREATE TABLE "tracked_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"normalized_url" text NOT NULL,
	"type" "source_type" NOT NULL,
	"provider" "provider_name" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_scan_job_id" uuid,
	"last_scan_status" "scan_status",
	"last_scanned_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tracked_sources" ADD CONSTRAINT "tracked_sources_last_scan_job_id_scan_jobs_id_fk" FOREIGN KEY ("last_scan_job_id") REFERENCES "public"."scan_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tracked_sources_url_unique" ON "tracked_sources" USING btree ("normalized_url");--> statement-breakpoint
CREATE INDEX "tracked_sources_active_idx" ON "tracked_sources" USING btree ("is_active","updated_at");--> statement-breakpoint
CREATE INDEX "tracked_sources_last_scan_idx" ON "tracked_sources" USING btree ("last_scan_job_id");