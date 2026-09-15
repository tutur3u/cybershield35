-- Staging schema only: application queries still require a native D1 port.

CREATE TABLE "ai_prompt_presets" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "owner_user_id" TEXT NOT NULL,
  "owner_display_name" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "instructions" TEXT NOT NULL,
  "tone" TEXT,
  "voice" TEXT,
  "visibility" TEXT NOT NULL CHECK ("visibility" IN ('private', 'workspace')) DEFAULT 'private',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "analyses" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "scan_job_id" TEXT NOT NULL,
  "risk_level" TEXT NOT NULL CHECK ("risk_level" IN ('low', 'medium', 'high')) DEFAULT 'medium',
  "summary" TEXT NOT NULL,
  "stance_summary" TEXT NOT NULL,
  "topic_clusters" TEXT NOT NULL CHECK (json_valid("topic_clusters")) DEFAULT '[]',
  "claims" TEXT NOT NULL CHECK (json_valid("claims")) DEFAULT '[]',
  "risk_flags" TEXT NOT NULL CHECK (json_valid("risk_flags")) DEFAULT '[]',
  "sentiment" TEXT NOT NULL CHECK (json_valid("sentiment")) DEFAULT '{}',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("scan_job_id") REFERENCES "scan_jobs" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "article_evidence" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "article_id" TEXT NOT NULL,
  "evidence_item_id" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("article_id") REFERENCES "articles" ("id") ON DELETE cascade ON UPDATE no action,
  FOREIGN KEY ("evidence_item_id") REFERENCES "evidence_items" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "article_media" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "article_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "drive_path" TEXT,
  "storage_provider" TEXT,
  "source_url" TEXT,
  "cms_asset_id" TEXT,
  "cms_entry_id" TEXT,
  "storage_path" TEXT,
  "delivery_url" TEXT,
  "alt_text" TEXT,
  "caption" TEXT,
  "created_by_user_id" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("article_id") REFERENCES "articles" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "article_publication_jobs" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "article_id" TEXT NOT NULL,
  "operation" TEXT NOT NULL CHECK ("operation" IN ('sync_hidden', 'publish', 'hide', 'update_visible')),
  "status" TEXT NOT NULL CHECK ("status" IN ('queued', 'running', 'completed', 'retrying', 'failed', 'cancelled')) DEFAULT 'queued',
  "scheduled_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 4,
  "locked_at" TEXT,
  "remote_operation_token" TEXT,
  "request_fingerprint" TEXT NOT NULL,
  "error_message" TEXT,
  "requested_by_user_id" TEXT NOT NULL,
  "requested_by_display_name" TEXT,
  "completed_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("article_id") REFERENCES "articles" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "article_versions" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "article_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "origin" TEXT NOT NULL DEFAULT 'manual',
  "instruction" TEXT,
  "snapshot" TEXT NOT NULL CHECK (json_valid("snapshot")),
  "actor_user_id" TEXT NOT NULL,
  "actor_display_name" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("article_id") REFERENCES "articles" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "articles" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "title" TEXT NOT NULL DEFAULT '',
  "author" TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL DEFAULT '',
  "cover_url" TEXT,
  "cover_storage_path" TEXT,
  "blocks" TEXT NOT NULL CHECK (json_valid("blocks")) DEFAULT '[]',
  "comments_enabled" INTEGER NOT NULL CHECK ("comments_enabled" IN (0, 1)) DEFAULT 1,
  "review_status" TEXT NOT NULL CHECK ("review_status" IN ('draft', 'needs_review', 'approved', 'rejected')) DEFAULT 'draft',
  "state" TEXT NOT NULL CHECK ("state" IN ('draft', 'published', 'archived')) DEFAULT 'draft',
  "draft_kind" TEXT CHECK ("draft_kind" IN ('response', 'comment', 'counter_argument', 'internal_brief')),
  "generation_reason" TEXT,
  "tone" TEXT,
  "voice" TEXT,
  "audience" TEXT,
  "language" TEXT NOT NULL DEFAULT 'vi',
  "operator_notes" TEXT,
  "citations" TEXT NOT NULL CHECK (json_valid("citations")) DEFAULT '[]',
  "safety_notes" TEXT NOT NULL CHECK (json_valid("safety_notes")) DEFAULT '[]',
  "automation_key" TEXT,
  "cms_entry_id" TEXT,
  "publication_status" TEXT NOT NULL CHECK ("publication_status" IN ('not_synced', 'syncing', 'hidden', 'scheduled', 'publishing', 'published', 'failed')) DEFAULT 'not_synced',
  "target_oa_connection_id" TEXT,
  "origin_scan_job_id" TEXT,
  "origin_evidence_item_id" TEXT,
  "origin_draft_id" TEXT,
  "originating_chat_id" TEXT,
  "remote_article_id" TEXT,
  "remote_operation_token" TEXT,
  "content_hash" TEXT NOT NULL,
  "synced_content_hash" TEXT,
  "scheduled_at" TEXT,
  "last_synced_at" TEXT,
  "published_at" TEXT,
  "remote_snapshot" TEXT NOT NULL CHECK (json_valid("remote_snapshot")) DEFAULT '{}',
  "last_error" TEXT,
  "created_by_user_id" TEXT NOT NULL,
  "created_by_display_name" TEXT,
  "updated_by_user_id" TEXT NOT NULL,
  "updated_by_display_name" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("target_oa_connection_id") REFERENCES "zalo_oa_connections" ("id") ON DELETE set null ON UPDATE no action,
  FOREIGN KEY ("origin_scan_job_id") REFERENCES "scan_jobs" ("id") ON DELETE set null ON UPDATE no action,
  FOREIGN KEY ("origin_evidence_item_id") REFERENCES "evidence_items" ("id") ON DELETE set null ON UPDATE no action,
  FOREIGN KEY ("origin_draft_id") REFERENCES "counter_argument_drafts" ("id") ON DELETE set null ON UPDATE no action,
  FOREIGN KEY ("originating_chat_id") REFERENCES "chat_conversations" ("id") ON DELETE set null ON UPDATE no action
);

