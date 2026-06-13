CREATE TYPE "public"."draft_status" AS ENUM('draft', 'needs_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."provider_name" AS ENUM('apify_facebook_posts', 'apify_facebook_comments', 'apify_facebook_groups', 'firecrawl', 'firecrawl_parse', 'browser_use', 'local_text', 'demo');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('queued', 'running', 'completed', 'failed', 'retrying');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('url', 'facebook_post', 'facebook_group', 'facebook_page', 'social', 'file', 'text');--> statement-breakpoint
CREATE TABLE "analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_job_id" uuid NOT NULL,
	"risk_level" "risk_level" DEFAULT 'medium' NOT NULL,
	"summary" text NOT NULL,
	"stance_summary" text NOT NULL,
	"topic_clusters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"claims" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"risk_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sentiment" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counter_argument_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_job_id" uuid NOT NULL,
	"status" "draft_status" DEFAULT 'draft' NOT NULL,
	"tone" text NOT NULL,
	"audience" text NOT NULL,
	"language" text DEFAULT 'vi' NOT NULL,
	"length" text DEFAULT 'medium' NOT NULL,
	"operator_notes" text,
	"body" text NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"safety_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cron_heartbeats" (
	"service_name" text PRIMARY KEY NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_job_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"provider" "provider_name" NOT NULL,
	"source_url" text,
	"source_label" text,
	"author" text,
	"published_at" timestamp with time zone,
	"quote" text NOT NULL,
	"summary" text NOT NULL,
	"engagement" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stance" text DEFAULT 'neutral' NOT NULL,
	"sentiment" text DEFAULT 'neutral' NOT NULL,
	"risk_level" "risk_level" DEFAULT 'medium' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_job_id" uuid NOT NULL,
	"provider" "provider_name" NOT NULL,
	"status" "scan_status" DEFAULT 'running' NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scan_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"status" "scan_status" DEFAULT 'queued' NOT NULL,
	"provider" "provider_name" NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"scheduled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "source_type" NOT NULL,
	"original_input" text NOT NULL,
	"normalized_url" text,
	"title" text,
	"mime_type" text,
	"file_name" text,
	"file_text" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_scan_job_id_scan_jobs_id_fk" FOREIGN KEY ("scan_job_id") REFERENCES "public"."scan_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counter_argument_drafts" ADD CONSTRAINT "counter_argument_drafts_scan_job_id_scan_jobs_id_fk" FOREIGN KEY ("scan_job_id") REFERENCES "public"."scan_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_scan_job_id_scan_jobs_id_fk" FOREIGN KEY ("scan_job_id") REFERENCES "public"."scan_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_runs" ADD CONSTRAINT "provider_runs_scan_job_id_scan_jobs_id_fk" FOREIGN KEY ("scan_job_id") REFERENCES "public"."scan_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "analyses_job_unique" ON "analyses" USING btree ("scan_job_id");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "counter_argument_drafts_job_idx" ON "counter_argument_drafts" USING btree ("scan_job_id");--> statement-breakpoint
CREATE INDEX "evidence_items_job_idx" ON "evidence_items" USING btree ("scan_job_id");--> statement-breakpoint
CREATE INDEX "evidence_items_source_idx" ON "evidence_items" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "provider_runs_job_idx" ON "provider_runs" USING btree ("scan_job_id");--> statement-breakpoint
CREATE INDEX "scan_jobs_queue_idx" ON "scan_jobs" USING btree ("status","scheduled_at","priority");--> statement-breakpoint
CREATE INDEX "scan_jobs_source_idx" ON "scan_jobs" USING btree ("source_id");