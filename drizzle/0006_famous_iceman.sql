CREATE TABLE "intelligence_activity_rollups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"severity" "risk_level" DEFAULT 'medium' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"href" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_claim_index" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_key" text NOT NULL,
	"claim" text NOT NULL,
	"stance" text DEFAULT 'neutral' NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"risk_level" "risk_level" DEFAULT 'medium' NOT NULL,
	"scan_job_id" uuid,
	"analysis_id" uuid,
	"evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_count" integer DEFAULT 0 NOT NULL,
	"topic_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deep_link" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_daily_rollups" (
	"day" date PRIMARY KEY NOT NULL,
	"scan_count" integer DEFAULT 0 NOT NULL,
	"queued_scan_count" integer DEFAULT 0 NOT NULL,
	"running_scan_count" integer DEFAULT 0 NOT NULL,
	"completed_scan_count" integer DEFAULT 0 NOT NULL,
	"failed_scan_count" integer DEFAULT 0 NOT NULL,
	"retrying_scan_count" integer DEFAULT 0 NOT NULL,
	"evidence_count" integer DEFAULT 0 NOT NULL,
	"high_risk_evidence_count" integer DEFAULT 0 NOT NULL,
	"medium_risk_evidence_count" integer DEFAULT 0 NOT NULL,
	"low_risk_evidence_count" integer DEFAULT 0 NOT NULL,
	"claim_count" integer DEFAULT 0 NOT NULL,
	"risk_flag_count" integer DEFAULT 0 NOT NULL,
	"draft_count" integer DEFAULT 0 NOT NULL,
	"approved_draft_count" integer DEFAULT 0 NOT NULL,
	"report_ready_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_provider_rollups" (
	"provider" "provider_name" PRIMARY KEY NOT NULL,
	"health" text DEFAULT 'unknown' NOT NULL,
	"scan_count" integer DEFAULT 0 NOT NULL,
	"completed_run_count" integer DEFAULT 0 NOT NULL,
	"failed_run_count" integer DEFAULT 0 NOT NULL,
	"avg_duration_ms" integer DEFAULT 0 NOT NULL,
	"last_status" "scan_status",
	"last_run_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_source_rollups" (
	"source_id" uuid PRIMARY KEY NOT NULL,
	"source_label" text NOT NULL,
	"source_type" "source_type" NOT NULL,
	"provider" "provider_name",
	"health" text DEFAULT 'unknown' NOT NULL,
	"scan_count" integer DEFAULT 0 NOT NULL,
	"completed_scan_count" integer DEFAULT 0 NOT NULL,
	"failed_scan_count" integer DEFAULT 0 NOT NULL,
	"evidence_count" integer DEFAULT 0 NOT NULL,
	"high_risk_evidence_count" integer DEFAULT 0 NOT NULL,
	"last_scan_job_id" uuid,
	"last_scanned_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_topic_rollups" (
	"topic_id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"risk_level" "risk_level" DEFAULT 'medium' NOT NULL,
	"trend" text DEFAULT 'stable' NOT NULL,
	"momentum_score" integer DEFAULT 0 NOT NULL,
	"evidence_count" integer DEFAULT 0 NOT NULL,
	"high_risk_evidence_count" integer DEFAULT 0 NOT NULL,
	"claim_count" integer DEFAULT 0 NOT NULL,
	"scan_count" integer DEFAULT 0 NOT NULL,
	"source_count" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "intelligence_claim_index" ADD CONSTRAINT "intelligence_claim_index_scan_job_id_scan_jobs_id_fk" FOREIGN KEY ("scan_job_id") REFERENCES "public"."scan_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_claim_index" ADD CONSTRAINT "intelligence_claim_index_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_source_rollups" ADD CONSTRAINT "intelligence_source_rollups_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_source_rollups" ADD CONSTRAINT "intelligence_source_rollups_last_scan_job_id_scan_jobs_id_fk" FOREIGN KEY ("last_scan_job_id") REFERENCES "public"."scan_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_topic_rollups" ADD CONSTRAINT "intelligence_topic_rollups_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "intelligence_activity_rollups_time_idx" ON "intelligence_activity_rollups" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "intelligence_activity_rollups_entity_idx" ON "intelligence_activity_rollups" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "intelligence_activity_rollups_severity_idx" ON "intelligence_activity_rollups" USING btree ("severity");--> statement-breakpoint
CREATE UNIQUE INDEX "intelligence_claim_index_key_unique" ON "intelligence_claim_index" USING btree ("claim_key");--> statement-breakpoint
CREATE INDEX "intelligence_claim_index_risk_idx" ON "intelligence_claim_index" USING btree ("risk_level","confidence");--> statement-breakpoint
CREATE INDEX "intelligence_claim_index_scan_idx" ON "intelligence_claim_index" USING btree ("scan_job_id");--> statement-breakpoint
CREATE INDEX "intelligence_daily_rollups_updated_idx" ON "intelligence_daily_rollups" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "intelligence_provider_rollups_health_idx" ON "intelligence_provider_rollups" USING btree ("health","last_run_at");--> statement-breakpoint
CREATE INDEX "intelligence_source_rollups_health_idx" ON "intelligence_source_rollups" USING btree ("health","last_scanned_at");--> statement-breakpoint
CREATE INDEX "intelligence_source_rollups_provider_idx" ON "intelligence_source_rollups" USING btree ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX "intelligence_topic_rollups_slug_unique" ON "intelligence_topic_rollups" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "intelligence_topic_rollups_priority_idx" ON "intelligence_topic_rollups" USING btree ("risk_level","momentum_score","evidence_count");--> statement-breakpoint
CREATE INDEX "intelligence_topic_rollups_last_seen_idx" ON "intelligence_topic_rollups" USING btree ("last_seen_at");