CREATE TABLE "audit_events" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "payload" TEXT NOT NULL CHECK (json_valid("payload")) DEFAULT '{}',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "chat_attachment_chunks" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "attachment_id" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" TEXT NOT NULL CHECK (json_valid("metadata")) DEFAULT '{}',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("attachment_id") REFERENCES "chat_attachments" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "chat_attachments" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "message_id" TEXT,
  "drive_path" TEXT,
  "drive_full_path" TEXT,
  "storage_provider" TEXT,
  "file_name" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('pending_upload', 'uploading', 'processing', 'ready', 'failed', 'deleting', 'deleted')) DEFAULT 'pending_upload',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 3,
  "scheduled_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "locked_at" TEXT,
  "processed_at" TEXT,
  "delete_requested_at" TEXT,
  "deleted_at" TEXT,
  "error_message" TEXT,
  "extraction_metadata" TEXT NOT NULL CHECK (json_valid("extraction_metadata")) DEFAULT '{}',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations" ("id") ON DELETE cascade ON UPDATE no action,
  FOREIGN KEY ("message_id") REFERENCES "chat_messages" ("id") ON DELETE set null ON UPDATE no action
);

CREATE TABLE "chat_conversations" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "owner_user_id" TEXT NOT NULL,
  "owner_display_name" TEXT,
  "title" TEXT NOT NULL DEFAULT 'Cuộc trò chuyện mới',
  "visibility" TEXT NOT NULL CHECK ("visibility" IN ('private', 'workspace')) DEFAULT 'private',
  "forked_from_id" TEXT,
  "shared_at" TEXT,
  "archived_at" TEXT,
  "deleted_at" TEXT,
  "last_message_at" TEXT,
  "model" TEXT,
  "temperature" INTEGER NOT NULL DEFAULT 70,
  "context_budget" INTEGER NOT NULL DEFAULT 32000,
  "pinned_context" TEXT NOT NULL CHECK (json_valid("pinned_context")) DEFAULT '[]',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "chat_messages" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "parts" TEXT NOT NULL CHECK (json_valid("parts")) DEFAULT '[]',
  "metadata" TEXT NOT NULL CHECK (json_valid("metadata")) DEFAULT '{}',
  "actor_user_id" TEXT,
  "actor_display_name" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "chat_model_runs" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "user_message_id" TEXT,
  "assistant_message_id" TEXT,
  "actor_user_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('running', 'completed', 'failed', 'aborted')) DEFAULT 'running',
  "input_tokens" INTEGER,
  "output_tokens" INTEGER,
  "total_tokens" INTEGER,
  "time_to_first_token_ms" INTEGER,
  "latency_ms" INTEGER,
  "step_count" INTEGER NOT NULL DEFAULT 0,
  "error_code" TEXT,
  "error_message" TEXT,
  "started_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "completed_at" TEXT,
  FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations" ("id") ON DELETE cascade ON UPDATE no action,
  FOREIGN KEY ("user_message_id") REFERENCES "chat_messages" ("id") ON DELETE set null ON UPDATE no action,
  FOREIGN KEY ("assistant_message_id") REFERENCES "chat_messages" ("id") ON DELETE set null ON UPDATE no action
);

