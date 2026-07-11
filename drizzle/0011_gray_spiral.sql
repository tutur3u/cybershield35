CREATE TYPE "public"."chat_attachment_status" AS ENUM('pending_upload', 'uploading', 'processing', 'ready', 'failed', 'deleting', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."chat_run_status" AS ENUM('running', 'completed', 'failed', 'aborted');--> statement-breakpoint
CREATE TYPE "public"."chat_visibility" AS ENUM('private', 'workspace');--> statement-breakpoint
CREATE TYPE "public"."draft_kind" AS ENUM('response', 'comment', 'counter_argument', 'internal_brief');--> statement-breakpoint
CREATE TABLE "chat_attachment_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attachment_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message_id" uuid,
	"drive_path" text,
	"drive_full_path" text,
	"storage_provider" text,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"status" "chat_attachment_status" DEFAULT 'pending_upload' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"scheduled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"delete_requested_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"error_message" text,
	"extraction_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" text NOT NULL,
	"owner_display_name" text,
	"title" text DEFAULT 'Cuộc trò chuyện mới' NOT NULL,
	"visibility" "chat_visibility" DEFAULT 'private' NOT NULL,
	"forked_from_id" uuid,
	"shared_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"parts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actor_user_id" text,
	"actor_display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_model_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_message_id" uuid,
	"assistant_message_id" uuid,
	"actor_user_id" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"status" "chat_run_status" DEFAULT 'running' NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"time_to_first_token_ms" integer,
	"latency_ms" integer,
	"step_count" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "chat_tool_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_run_id" uuid NOT NULL,
	"tool_call_id" text NOT NULL,
	"tool_name" text NOT NULL,
	"status" text NOT NULL,
	"input_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "counter_argument_draft_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"body" text NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"safety_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actor_user_id" text NOT NULL,
	"actor_display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "counter_argument_drafts" ADD COLUMN "draft_kind" "draft_kind" DEFAULT 'counter_argument' NOT NULL;--> statement-breakpoint
ALTER TABLE "counter_argument_drafts" ADD COLUMN "evidence_item_id" uuid;--> statement-breakpoint
ALTER TABLE "counter_argument_drafts" ADD COLUMN "originating_chat_id" uuid;--> statement-breakpoint
ALTER TABLE "counter_argument_drafts" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "counter_argument_drafts" ADD COLUMN "created_by_display_name" text;--> statement-breakpoint
ALTER TABLE "counter_argument_drafts" ADD COLUMN "updated_by_user_id" text;--> statement-breakpoint
ALTER TABLE "counter_argument_drafts" ADD COLUMN "updated_by_display_name" text;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_forked_from_id_chat_conversations_id_fk" FOREIGN KEY ("forked_from_id") REFERENCES "public"."chat_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_attachment_chunks" ADD CONSTRAINT "chat_attachment_chunks_attachment_id_chat_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."chat_attachments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_model_runs" ADD CONSTRAINT "chat_model_runs_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_model_runs" ADD CONSTRAINT "chat_model_runs_user_message_id_chat_messages_id_fk" FOREIGN KEY ("user_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_model_runs" ADD CONSTRAINT "chat_model_runs_assistant_message_id_chat_messages_id_fk" FOREIGN KEY ("assistant_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_tool_runs" ADD CONSTRAINT "chat_tool_runs_model_run_id_chat_model_runs_id_fk" FOREIGN KEY ("model_run_id") REFERENCES "public"."chat_model_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counter_argument_draft_versions" ADD CONSTRAINT "counter_argument_draft_versions_draft_id_counter_argument_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."counter_argument_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_attachment_chunks_attachment_ordinal_idx" ON "chat_attachment_chunks" USING btree ("attachment_id","ordinal");--> statement-breakpoint
CREATE INDEX "chat_attachment_chunks_search_idx" ON "chat_attachment_chunks" USING gin (to_tsvector('simple', "content"));--> statement-breakpoint
CREATE INDEX "chat_attachments_conversation_created_idx" ON "chat_attachments" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_attachments_queue_claim_idx" ON "chat_attachments" USING btree ("status","scheduled_at","locked_at");--> statement-breakpoint
CREATE INDEX "chat_attachments_cleanup_idx" ON "chat_attachments" USING btree ("status","delete_requested_at");--> statement-breakpoint
CREATE INDEX "chat_conversations_owner_recency_idx" ON "chat_conversations" USING btree ("owner_user_id","archived_at","updated_at");--> statement-breakpoint
CREATE INDEX "chat_conversations_visibility_recency_idx" ON "chat_conversations" USING btree ("visibility","deleted_at","updated_at");--> statement-breakpoint
CREATE INDEX "chat_conversations_fork_idx" ON "chat_conversations" USING btree ("forked_from_id");--> statement-breakpoint
CREATE INDEX "chat_messages_conversation_created_idx" ON "chat_messages" USING btree ("conversation_id","created_at","id");--> statement-breakpoint
CREATE INDEX "chat_model_runs_conversation_started_idx" ON "chat_model_runs" USING btree ("conversation_id","started_at");--> statement-breakpoint
CREATE INDEX "chat_model_runs_status_started_idx" ON "chat_model_runs" USING btree ("status","started_at");--> statement-breakpoint
CREATE INDEX "chat_model_runs_provider_model_started_idx" ON "chat_model_runs" USING btree ("provider","model","started_at");--> statement-breakpoint
CREATE INDEX "chat_tool_runs_model_started_idx" ON "chat_tool_runs" USING btree ("model_run_id","started_at");--> statement-breakpoint
CREATE INDEX "chat_tool_runs_tool_status_started_idx" ON "chat_tool_runs" USING btree ("tool_name","status","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "counter_argument_draft_versions_draft_version_idx" ON "counter_argument_draft_versions" USING btree ("draft_id","version");--> statement-breakpoint
CREATE INDEX "counter_argument_draft_versions_draft_created_idx" ON "counter_argument_draft_versions" USING btree ("draft_id","created_at");--> statement-breakpoint
ALTER TABLE "counter_argument_drafts" ADD CONSTRAINT "counter_argument_drafts_evidence_item_id_evidence_items_id_fk" FOREIGN KEY ("evidence_item_id") REFERENCES "public"."evidence_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counter_argument_drafts" ADD CONSTRAINT "counter_argument_drafts_originating_chat_id_chat_conversations_id_fk" FOREIGN KEY ("originating_chat_id") REFERENCES "public"."chat_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "counter_argument_drafts_status_kind_created_idx" ON "counter_argument_drafts" USING btree ("status","draft_kind","created_at");--> statement-breakpoint
CREATE INDEX "counter_argument_drafts_evidence_created_idx" ON "counter_argument_drafts" USING btree ("evidence_item_id","created_at");--> statement-breakpoint
CREATE INDEX "counter_argument_drafts_chat_created_idx" ON "counter_argument_drafts" USING btree ("originating_chat_id","created_at");
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_role_check" CHECK ("role" IN ('user', 'assistant', 'system'));--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_size_check" CHECK ("size_bytes" > 0 AND "size_bytes" <= 26214400);--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_attempts_check" CHECK ("attempts" >= 0 AND "max_attempts" BETWEEN 1 AND 10);--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_provider_check" CHECK ("storage_provider" IS NULL OR "storage_provider" IN ('r2', 'supabase'));--> statement-breakpoint
ALTER TABLE "chat_model_runs" ADD CONSTRAINT "chat_model_runs_usage_check" CHECK (
	("input_tokens" IS NULL OR "input_tokens" >= 0) AND
	("output_tokens" IS NULL OR "output_tokens" >= 0) AND
	("total_tokens" IS NULL OR "total_tokens" >= 0) AND
	("time_to_first_token_ms" IS NULL OR "time_to_first_token_ms" >= 0) AND
	("latency_ms" IS NULL OR "latency_ms" >= 0) AND
	"step_count" >= 0
);--> statement-breakpoint
CREATE UNIQUE INDEX "chat_tool_runs_model_call_idx" ON "chat_tool_runs" USING btree ("model_run_id", "tool_call_id");--> statement-breakpoint
INSERT INTO "counter_argument_draft_versions" (
	"draft_id",
	"version",
	"body",
	"citations",
	"safety_notes",
	"actor_user_id",
	"actor_display_name",
	"created_at"
)
SELECT
	"id",
	1,
	"body",
	"citations",
	"safety_notes",
	COALESCE("created_by_user_id", 'migration'),
	"created_by_display_name",
	"created_at"
FROM "counter_argument_drafts";--> statement-breakpoint
ALTER TABLE "public"."chat_conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."chat_attachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."chat_attachment_chunks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."chat_model_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."chat_tool_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."counter_argument_draft_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."chat_conversations" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."chat_messages" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."chat_attachments" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."chat_attachment_chunks" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."chat_model_runs" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."chat_tool_runs" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."counter_argument_draft_versions" FROM PUBLIC;--> statement-breakpoint
COMMENT ON TABLE "chat_conversations" IS 'RLS enabled. Private and workspace-shared CyberShield35 chats are authorized by server-only application routes.';--> statement-breakpoint
COMMENT ON TABLE "chat_messages" IS 'RLS enabled. Stores validated AI SDK UIMessage parts through the server-only backend.';--> statement-breakpoint
COMMENT ON TABLE "chat_attachments" IS 'RLS enabled. Stores Tuturuuu Drive metadata and processing state, never signed URLs or file contents.';--> statement-breakpoint
COMMENT ON TABLE "chat_attachment_chunks" IS 'RLS enabled. Stores bounded extracted attachment text for internal retrieval.';--> statement-breakpoint
COMMENT ON TABLE "chat_model_runs" IS 'RLS enabled. Stores provider, model, usage, latency, and terminal run status without prompt bodies.';--> statement-breakpoint
COMMENT ON TABLE "chat_tool_runs" IS 'RLS enabled. Stores sanitized tool execution observability without note or file bodies.';--> statement-breakpoint
COMMENT ON TABLE "counter_argument_draft_versions" IS 'RLS enabled. Append-only immutable snapshots of internal human-reviewed drafts.';
