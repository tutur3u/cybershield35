CREATE TYPE "public"."article_publication_job_status" AS ENUM('queued', 'running', 'completed', 'retrying', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."article_publication_operation" AS ENUM('sync_hidden', 'publish', 'hide', 'update_visible');--> statement-breakpoint
CREATE TYPE "public"."article_publication_status" AS ENUM('not_synced', 'syncing', 'hidden', 'scheduled', 'publishing', 'published', 'failed');--> statement-breakpoint
CREATE TYPE "public"."article_review_status" AS ENUM('draft', 'needs_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."prompt_preset_visibility" AS ENUM('private', 'workspace');--> statement-breakpoint
CREATE TABLE "ai_prompt_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" text NOT NULL,
	"owner_display_name" text,
	"name" text NOT NULL,
	"description" text,
	"instructions" text NOT NULL,
	"tone" text,
	"voice" text,
	"visibility" "prompt_preset_visibility" DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"evidence_item_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"drive_path" text,
	"storage_provider" text,
	"source_url" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_publication_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"operation" "article_publication_operation" NOT NULL,
	"status" "article_publication_job_status" DEFAULT 'queued' NOT NULL,
	"scheduled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 4 NOT NULL,
	"locked_at" timestamp with time zone,
	"remote_operation_token" text,
	"request_fingerprint" text NOT NULL,
	"error_message" text,
	"requested_by_user_id" text NOT NULL,
	"requested_by_display_name" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"origin" text DEFAULT 'manual' NOT NULL,
	"instruction" text,
	"snapshot" jsonb NOT NULL,
	"actor_user_id" text NOT NULL,
	"actor_display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cover_url" text,
	"cover_storage_path" text,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"comments_enabled" boolean DEFAULT true NOT NULL,
	"review_status" "article_review_status" DEFAULT 'draft' NOT NULL,
	"publication_status" "article_publication_status" DEFAULT 'not_synced' NOT NULL,
	"target_oa_connection_id" uuid,
	"origin_scan_job_id" uuid,
	"origin_evidence_item_id" uuid,
	"origin_draft_id" uuid,
	"originating_chat_id" uuid,
	"remote_article_id" text,
	"remote_operation_token" text,
	"content_hash" text NOT NULL,
	"synced_content_hash" text,
	"scheduled_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"remote_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_error" text,
	"created_by_user_id" text NOT NULL,
	"created_by_display_name" text,
	"updated_by_user_id" text NOT NULL,
	"updated_by_display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zalo_oa_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"oa_id" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"access_token_expires_at" timestamp with time zone NOT NULL,
	"refresh_token_expires_at" timestamp with time zone NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"last_error" text,
	"connected_by_user_id" text NOT NULL,
	"connected_by_display_name" text,
	"updated_by_user_id" text NOT NULL,
	"updated_by_display_name" text,
	"last_refreshed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD COLUMN "temperature" integer DEFAULT 70 NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD COLUMN "context_budget" integer DEFAULT 32000 NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD COLUMN "pinned_context" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "scan_jobs" ADD COLUMN "parent_scan_job_id" uuid;--> statement-breakpoint
ALTER TABLE "scan_jobs" ADD COLUMN "requested_by_user_id" text;--> statement-breakpoint
ALTER TABLE "scan_jobs" ADD COLUMN "requested_by_display_name" text;--> statement-breakpoint
ALTER TABLE "scan_jobs" ADD COLUMN "trigger" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "article_evidence" ADD CONSTRAINT "article_evidence_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_evidence" ADD CONSTRAINT "article_evidence_evidence_item_id_evidence_items_id_fk" FOREIGN KEY ("evidence_item_id") REFERENCES "public"."evidence_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_media" ADD CONSTRAINT "article_media_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_publication_jobs" ADD CONSTRAINT "article_publication_jobs_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_versions" ADD CONSTRAINT "article_versions_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_target_oa_connection_id_zalo_oa_connections_id_fk" FOREIGN KEY ("target_oa_connection_id") REFERENCES "public"."zalo_oa_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_origin_scan_job_id_scan_jobs_id_fk" FOREIGN KEY ("origin_scan_job_id") REFERENCES "public"."scan_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_origin_evidence_item_id_evidence_items_id_fk" FOREIGN KEY ("origin_evidence_item_id") REFERENCES "public"."evidence_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_origin_draft_id_counter_argument_drafts_id_fk" FOREIGN KEY ("origin_draft_id") REFERENCES "public"."counter_argument_drafts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_originating_chat_id_chat_conversations_id_fk" FOREIGN KEY ("originating_chat_id") REFERENCES "public"."chat_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_prompt_presets_owner_updated_idx" ON "ai_prompt_presets" USING btree ("owner_user_id","updated_at");--> statement-breakpoint
CREATE INDEX "ai_prompt_presets_visibility_updated_idx" ON "ai_prompt_presets" USING btree ("visibility","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "article_evidence_unique" ON "article_evidence" USING btree ("article_id","evidence_item_id");--> statement-breakpoint
CREATE INDEX "article_evidence_evidence_idx" ON "article_evidence" USING btree ("evidence_item_id");--> statement-breakpoint
CREATE INDEX "article_media_article_created_idx" ON "article_media" USING btree ("article_id","created_at");--> statement-breakpoint
CREATE INDEX "article_publication_jobs_queue_idx" ON "article_publication_jobs" USING btree ("status","scheduled_at","locked_at");--> statement-breakpoint
CREATE INDEX "article_publication_jobs_article_idx" ON "article_publication_jobs" USING btree ("article_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "article_publication_jobs_fingerprint_unique" ON "article_publication_jobs" USING btree ("request_fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "article_versions_article_version_unique" ON "article_versions" USING btree ("article_id","version");--> statement-breakpoint
CREATE INDEX "article_versions_article_created_idx" ON "article_versions" USING btree ("article_id","created_at");--> statement-breakpoint
CREATE INDEX "articles_status_updated_idx" ON "articles" USING btree ("publication_status","updated_at");--> statement-breakpoint
CREATE INDEX "articles_review_updated_idx" ON "articles" USING btree ("review_status","updated_at");--> statement-breakpoint
CREATE INDEX "articles_oa_updated_idx" ON "articles" USING btree ("target_oa_connection_id","updated_at");--> statement-breakpoint
CREATE INDEX "articles_schedule_idx" ON "articles" USING btree ("publication_status","scheduled_at");--> statement-breakpoint
CREATE INDEX "articles_remote_idx" ON "articles" USING btree ("remote_article_id");--> statement-breakpoint
CREATE UNIQUE INDEX "zalo_oa_connections_oa_unique" ON "zalo_oa_connections" USING btree ("oa_id");--> statement-breakpoint
CREATE UNIQUE INDEX "zalo_oa_connections_default_unique" ON "zalo_oa_connections" USING btree ("is_default") WHERE "zalo_oa_connections"."is_default" = true;--> statement-breakpoint
CREATE INDEX "zalo_oa_connections_status_updated_idx" ON "zalo_oa_connections" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "scan_jobs_parent_idx" ON "scan_jobs" USING btree ("parent_scan_job_id");--> statement-breakpoint
ALTER TABLE "public"."ai_prompt_presets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."ai_prompt_presets" FROM PUBLIC;--> statement-breakpoint
COMMENT ON TABLE "public"."ai_prompt_presets" IS 'RLS enabled. CyberShield35 reads and writes this table only through the server-only backend admin database client.';--> statement-breakpoint
ALTER TABLE "public"."article_evidence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."article_evidence" FROM PUBLIC;--> statement-breakpoint
COMMENT ON TABLE "public"."article_evidence" IS 'RLS enabled. CyberShield35 reads and writes this table only through the server-only backend admin database client.';--> statement-breakpoint
ALTER TABLE "public"."article_media" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."article_media" FROM PUBLIC;--> statement-breakpoint
COMMENT ON TABLE "public"."article_media" IS 'RLS enabled. CyberShield35 reads and writes this table only through the server-only backend admin database client.';--> statement-breakpoint
ALTER TABLE "public"."article_publication_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."article_publication_jobs" FROM PUBLIC;--> statement-breakpoint
COMMENT ON TABLE "public"."article_publication_jobs" IS 'RLS enabled. CyberShield35 reads and writes this table only through the server-only backend admin database client.';--> statement-breakpoint
ALTER TABLE "public"."article_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."article_versions" FROM PUBLIC;--> statement-breakpoint
COMMENT ON TABLE "public"."article_versions" IS 'RLS enabled. CyberShield35 reads and writes this table only through the server-only backend admin database client.';--> statement-breakpoint
ALTER TABLE "public"."articles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."articles" FROM PUBLIC;--> statement-breakpoint
COMMENT ON TABLE "public"."articles" IS 'RLS enabled. CyberShield35 reads and writes this table only through the server-only backend admin database client.';--> statement-breakpoint
ALTER TABLE "public"."zalo_oa_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."zalo_oa_connections" FROM PUBLIC;--> statement-breakpoint
COMMENT ON TABLE "public"."zalo_oa_connections" IS 'RLS enabled. CyberShield35 reads and writes this table only through the server-only backend admin database client.';