CREATE TABLE "chat_tool_runs" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "model_run_id" TEXT NOT NULL,
  "tool_call_id" TEXT NOT NULL,
  "tool_name" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "input_summary" TEXT NOT NULL CHECK (json_valid("input_summary")) DEFAULT '{}',
  "output_summary" TEXT NOT NULL CHECK (json_valid("output_summary")) DEFAULT '{}',
  "error_message" TEXT,
  "started_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "completed_at" TEXT,
  FOREIGN KEY ("model_run_id") REFERENCES "chat_model_runs" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "counter_argument_draft_versions" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "draft_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "body" TEXT NOT NULL,
  "citations" TEXT NOT NULL CHECK (json_valid("citations")) DEFAULT '[]',
  "safety_notes" TEXT NOT NULL CHECK (json_valid("safety_notes")) DEFAULT '[]',
  "actor_user_id" TEXT NOT NULL,
  "actor_display_name" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("draft_id") REFERENCES "counter_argument_drafts" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "counter_argument_drafts" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "scan_job_id" TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('draft', 'needs_review', 'approved', 'rejected')) DEFAULT 'draft',
  "draft_kind" TEXT NOT NULL CHECK ("draft_kind" IN ('response', 'comment', 'counter_argument', 'internal_brief')) DEFAULT 'counter_argument',
  "evidence_item_id" TEXT,
  "originating_chat_id" TEXT,
  "created_by_user_id" TEXT,
  "created_by_display_name" TEXT,
  "updated_by_user_id" TEXT,
  "updated_by_display_name" TEXT,
  "automation_key" TEXT,
  "generation_reason" TEXT,
  "tone" TEXT NOT NULL,
  "voice" TEXT NOT NULL DEFAULT 'Tự nhiên, gần gũi',
  "audience" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'vi',
  "length" TEXT NOT NULL DEFAULT 'medium',
  "operator_notes" TEXT,
  "body" TEXT NOT NULL,
  "citations" TEXT NOT NULL CHECK (json_valid("citations")) DEFAULT '[]',
  "safety_notes" TEXT NOT NULL CHECK (json_valid("safety_notes")) DEFAULT '[]',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("scan_job_id") REFERENCES "scan_jobs" ("id") ON DELETE cascade ON UPDATE no action,
  FOREIGN KEY ("evidence_item_id") REFERENCES "evidence_items" ("id") ON DELETE set null ON UPDATE no action,
  FOREIGN KEY ("originating_chat_id") REFERENCES "chat_conversations" ("id") ON DELETE set null ON UPDATE no action
);

CREATE TABLE "cron_heartbeats" (
  "service_name" TEXT PRIMARY KEY NOT NULL,
  "last_seen_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "metadata" TEXT NOT NULL CHECK (json_valid("metadata")) DEFAULT '{}'
);

CREATE TABLE "draft_automation_jobs" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "evidence_item_id" TEXT NOT NULL,
  "page_key" TEXT NOT NULL,
  "classification" TEXT NOT NULL CHECK ("classification" IN ('uncategorized', 'trusted', 'neutral', 'at_risk')),
  "draft_kind" TEXT NOT NULL CHECK ("draft_kind" IN ('response', 'comment', 'counter_argument', 'internal_brief')),
  "status" TEXT NOT NULL CHECK ("status" IN ('queued', 'running', 'completed', 'failed', 'retrying', 'skipped')) DEFAULT 'queued',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 3,
  "scheduled_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "locked_at" TEXT,
  "draft_id" TEXT,
  "error_message" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "completed_at" TEXT,
  FOREIGN KEY ("evidence_item_id") REFERENCES "evidence_items" ("id") ON DELETE cascade ON UPDATE no action,
  FOREIGN KEY ("page_key") REFERENCES "facebook_page_profiles" ("page_key") ON DELETE cascade ON UPDATE no action,
  FOREIGN KEY ("draft_id") REFERENCES "counter_argument_drafts" ("id") ON DELETE set null ON UPDATE no action
);

