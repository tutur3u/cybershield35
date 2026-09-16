ALTER TABLE "ai_prompt_presets" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "ai_prompt_presets_revision_increment" AFTER UPDATE ON "ai_prompt_presets" WHEN NEW._revision = OLD._revision BEGIN UPDATE "ai_prompt_presets" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "analyses" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "analyses_revision_increment" AFTER UPDATE ON "analyses" WHEN NEW._revision = OLD._revision BEGIN UPDATE "analyses" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "article_evidence" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "article_evidence_revision_increment" AFTER UPDATE ON "article_evidence" WHEN NEW._revision = OLD._revision BEGIN UPDATE "article_evidence" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "article_media" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "article_media_revision_increment" AFTER UPDATE ON "article_media" WHEN NEW._revision = OLD._revision BEGIN UPDATE "article_media" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "article_publication_jobs" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "article_publication_jobs_revision_increment" AFTER UPDATE ON "article_publication_jobs" WHEN NEW._revision = OLD._revision BEGIN UPDATE "article_publication_jobs" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "article_versions" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "article_versions_revision_increment" AFTER UPDATE ON "article_versions" WHEN NEW._revision = OLD._revision BEGIN UPDATE "article_versions" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "articles" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "articles_revision_increment" AFTER UPDATE ON "articles" WHEN NEW._revision = OLD._revision BEGIN UPDATE "articles" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "audit_events" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "audit_events_revision_increment" AFTER UPDATE ON "audit_events" WHEN NEW._revision = OLD._revision BEGIN UPDATE "audit_events" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "chat_attachment_chunks" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "chat_attachment_chunks_revision_increment" AFTER UPDATE ON "chat_attachment_chunks" WHEN NEW._revision = OLD._revision BEGIN UPDATE "chat_attachment_chunks" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "chat_attachments" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "chat_attachments_revision_increment" AFTER UPDATE ON "chat_attachments" WHEN NEW._revision = OLD._revision BEGIN UPDATE "chat_attachments" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "chat_conversations" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "chat_conversations_revision_increment" AFTER UPDATE ON "chat_conversations" WHEN NEW._revision = OLD._revision BEGIN UPDATE "chat_conversations" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "chat_messages" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "chat_messages_revision_increment" AFTER UPDATE ON "chat_messages" WHEN NEW._revision = OLD._revision BEGIN UPDATE "chat_messages" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "chat_model_runs" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "chat_model_runs_revision_increment" AFTER UPDATE ON "chat_model_runs" WHEN NEW._revision = OLD._revision BEGIN UPDATE "chat_model_runs" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "chat_tool_runs" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "chat_tool_runs_revision_increment" AFTER UPDATE ON "chat_tool_runs" WHEN NEW._revision = OLD._revision BEGIN UPDATE "chat_tool_runs" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "counter_argument_draft_versions" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "counter_argument_draft_versions_revision_increment" AFTER UPDATE ON "counter_argument_draft_versions" WHEN NEW._revision = OLD._revision BEGIN UPDATE "counter_argument_draft_versions" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "counter_argument_drafts" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "counter_argument_drafts_revision_increment" AFTER UPDATE ON "counter_argument_drafts" WHEN NEW._revision = OLD._revision BEGIN UPDATE "counter_argument_drafts" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "cron_heartbeats" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "cron_heartbeats_revision_increment" AFTER UPDATE ON "cron_heartbeats" WHEN NEW._revision = OLD._revision BEGIN UPDATE "cron_heartbeats" SET _revision = OLD._revision + 1 WHERE "service_name" IS NEW."service_name"; END;

ALTER TABLE "draft_automation_jobs" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "draft_automation_jobs_revision_increment" AFTER UPDATE ON "draft_automation_jobs" WHEN NEW._revision = OLD._revision BEGIN UPDATE "draft_automation_jobs" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "evidence_items" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "evidence_items_revision_increment" AFTER UPDATE ON "evidence_items" WHEN NEW._revision = OLD._revision BEGIN UPDATE "evidence_items" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "evidence_semantic_profiles" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "evidence_semantic_profiles_revision_increment" AFTER UPDATE ON "evidence_semantic_profiles" WHEN NEW._revision = OLD._revision BEGIN UPDATE "evidence_semantic_profiles" SET _revision = OLD._revision + 1 WHERE "evidence_item_id" IS NEW."evidence_item_id"; END;

ALTER TABLE "evidence_topics" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "evidence_topics_revision_increment" AFTER UPDATE ON "evidence_topics" WHEN NEW._revision = OLD._revision BEGIN UPDATE "evidence_topics" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "evidence_triage" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "evidence_triage_revision_increment" AFTER UPDATE ON "evidence_triage" WHEN NEW._revision = OLD._revision BEGIN UPDATE "evidence_triage" SET _revision = OLD._revision + 1 WHERE "evidence_item_id" IS NEW."evidence_item_id"; END;

ALTER TABLE "evidence_triage_notes" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "evidence_triage_notes_revision_increment" AFTER UPDATE ON "evidence_triage_notes" WHEN NEW._revision = OLD._revision BEGIN UPDATE "evidence_triage_notes" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "facebook_page_profiles" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "facebook_page_profiles_revision_increment" AFTER UPDATE ON "facebook_page_profiles" WHEN NEW._revision = OLD._revision BEGIN UPDATE "facebook_page_profiles" SET _revision = OLD._revision + 1 WHERE "page_key" IS NEW."page_key"; END;

ALTER TABLE "intelligence_activity_rollups" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "intelligence_activity_rollups_revision_increment" AFTER UPDATE ON "intelligence_activity_rollups" WHEN NEW._revision = OLD._revision BEGIN UPDATE "intelligence_activity_rollups" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "intelligence_claim_index" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "intelligence_claim_index_revision_increment" AFTER UPDATE ON "intelligence_claim_index" WHEN NEW._revision = OLD._revision BEGIN UPDATE "intelligence_claim_index" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "intelligence_daily_rollups" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "intelligence_daily_rollups_revision_increment" AFTER UPDATE ON "intelligence_daily_rollups" WHEN NEW._revision = OLD._revision BEGIN UPDATE "intelligence_daily_rollups" SET _revision = OLD._revision + 1 WHERE "day" IS NEW."day"; END;

ALTER TABLE "intelligence_provider_rollups" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "intelligence_provider_rollups_revision_increment" AFTER UPDATE ON "intelligence_provider_rollups" WHEN NEW._revision = OLD._revision BEGIN UPDATE "intelligence_provider_rollups" SET _revision = OLD._revision + 1 WHERE "provider" IS NEW."provider"; END;

ALTER TABLE "intelligence_source_rollups" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "intelligence_source_rollups_revision_increment" AFTER UPDATE ON "intelligence_source_rollups" WHEN NEW._revision = OLD._revision BEGIN UPDATE "intelligence_source_rollups" SET _revision = OLD._revision + 1 WHERE "source_id" IS NEW."source_id"; END;

ALTER TABLE "intelligence_summaries" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "intelligence_summaries_revision_increment" AFTER UPDATE ON "intelligence_summaries" WHEN NEW._revision = OLD._revision BEGIN UPDATE "intelligence_summaries" SET _revision = OLD._revision + 1 WHERE "time_range" IS NEW."time_range"; END;

ALTER TABLE "intelligence_topic_rollups" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "intelligence_topic_rollups_revision_increment" AFTER UPDATE ON "intelligence_topic_rollups" WHEN NEW._revision = OLD._revision BEGIN UPDATE "intelligence_topic_rollups" SET _revision = OLD._revision + 1 WHERE "topic_id" IS NEW."topic_id"; END;

ALTER TABLE "local_account_sessions" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "local_account_sessions_revision_increment" AFTER UPDATE ON "local_account_sessions" WHEN NEW._revision = OLD._revision BEGIN UPDATE "local_account_sessions" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "local_accounts" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "local_accounts_revision_increment" AFTER UPDATE ON "local_accounts" WHEN NEW._revision = OLD._revision BEGIN UPDATE "local_accounts" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "managed_scheduler_integrations" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "managed_scheduler_integrations_revision_increment" AFTER UPDATE ON "managed_scheduler_integrations" WHEN NEW._revision = OLD._revision BEGIN UPDATE "managed_scheduler_integrations" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "provider_account_costs" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "provider_account_costs_revision_increment" AFTER UPDATE ON "provider_account_costs" WHEN NEW._revision = OLD._revision BEGIN UPDATE "provider_account_costs" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "provider_runs" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "provider_runs_revision_increment" AFTER UPDATE ON "provider_runs" WHEN NEW._revision = OLD._revision BEGIN UPDATE "provider_runs" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "scan_job_events" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "scan_job_events_revision_increment" AFTER UPDATE ON "scan_job_events" WHEN NEW._revision = OLD._revision BEGIN UPDATE "scan_job_events" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "scan_jobs" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "scan_jobs_revision_increment" AFTER UPDATE ON "scan_jobs" WHEN NEW._revision = OLD._revision BEGIN UPDATE "scan_jobs" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "sources" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "sources_revision_increment" AFTER UPDATE ON "sources" WHEN NEW._revision = OLD._revision BEGIN UPDATE "sources" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "topics" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "topics_revision_increment" AFTER UPDATE ON "topics" WHEN NEW._revision = OLD._revision BEGIN UPDATE "topics" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "tracked_sources" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "tracked_sources_revision_increment" AFTER UPDATE ON "tracked_sources" WHEN NEW._revision = OLD._revision BEGIN UPDATE "tracked_sources" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;

ALTER TABLE "zalo_oa_connections" ADD COLUMN _revision INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER "zalo_oa_connections_revision_increment" AFTER UPDATE ON "zalo_oa_connections" WHEN NEW._revision = OLD._revision BEGIN UPDATE "zalo_oa_connections" SET _revision = OLD._revision + 1 WHERE "id" IS NEW."id"; END;