CREATE TABLE "evidence_items" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "scan_job_id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL CHECK ("provider" IN ('apify_facebook_posts', 'apify_facebook_comments', 'apify_facebook_groups', 'firecrawl', 'firecrawl_parse', 'browser_use', 'local_text')),
  "source_url" TEXT,
  "source_label" TEXT,
  "author" TEXT,
  "published_at" TEXT,
  "quote" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "engagement" TEXT NOT NULL CHECK (json_valid("engagement")) DEFAULT '{}',
  "stance" TEXT NOT NULL DEFAULT 'neutral',
  "sentiment" TEXT NOT NULL DEFAULT 'neutral',
  "risk_level" TEXT NOT NULL CHECK ("risk_level" IN ('low', 'medium', 'high')) DEFAULT 'medium',
  "metadata" TEXT NOT NULL CHECK (json_valid("metadata")) DEFAULT '{}',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("scan_job_id") REFERENCES "scan_jobs" ("id") ON DELETE cascade ON UPDATE no action,
  FOREIGN KEY ("source_id") REFERENCES "sources" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "evidence_semantic_profiles" (
  "evidence_item_id" TEXT PRIMARY KEY NOT NULL,
  "content_hash" TEXT NOT NULL,
  "embedding" TEXT NOT NULL CHECK (json_valid("embedding")),
  "model" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("evidence_item_id") REFERENCES "evidence_items" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "evidence_topics" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "evidence_item_id" TEXT NOT NULL,
  "topic_id" TEXT NOT NULL,
  "scan_job_id" TEXT NOT NULL,
  "confidence" INTEGER NOT NULL DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("evidence_item_id") REFERENCES "evidence_items" ("id") ON DELETE cascade ON UPDATE no action,
  FOREIGN KEY ("topic_id") REFERENCES "topics" ("id") ON DELETE cascade ON UPDATE no action,
  FOREIGN KEY ("scan_job_id") REFERENCES "scan_jobs" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "evidence_triage" (
  "evidence_item_id" TEXT PRIMARY KEY NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('new', 'reviewing', 'action_required', 'resolved', 'dismissed')) DEFAULT 'new',
  "is_pinned" INTEGER NOT NULL CHECK ("is_pinned" IN (0, 1)) DEFAULT 0,
  "assignee_user_id" TEXT,
  "assignee_display_name" TEXT,
  "due_at" TEXT,
  "updated_by_user_id" TEXT NOT NULL,
  "updated_by_display_name" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("evidence_item_id") REFERENCES "evidence_items" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "evidence_triage_notes" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "evidence_item_id" TEXT NOT NULL,
  "author_user_id" TEXT NOT NULL,
  "author_display_name" TEXT,
  "body" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("evidence_item_id") REFERENCES "evidence_items" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "facebook_page_profiles" (
  "page_key" TEXT PRIMARY KEY NOT NULL,
  "facebook_page_id" TEXT,
  "username" TEXT,
  "display_name" TEXT NOT NULL,
  "classification" TEXT NOT NULL CHECK ("classification" IN ('uncategorized', 'trusted', 'neutral', 'at_risk')) DEFAULT 'uncategorized',
  "auto_draft_enabled" INTEGER NOT NULL CHECK ("auto_draft_enabled" IN (0, 1)) DEFAULT 0,
  "updated_by_user_id" TEXT NOT NULL,
  "updated_by_display_name" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "intelligence_activity_rollups" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "severity" TEXT NOT NULL CHECK ("severity" IN ('low', 'medium', 'high')) DEFAULT 'medium',
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  "occurred_at" TEXT NOT NULL,
  "metadata" TEXT NOT NULL CHECK (json_valid("metadata")) DEFAULT '{}',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "intelligence_claim_index" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "claim_key" TEXT NOT NULL,
  "claim" TEXT NOT NULL,
  "stance" TEXT NOT NULL DEFAULT 'neutral',
  "confidence" INTEGER NOT NULL DEFAULT 0,
  "risk_level" TEXT NOT NULL CHECK ("risk_level" IN ('low', 'medium', 'high')) DEFAULT 'medium',
  "scan_job_id" TEXT,
  "analysis_id" TEXT,
  "evidence_ids" TEXT NOT NULL CHECK (json_valid("evidence_ids")) DEFAULT '[]',
  "evidence_count" INTEGER NOT NULL DEFAULT 0,
  "topic_slugs" TEXT NOT NULL CHECK (json_valid("topic_slugs")) DEFAULT '[]',
  "source_labels" TEXT NOT NULL CHECK (json_valid("source_labels")) DEFAULT '[]',
  "deep_link" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("scan_job_id") REFERENCES "scan_jobs" ("id") ON DELETE cascade ON UPDATE no action,
  FOREIGN KEY ("analysis_id") REFERENCES "analyses" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "intelligence_daily_rollups" (
  "day" TEXT PRIMARY KEY NOT NULL,
  "scan_count" INTEGER NOT NULL DEFAULT 0,
  "queued_scan_count" INTEGER NOT NULL DEFAULT 0,
  "running_scan_count" INTEGER NOT NULL DEFAULT 0,
  "completed_scan_count" INTEGER NOT NULL DEFAULT 0,
  "failed_scan_count" INTEGER NOT NULL DEFAULT 0,
  "retrying_scan_count" INTEGER NOT NULL DEFAULT 0,
  "evidence_count" INTEGER NOT NULL DEFAULT 0,
  "high_risk_evidence_count" INTEGER NOT NULL DEFAULT 0,
  "medium_risk_evidence_count" INTEGER NOT NULL DEFAULT 0,
  "low_risk_evidence_count" INTEGER NOT NULL DEFAULT 0,
  "claim_count" INTEGER NOT NULL DEFAULT 0,
  "risk_flag_count" INTEGER NOT NULL DEFAULT 0,
  "draft_count" INTEGER NOT NULL DEFAULT 0,
  "approved_draft_count" INTEGER NOT NULL DEFAULT 0,
  "report_ready_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "intelligence_provider_rollups" (
  "provider" TEXT PRIMARY KEY NOT NULL CHECK ("provider" IN ('apify_facebook_posts', 'apify_facebook_comments', 'apify_facebook_groups', 'firecrawl', 'firecrawl_parse', 'browser_use', 'local_text')),
  "health" TEXT NOT NULL DEFAULT 'unknown',
  "scan_count" INTEGER NOT NULL DEFAULT 0,
  "completed_run_count" INTEGER NOT NULL DEFAULT 0,
  "failed_run_count" INTEGER NOT NULL DEFAULT 0,
  "avg_duration_ms" INTEGER NOT NULL DEFAULT 0,
  "last_status" TEXT CHECK ("last_status" IN ('queued', 'running', 'completed', 'failed', 'retrying')),
  "last_run_at" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "intelligence_source_rollups" (
  "source_id" TEXT PRIMARY KEY NOT NULL,
  "source_label" TEXT NOT NULL,
  "source_type" TEXT NOT NULL CHECK ("source_type" IN ('url', 'facebook_post', 'facebook_group', 'facebook_page', 'social', 'file', 'text')),
  "provider" TEXT CHECK ("provider" IN ('apify_facebook_posts', 'apify_facebook_comments', 'apify_facebook_groups', 'firecrawl', 'firecrawl_parse', 'browser_use', 'local_text')),
  "health" TEXT NOT NULL DEFAULT 'unknown',
  "scan_count" INTEGER NOT NULL DEFAULT 0,
  "completed_scan_count" INTEGER NOT NULL DEFAULT 0,
  "failed_scan_count" INTEGER NOT NULL DEFAULT 0,
  "evidence_count" INTEGER NOT NULL DEFAULT 0,
  "high_risk_evidence_count" INTEGER NOT NULL DEFAULT 0,
  "last_scan_job_id" TEXT,
  "last_scanned_at" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("source_id") REFERENCES "sources" ("id") ON DELETE cascade ON UPDATE no action,
  FOREIGN KEY ("last_scan_job_id") REFERENCES "scan_jobs" ("id") ON DELETE set null ON UPDATE no action
);

CREATE TABLE "intelligence_summaries" (
  "time_range" TEXT PRIMARY KEY NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "payload" TEXT NOT NULL CHECK (json_valid("payload")),
  "model" TEXT,
  "generated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "intelligence_topic_rollups" (
  "topic_id" TEXT PRIMARY KEY NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "risk_level" TEXT NOT NULL CHECK ("risk_level" IN ('low', 'medium', 'high')) DEFAULT 'medium',
  "trend" TEXT NOT NULL DEFAULT 'stable',
  "momentum_score" INTEGER NOT NULL DEFAULT 0,
  "evidence_count" INTEGER NOT NULL DEFAULT 0,
  "high_risk_evidence_count" INTEGER NOT NULL DEFAULT 0,
  "claim_count" INTEGER NOT NULL DEFAULT 0,
  "scan_count" INTEGER NOT NULL DEFAULT 0,
  "source_count" INTEGER NOT NULL DEFAULT 0,
  "first_seen_at" TEXT,
  "last_seen_at" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("topic_id") REFERENCES "topics" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "local_account_sessions" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "account_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "user_agent" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "last_seen_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "expires_at" TEXT NOT NULL,
  "revoked_at" TEXT,
  FOREIGN KEY ("account_id") REFERENCES "local_accounts" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "local_accounts" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "username" TEXT NOT NULL,
  "display_name" TEXT,
  "password_hash" TEXT NOT NULL,
  "role" TEXT NOT NULL CHECK ("role" IN ('admin', 'member')) DEFAULT 'member',
  "disabled" INTEGER NOT NULL CHECK ("disabled" IN (0, 1)) DEFAULT 0,
  "must_change_password" INTEGER NOT NULL CHECK ("must_change_password" IN (0, 1)) DEFAULT 0,
  "failed_attempts" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TEXT,
  "last_login_at" TEXT,
  "password_updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by_user_id" TEXT,
  "created_by_display_name" TEXT,
  "updated_by_user_id" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "managed_scheduler_integrations" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'managed-scheduler',
  "token_hash" TEXT NOT NULL,
  "token_last_four" TEXT NOT NULL,
  "enabled" INTEGER NOT NULL CHECK ("enabled" IN (0, 1)) DEFAULT 1,
  "setup_metadata" TEXT NOT NULL CHECK (json_valid("setup_metadata")) DEFAULT '{}',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "provider_account_costs" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "provider" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "amount_usd" TEXT NOT NULL,
  "observed_at" TEXT NOT NULL,
  "synced_at" TEXT,
  "synced_workspace_id" TEXT
);

CREATE TABLE "provider_runs" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "scan_job_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL CHECK ("provider" IN ('apify_facebook_posts', 'apify_facebook_comments', 'apify_facebook_groups', 'firecrawl', 'firecrawl_parse', 'browser_use', 'local_text')),
  "status" TEXT NOT NULL CHECK ("status" IN ('queued', 'running', 'completed', 'failed', 'retrying')) DEFAULT 'running',
  "input" TEXT NOT NULL CHECK (json_valid("input")) DEFAULT '{}',
  "output" TEXT NOT NULL CHECK (json_valid("output")) DEFAULT '{}',
  "error_message" TEXT,
  "started_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "completed_at" TEXT,
  FOREIGN KEY ("scan_job_id") REFERENCES "scan_jobs" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "scan_job_events" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "scan_job_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" TEXT NOT NULL CHECK (json_valid("metadata")) DEFAULT '{}',
  "occurred_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("scan_job_id") REFERENCES "scan_jobs" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "scan_jobs" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "source_id" TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('queued', 'running', 'completed', 'failed', 'retrying')) DEFAULT 'queued',
  "provider" TEXT NOT NULL CHECK ("provider" IN ('apify_facebook_posts', 'apify_facebook_comments', 'apify_facebook_groups', 'firecrawl', 'firecrawl_parse', 'browser_use', 'local_text')),
  "priority" INTEGER NOT NULL DEFAULT 0,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 3,
  "scheduled_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "started_at" TEXT,
  "completed_at" TEXT,
  "locked_at" TEXT,
  "error_message" TEXT,
  "client_request_id" TEXT,
  "parent_scan_job_id" TEXT,
  "requested_by_user_id" TEXT,
  "requested_by_display_name" TEXT,
  "trigger" TEXT NOT NULL DEFAULT 'manual',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("source_id") REFERENCES "sources" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "sources" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "type" TEXT NOT NULL CHECK ("type" IN ('url', 'facebook_post', 'facebook_group', 'facebook_page', 'social', 'file', 'text')),
  "original_input" TEXT NOT NULL,
  "normalized_url" TEXT,
  "title" TEXT,
  "mime_type" TEXT,
  "file_name" TEXT,
  "file_text" TEXT,
  "metadata" TEXT NOT NULL CHECK (json_valid("metadata")) DEFAULT '{}',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "topics" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "risk_level" TEXT NOT NULL CHECK ("risk_level" IN ('low', 'medium', 'high')) DEFAULT 'medium',
  "trend" TEXT NOT NULL DEFAULT 'stable',
  "evidence_count" INTEGER NOT NULL DEFAULT 0,
  "first_seen_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "last_seen_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "tracked_sources" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "display_name" TEXT NOT NULL,
  "normalized_url" TEXT NOT NULL,
  "type" TEXT NOT NULL CHECK ("type" IN ('url', 'facebook_post', 'facebook_group', 'facebook_page', 'social', 'file', 'text')),
  "provider" TEXT NOT NULL CHECK ("provider" IN ('apify_facebook_posts', 'apify_facebook_comments', 'apify_facebook_groups', 'firecrawl', 'firecrawl_parse', 'browser_use', 'local_text')),
  "is_active" INTEGER NOT NULL CHECK ("is_active" IN (0, 1)) DEFAULT 1,
  "last_scan_job_id" TEXT,
  "last_scan_status" TEXT CHECK ("last_scan_status" IN ('queued', 'running', 'completed', 'failed', 'retrying')),
  "last_scanned_at" TEXT,
  "metadata" TEXT NOT NULL CHECK (json_valid("metadata")) DEFAULT '{}',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY ("last_scan_job_id") REFERENCES "scan_jobs" ("id") ON DELETE set null ON UPDATE no action
);

CREATE TABLE "zalo_oa_connections" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "oa_id" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "avatar_url" TEXT,
  "access_token_encrypted" TEXT NOT NULL,
  "refresh_token_encrypted" TEXT NOT NULL,
  "access_token_expires_at" TEXT NOT NULL,
  "refresh_token_expires_at" TEXT NOT NULL,
  "scopes" TEXT NOT NULL CHECK (json_valid("scopes")) DEFAULT '[]',
  "is_default" INTEGER NOT NULL CHECK ("is_default" IN (0, 1)) DEFAULT 0,
  "auto_sync_drafts" INTEGER NOT NULL CHECK ("auto_sync_drafts" IN (0, 1)) DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'connected',
  "last_error" TEXT,
  "connected_by_user_id" TEXT NOT NULL,
  "connected_by_display_name" TEXT,
  "updated_by_user_id" TEXT NOT NULL,
  "updated_by_display_name" TEXT,
  "last_refreshed_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX "ai_prompt_presets_owner_updated_idx" ON "ai_prompt_presets" ("owner_user_id", "updated_at");

CREATE INDEX "ai_prompt_presets_visibility_updated_idx" ON "ai_prompt_presets" ("visibility", "updated_at");

CREATE UNIQUE INDEX "analyses_job_unique" ON "analyses" ("scan_job_id");

CREATE UNIQUE INDEX "article_evidence_unique" ON "article_evidence" ("article_id", "evidence_item_id");

CREATE INDEX "article_evidence_evidence_idx" ON "article_evidence" ("evidence_item_id");

CREATE INDEX "article_media_article_created_idx" ON "article_media" ("article_id", "created_at");

CREATE INDEX "article_publication_jobs_queue_idx" ON "article_publication_jobs" ("status", "scheduled_at", "locked_at");

CREATE INDEX "article_publication_jobs_article_idx" ON "article_publication_jobs" ("article_id", "created_at");

CREATE UNIQUE INDEX "article_publication_jobs_fingerprint_unique" ON "article_publication_jobs" ("request_fingerprint");

CREATE UNIQUE INDEX "article_versions_article_version_unique" ON "article_versions" ("article_id", "version");

CREATE INDEX "article_versions_article_created_idx" ON "article_versions" ("article_id", "created_at");

CREATE INDEX "articles_status_updated_idx" ON "articles" ("publication_status", "updated_at");

CREATE INDEX "articles_review_updated_idx" ON "articles" ("review_status", "updated_at");

CREATE INDEX "articles_state_updated_idx" ON "articles" ("state", "updated_at");

CREATE UNIQUE INDEX "articles_automation_key_unique" ON "articles" ("automation_key") WHERE "automation_key" is not null;

CREATE INDEX "articles_oa_updated_idx" ON "articles" ("target_oa_connection_id", "updated_at");

CREATE INDEX "articles_schedule_idx" ON "articles" ("publication_status", "scheduled_at");

CREATE INDEX "articles_remote_idx" ON "articles" ("remote_article_id");

CREATE UNIQUE INDEX "articles_origin_draft_unique" ON "articles" ("origin_draft_id") WHERE "origin_draft_id" is not null;

CREATE INDEX "audit_events_entity_idx" ON "audit_events" ("entity_type", "entity_id");

CREATE INDEX "audit_events_entity_created_idx" ON "audit_events" ("entity_type", "entity_id", "created_at");

CREATE UNIQUE INDEX "chat_attachment_chunks_attachment_ordinal_idx" ON "chat_attachment_chunks" ("attachment_id", "ordinal");

CREATE INDEX "chat_attachments_conversation_created_idx" ON "chat_attachments" ("conversation_id", "created_at");

CREATE INDEX "chat_attachments_queue_claim_idx" ON "chat_attachments" ("status", "scheduled_at", "locked_at");

CREATE INDEX "chat_attachments_cleanup_idx" ON "chat_attachments" ("status", "delete_requested_at");

CREATE INDEX "chat_conversations_owner_recency_idx" ON "chat_conversations" ("owner_user_id", "archived_at", "updated_at");

CREATE INDEX "chat_conversations_visibility_recency_idx" ON "chat_conversations" ("visibility", "deleted_at", "updated_at");

CREATE INDEX "chat_conversations_fork_idx" ON "chat_conversations" ("forked_from_id");

CREATE INDEX "chat_messages_conversation_created_idx" ON "chat_messages" ("conversation_id", "created_at", "id");

CREATE INDEX "chat_model_runs_conversation_started_idx" ON "chat_model_runs" ("conversation_id", "started_at");

CREATE INDEX "chat_model_runs_status_started_idx" ON "chat_model_runs" ("status", "started_at");

CREATE INDEX "chat_model_runs_provider_model_started_idx" ON "chat_model_runs" ("provider", "model", "started_at");

CREATE INDEX "chat_tool_runs_model_started_idx" ON "chat_tool_runs" ("model_run_id", "started_at");

CREATE INDEX "chat_tool_runs_tool_status_started_idx" ON "chat_tool_runs" ("tool_name", "status", "started_at");

CREATE UNIQUE INDEX "counter_argument_draft_versions_draft_version_idx" ON "counter_argument_draft_versions" ("draft_id", "version");

CREATE INDEX "counter_argument_draft_versions_draft_created_idx" ON "counter_argument_draft_versions" ("draft_id", "created_at");

CREATE INDEX "counter_argument_drafts_job_idx" ON "counter_argument_drafts" ("scan_job_id");

CREATE INDEX "counter_argument_drafts_job_created_idx" ON "counter_argument_drafts" ("scan_job_id", "created_at");

CREATE INDEX "counter_argument_drafts_status_kind_created_idx" ON "counter_argument_drafts" ("status", "draft_kind", "created_at");

CREATE INDEX "counter_argument_drafts_evidence_created_idx" ON "counter_argument_drafts" ("evidence_item_id", "created_at");

CREATE INDEX "counter_argument_drafts_chat_created_idx" ON "counter_argument_drafts" ("originating_chat_id", "created_at");

CREATE UNIQUE INDEX "counter_argument_drafts_automation_key_unique" ON "counter_argument_drafts" ("automation_key") WHERE "automation_key" is not null;

CREATE UNIQUE INDEX "draft_automation_jobs_evidence_classification_unique" ON "draft_automation_jobs" ("evidence_item_id", "classification");

CREATE INDEX "draft_automation_jobs_queue_idx" ON "draft_automation_jobs" ("status", "scheduled_at", "locked_at");

CREATE INDEX "draft_automation_jobs_page_status_idx" ON "draft_automation_jobs" ("page_key", "status", "updated_at");

CREATE INDEX "draft_automation_jobs_draft_idx" ON "draft_automation_jobs" ("draft_id");

CREATE INDEX "evidence_items_job_idx" ON "evidence_items" ("scan_job_id");

CREATE INDEX "evidence_items_job_created_idx" ON "evidence_items" ("scan_job_id", "created_at");

CREATE INDEX "evidence_items_source_idx" ON "evidence_items" ("source_id");

CREATE INDEX "evidence_items_risk_created_idx" ON "evidence_items" ("risk_level", "created_at");

CREATE INDEX "evidence_items_provider_created_idx" ON "evidence_items" ("provider", "created_at");

CREATE INDEX "evidence_items_published_id_idx" ON "evidence_items" ("published_at", "id");

CREATE INDEX "evidence_items_risk_published_id_idx" ON "evidence_items" ("risk_level", "published_at", "id");

CREATE INDEX "evidence_semantic_profiles_updated_idx" ON "evidence_semantic_profiles" ("updated_at");

CREATE UNIQUE INDEX "evidence_topics_unique" ON "evidence_topics" ("evidence_item_id", "topic_id");

CREATE INDEX "evidence_topics_topic_idx" ON "evidence_topics" ("topic_id", "created_at");

CREATE INDEX "evidence_topics_evidence_idx" ON "evidence_topics" ("evidence_item_id");

CREATE INDEX "evidence_topics_scan_idx" ON "evidence_topics" ("scan_job_id");

CREATE INDEX "evidence_topics_topic_confidence_idx" ON "evidence_topics" ("topic_id", "confidence", "created_at");

CREATE INDEX "evidence_triage_status_due_idx" ON "evidence_triage" ("status", "due_at");

CREATE INDEX "evidence_triage_assignee_status_idx" ON "evidence_triage" ("assignee_user_id", "status");

CREATE INDEX "evidence_triage_pinned_updated_idx" ON "evidence_triage" ("is_pinned", "updated_at");

CREATE INDEX "evidence_triage_updated_idx" ON "evidence_triage" ("updated_at");

CREATE INDEX "evidence_triage_notes_evidence_created_idx" ON "evidence_triage_notes" ("evidence_item_id", "created_at");

CREATE UNIQUE INDEX "facebook_page_profiles_facebook_id_unique" ON "facebook_page_profiles" ("facebook_page_id") WHERE "facebook_page_id" is not null;

CREATE UNIQUE INDEX "facebook_page_profiles_username_unique" ON "facebook_page_profiles" ("username") WHERE "username" is not null;

CREATE INDEX "facebook_page_profiles_classification_updated_idx" ON "facebook_page_profiles" ("classification", "updated_at");

CREATE INDEX "facebook_page_profiles_automation_idx" ON "facebook_page_profiles" ("auto_draft_enabled", "classification");

CREATE INDEX "intelligence_activity_rollups_time_idx" ON "intelligence_activity_rollups" ("occurred_at");

CREATE INDEX "intelligence_activity_rollups_entity_idx" ON "intelligence_activity_rollups" ("entity_type", "entity_id");

CREATE INDEX "intelligence_activity_rollups_severity_idx" ON "intelligence_activity_rollups" ("severity");

CREATE UNIQUE INDEX "intelligence_claim_index_key_unique" ON "intelligence_claim_index" ("claim_key");

CREATE INDEX "intelligence_claim_index_risk_idx" ON "intelligence_claim_index" ("risk_level", "confidence");

CREATE INDEX "intelligence_claim_index_scan_idx" ON "intelligence_claim_index" ("scan_job_id");

CREATE INDEX "intelligence_daily_rollups_updated_idx" ON "intelligence_daily_rollups" ("updated_at");

CREATE INDEX "intelligence_provider_rollups_health_idx" ON "intelligence_provider_rollups" ("health", "last_run_at");

CREATE INDEX "intelligence_source_rollups_health_idx" ON "intelligence_source_rollups" ("health", "last_scanned_at");

CREATE INDEX "intelligence_source_rollups_provider_idx" ON "intelligence_source_rollups" ("provider");

CREATE INDEX "intelligence_summaries_generated_idx" ON "intelligence_summaries" ("generated_at");

CREATE UNIQUE INDEX "intelligence_topic_rollups_slug_unique" ON "intelligence_topic_rollups" ("slug");

CREATE INDEX "intelligence_topic_rollups_priority_idx" ON "intelligence_topic_rollups" ("risk_level", "momentum_score", "evidence_count");

CREATE INDEX "intelligence_topic_rollups_last_seen_idx" ON "intelligence_topic_rollups" ("last_seen_at");

CREATE UNIQUE INDEX "local_account_sessions_token_idx" ON "local_account_sessions" ("token_hash");

CREATE INDEX "local_account_sessions_account_idx" ON "local_account_sessions" ("account_id");

CREATE INDEX "local_account_sessions_expiry_idx" ON "local_account_sessions" ("expires_at");

CREATE UNIQUE INDEX "local_accounts_username_idx" ON "local_accounts" ("username");

CREATE INDEX "local_accounts_created_idx" ON "local_accounts" ("created_at");

CREATE UNIQUE INDEX "managed_scheduler_integrations_provider_unique" ON "managed_scheduler_integrations" ("provider");

CREATE UNIQUE INDEX "provider_account_costs_account_day_idx" ON "provider_account_costs" ("provider", "account_id", "day");

CREATE INDEX "provider_runs_job_idx" ON "provider_runs" ("scan_job_id");

CREATE INDEX "provider_runs_job_started_idx" ON "provider_runs" ("scan_job_id", "started_at");

CREATE INDEX "scan_job_events_job_time_idx" ON "scan_job_events" ("scan_job_id", "occurred_at");

CREATE INDEX "scan_job_events_time_idx" ON "scan_job_events" ("occurred_at");

CREATE INDEX "scan_job_events_stage_status_time_idx" ON "scan_job_events" ("stage", "status", "occurred_at");

CREATE INDEX "scan_jobs_queue_idx" ON "scan_jobs" ("status", "scheduled_at", "priority");

CREATE INDEX "scan_jobs_source_idx" ON "scan_jobs" ("source_id");

CREATE INDEX "scan_jobs_parent_idx" ON "scan_jobs" ("parent_scan_job_id");

CREATE UNIQUE INDEX "scan_jobs_client_request_unique" ON "scan_jobs" ("client_request_id") WHERE "client_request_id" is not null;

CREATE INDEX "scan_jobs_status_created_idx" ON "scan_jobs" ("status", "created_at");

CREATE INDEX "scan_jobs_created_at_idx" ON "scan_jobs" ("created_at");

CREATE UNIQUE INDEX "topics_slug_unique" ON "topics" ("slug");

CREATE INDEX "topics_priority_idx" ON "topics" ("risk_level", "evidence_count");

CREATE UNIQUE INDEX "tracked_sources_url_unique" ON "tracked_sources" ("normalized_url");

CREATE INDEX "tracked_sources_active_idx" ON "tracked_sources" ("is_active", "updated_at");

CREATE INDEX "tracked_sources_last_scan_idx" ON "tracked_sources" ("last_scan_job_id");

CREATE UNIQUE INDEX "zalo_oa_connections_oa_unique" ON "zalo_oa_connections" ("oa_id");

CREATE UNIQUE INDEX "zalo_oa_connections_default_unique" ON "zalo_oa_connections" ("is_default") WHERE "is_default" = 1;

CREATE INDEX "zalo_oa_connections_status_updated_idx" ON "zalo_oa_connections" ("status", "updated_at");
