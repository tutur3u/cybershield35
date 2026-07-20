import {
	boolean,
	date,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const sourceTypeEnum = pgEnum("source_type", [
	"url",
	"facebook_post",
	"facebook_group",
	"facebook_page",
	"social",
	"file",
	"text",
]);

export const providerNameEnum = pgEnum("provider_name", [
	"apify_facebook_posts",
	"apify_facebook_comments",
	"apify_facebook_groups",
	"firecrawl",
	"firecrawl_parse",
	"browser_use",
	"local_text",
]);

export const scanStatusEnum = pgEnum("scan_status", [
	"queued",
	"running",
	"completed",
	"failed",
	"retrying",
]);

export const riskLevelEnum = pgEnum("risk_level", ["low", "medium", "high"]);

export const draftStatusEnum = pgEnum("draft_status", [
	"draft",
	"needs_review",
	"approved",
	"rejected",
]);

export const draftKindEnum = pgEnum("draft_kind", [
	"response",
	"comment",
	"counter_argument",
	"internal_brief",
]);

export const facebookPageClassificationEnum = pgEnum(
	"facebook_page_classification",
	["uncategorized", "trusted", "at_risk"],
);

export const draftAutomationStatusEnum = pgEnum("draft_automation_status", [
	"queued",
	"running",
	"completed",
	"failed",
	"retrying",
	"skipped",
]);

export const chatVisibilityEnum = pgEnum("chat_visibility", [
	"private",
	"workspace",
]);

export const chatAttachmentStatusEnum = pgEnum("chat_attachment_status", [
	"pending_upload",
	"uploading",
	"processing",
	"ready",
	"failed",
	"deleting",
	"deleted",
]);

export const chatRunStatusEnum = pgEnum("chat_run_status", [
	"running",
	"completed",
	"failed",
	"aborted",
]);

export const evidenceTriageStatusEnum = pgEnum("evidence_triage_status", [
	"new",
	"reviewing",
	"action_required",
	"resolved",
	"dismissed",
]);

export const sources = pgTable("sources", {
	id: uuid("id").defaultRandom().primaryKey(),
	type: sourceTypeEnum("type").notNull(),
	originalInput: text("original_input").notNull(),
	normalizedUrl: text("normalized_url"),
	title: text("title"),
	mimeType: text("mime_type"),
	fileName: text("file_name"),
	fileText: text("file_text"),
	metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const scanJobs = pgTable(
	"scan_jobs",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		sourceId: uuid("source_id")
			.notNull()
			.references(() => sources.id, { onDelete: "cascade" }),
		status: scanStatusEnum("status").default("queued").notNull(),
		provider: providerNameEnum("provider").notNull(),
		priority: integer("priority").default(0).notNull(),
		attempts: integer("attempts").default(0).notNull(),
		maxAttempts: integer("max_attempts").default(3).notNull(),
		scheduledAt: timestamp("scheduled_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		startedAt: timestamp("started_at", { withTimezone: true }),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		lockedAt: timestamp("locked_at", { withTimezone: true }),
		errorMessage: text("error_message"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("scan_jobs_queue_idx").on(table.status, table.scheduledAt, table.priority),
		index("scan_jobs_source_idx").on(table.sourceId),
		index("scan_jobs_status_created_idx").on(table.status, table.createdAt),
		index("scan_jobs_created_at_idx").on(table.createdAt),
	],
);

export const trackedSources = pgTable(
	"tracked_sources",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		displayName: text("display_name").notNull(),
		normalizedUrl: text("normalized_url").notNull(),
		type: sourceTypeEnum("type").notNull(),
		provider: providerNameEnum("provider").notNull(),
		isActive: boolean("is_active").default(true).notNull(),
		lastScanJobId: uuid("last_scan_job_id").references(() => scanJobs.id, {
			onDelete: "set null",
		}),
		lastScanStatus: scanStatusEnum("last_scan_status"),
		lastScannedAt: timestamp("last_scanned_at", { withTimezone: true }),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("tracked_sources_url_unique").on(table.normalizedUrl),
		index("tracked_sources_active_idx").on(table.isActive, table.updatedAt),
		index("tracked_sources_last_scan_idx").on(table.lastScanJobId),
	],
);

export const facebookPageProfiles = pgTable(
	"facebook_page_profiles",
	{
		pageKey: text("page_key").primaryKey(),
		facebookPageId: text("facebook_page_id"),
		username: text("username"),
		displayName: text("display_name").notNull(),
		classification: facebookPageClassificationEnum("classification")
			.default("uncategorized")
			.notNull(),
		autoDraftEnabled: boolean("auto_draft_enabled").default(true).notNull(),
		updatedByUserId: text("updated_by_user_id").notNull(),
		updatedByDisplayName: text("updated_by_display_name"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("facebook_page_profiles_facebook_id_unique")
			.on(table.facebookPageId)
			.where(sql`${table.facebookPageId} is not null`),
		uniqueIndex("facebook_page_profiles_username_unique")
			.on(table.username)
			.where(sql`${table.username} is not null`),
		index("facebook_page_profiles_classification_updated_idx").on(
			table.classification,
			table.updatedAt,
		),
		index("facebook_page_profiles_automation_idx").on(
			table.autoDraftEnabled,
			table.classification,
		),
	],
);

export const providerRuns = pgTable(
	"provider_runs",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		scanJobId: uuid("scan_job_id")
			.notNull()
			.references(() => scanJobs.id, { onDelete: "cascade" }),
		provider: providerNameEnum("provider").notNull(),
		status: scanStatusEnum("status").default("running").notNull(),
		input: jsonb("input").$type<Record<string, unknown>>().default({}).notNull(),
		output: jsonb("output").$type<Record<string, unknown>>().default({}).notNull(),
		errorMessage: text("error_message"),
		startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [
		index("provider_runs_job_idx").on(table.scanJobId),
		index("provider_runs_job_started_idx").on(table.scanJobId, table.startedAt),
	],
);

export const scanJobEvents = pgTable(
	"scan_job_events",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		scanJobId: uuid("scan_job_id")
			.notNull()
			.references(() => scanJobs.id, { onDelete: "cascade" }),
		eventType: text("event_type").notNull(),
		stage: text("stage").notNull(),
		status: text("status").notNull(),
		message: text("message").notNull(),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
		occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("scan_job_events_job_time_idx").on(table.scanJobId, table.occurredAt),
		index("scan_job_events_time_idx").on(table.occurredAt),
		index("scan_job_events_stage_status_time_idx").on(
			table.stage,
			table.status,
			table.occurredAt,
		),
	],
);

export const evidenceItems = pgTable(
	"evidence_items",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		scanJobId: uuid("scan_job_id")
			.notNull()
			.references(() => scanJobs.id, { onDelete: "cascade" }),
		sourceId: uuid("source_id")
			.notNull()
			.references(() => sources.id, { onDelete: "cascade" }),
		provider: providerNameEnum("provider").notNull(),
		sourceUrl: text("source_url"),
		sourceLabel: text("source_label"),
		author: text("author"),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		quote: text("quote").notNull(),
		summary: text("summary").notNull(),
		engagement: jsonb("engagement")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		stance: text("stance").default("neutral").notNull(),
		sentiment: text("sentiment").default("neutral").notNull(),
		riskLevel: riskLevelEnum("risk_level").default("medium").notNull(),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("evidence_items_job_idx").on(table.scanJobId),
		index("evidence_items_job_created_idx").on(table.scanJobId, table.createdAt),
		index("evidence_items_source_idx").on(table.sourceId),
		index("evidence_items_risk_created_idx").on(
			table.riskLevel,
			table.createdAt,
		),
		index("evidence_items_provider_created_idx").on(
			table.provider,
			table.createdAt,
		),
		index("evidence_items_published_id_idx").on(table.publishedAt, table.id),
		index("evidence_items_risk_published_id_idx").on(
			table.riskLevel,
			table.publishedAt,
			table.id,
		),
		index("evidence_items_engagement_published_idx").on(
			sql`(
				case when coalesce(${table.engagement}->>'reactions', '') ~ '^\\d+$' then (${table.engagement}->>'reactions')::int else 0 end +
				case when coalesce(${table.engagement}->>'comments', '') ~ '^\\d+$' then (${table.engagement}->>'comments')::int else 0 end +
				case when coalesce(${table.engagement}->>'shares', '') ~ '^\\d+$' then (${table.engagement}->>'shares')::int else 0 end
			)`,
			table.publishedAt,
			table.id,
		),
	],
);

export const evidenceTriage = pgTable(
	"evidence_triage",
	{
		evidenceItemId: uuid("evidence_item_id")
			.primaryKey()
			.references(() => evidenceItems.id, { onDelete: "cascade" }),
		status: evidenceTriageStatusEnum("status").default("new").notNull(),
		isPinned: boolean("is_pinned").default(false).notNull(),
		assigneeUserId: text("assignee_user_id"),
		assigneeDisplayName: text("assignee_display_name"),
		dueAt: timestamp("due_at", { withTimezone: true }),
		updatedByUserId: text("updated_by_user_id").notNull(),
		updatedByDisplayName: text("updated_by_display_name"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("evidence_triage_status_due_idx").on(table.status, table.dueAt),
		index("evidence_triage_assignee_status_idx").on(
			table.assigneeUserId,
			table.status,
		),
		index("evidence_triage_pinned_updated_idx").on(
			table.isPinned,
			table.updatedAt,
		),
		index("evidence_triage_updated_idx").on(table.updatedAt),
	],
);

export const evidenceTriageNotes = pgTable(
	"evidence_triage_notes",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		evidenceItemId: uuid("evidence_item_id")
			.notNull()
			.references(() => evidenceItems.id, { onDelete: "cascade" }),
		authorUserId: text("author_user_id").notNull(),
		authorDisplayName: text("author_display_name"),
		body: text("body").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("evidence_triage_notes_evidence_created_idx").on(
			table.evidenceItemId,
			table.createdAt,
		),
	],
);

export const analyses = pgTable(
	"analyses",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		scanJobId: uuid("scan_job_id")
			.notNull()
			.references(() => scanJobs.id, { onDelete: "cascade" }),
		riskLevel: riskLevelEnum("risk_level").default("medium").notNull(),
		summary: text("summary").notNull(),
		stanceSummary: text("stance_summary").notNull(),
		topicClusters: jsonb("topic_clusters").$type<unknown[]>().default([]).notNull(),
		claims: jsonb("claims").$type<unknown[]>().default([]).notNull(),
		riskFlags: jsonb("risk_flags").$type<unknown[]>().default([]).notNull(),
		sentiment: jsonb("sentiment").$type<Record<string, unknown>>().default({}).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [uniqueIndex("analyses_job_unique").on(table.scanJobId)],
);

export const topics = pgTable(
	"topics",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		slug: text("slug").notNull(),
		name: text("name").notNull(),
		riskLevel: riskLevelEnum("risk_level").default("medium").notNull(),
		trend: text("trend").default("stable").notNull(),
		evidenceCount: integer("evidence_count").default(0).notNull(),
		firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("topics_slug_unique").on(table.slug),
		index("topics_priority_idx").on(table.riskLevel, table.evidenceCount),
	],
);

export const evidenceTopics = pgTable(
	"evidence_topics",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		evidenceItemId: uuid("evidence_item_id")
			.notNull()
			.references(() => evidenceItems.id, { onDelete: "cascade" }),
		topicId: uuid("topic_id")
			.notNull()
			.references(() => topics.id, { onDelete: "cascade" }),
		scanJobId: uuid("scan_job_id")
			.notNull()
			.references(() => scanJobs.id, { onDelete: "cascade" }),
		confidence: integer("confidence").default(0).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("evidence_topics_unique").on(
			table.evidenceItemId,
			table.topicId,
		),
		index("evidence_topics_topic_idx").on(table.topicId, table.createdAt),
		index("evidence_topics_evidence_idx").on(table.evidenceItemId),
		index("evidence_topics_scan_idx").on(table.scanJobId),
		index("evidence_topics_topic_confidence_idx").on(
			table.topicId,
			table.confidence,
			table.createdAt,
		),
	],
);

export const chatConversations = pgTable(
	"chat_conversations",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		ownerUserId: text("owner_user_id").notNull(),
		ownerDisplayName: text("owner_display_name"),
		title: text("title").default("Cuộc trò chuyện mới").notNull(),
		visibility: chatVisibilityEnum("visibility").default("private").notNull(),
		forkedFromId: uuid("forked_from_id"),
		sharedAt: timestamp("shared_at", { withTimezone: true }),
		archivedAt: timestamp("archived_at", { withTimezone: true }),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("chat_conversations_owner_recency_idx").on(
			table.ownerUserId,
			table.archivedAt,
			table.updatedAt,
		),
		index("chat_conversations_visibility_recency_idx").on(
			table.visibility,
			table.deletedAt,
			table.updatedAt,
		),
		index("chat_conversations_fork_idx").on(table.forkedFromId),
	],
);

export const chatMessages = pgTable(
	"chat_messages",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		conversationId: uuid("conversation_id")
			.notNull()
			.references(() => chatConversations.id, { onDelete: "cascade" }),
		role: text("role").notNull(),
		parts: jsonb("parts").$type<unknown[]>().default([]).notNull(),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
		actorUserId: text("actor_user_id"),
		actorDisplayName: text("actor_display_name"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("chat_messages_conversation_created_idx").on(
			table.conversationId,
			table.createdAt,
			table.id,
		),
	],
);

export const chatAttachments = pgTable(
	"chat_attachments",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		conversationId: uuid("conversation_id")
			.notNull()
			.references(() => chatConversations.id, { onDelete: "cascade" }),
		messageId: uuid("message_id").references(() => chatMessages.id, {
			onDelete: "set null",
		}),
		drivePath: text("drive_path"),
		driveFullPath: text("drive_full_path"),
		storageProvider: text("storage_provider"),
		fileName: text("file_name").notNull(),
		contentType: text("content_type").notNull(),
		sizeBytes: integer("size_bytes").notNull(),
		status: chatAttachmentStatusEnum("status").default("pending_upload").notNull(),
		attempts: integer("attempts").default(0).notNull(),
		maxAttempts: integer("max_attempts").default(3).notNull(),
		scheduledAt: timestamp("scheduled_at", { withTimezone: true }).defaultNow().notNull(),
		lockedAt: timestamp("locked_at", { withTimezone: true }),
		processedAt: timestamp("processed_at", { withTimezone: true }),
		deleteRequestedAt: timestamp("delete_requested_at", { withTimezone: true }),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		errorMessage: text("error_message"),
		extractionMetadata: jsonb("extraction_metadata")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("chat_attachments_conversation_created_idx").on(
			table.conversationId,
			table.createdAt,
		),
		index("chat_attachments_queue_claim_idx").on(
			table.status,
			table.scheduledAt,
			table.lockedAt,
		),
		index("chat_attachments_cleanup_idx").on(
			table.status,
			table.deleteRequestedAt,
		),
	],
);

export const chatAttachmentChunks = pgTable(
	"chat_attachment_chunks",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		attachmentId: uuid("attachment_id")
			.notNull()
			.references(() => chatAttachments.id, { onDelete: "cascade" }),
		ordinal: integer("ordinal").notNull(),
		content: text("content").notNull(),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("chat_attachment_chunks_attachment_ordinal_idx").on(
			table.attachmentId,
			table.ordinal,
		),
		index("chat_attachment_chunks_search_idx").using(
			"gin",
			sql`to_tsvector('simple', ${table.content})`,
		),
	],
);

export const chatModelRuns = pgTable(
	"chat_model_runs",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		conversationId: uuid("conversation_id")
			.notNull()
			.references(() => chatConversations.id, { onDelete: "cascade" }),
		userMessageId: uuid("user_message_id").references(() => chatMessages.id, {
			onDelete: "set null",
		}),
		assistantMessageId: uuid("assistant_message_id").references(
			() => chatMessages.id,
			{ onDelete: "set null" },
		),
		actorUserId: text("actor_user_id").notNull(),
		provider: text("provider").notNull(),
		model: text("model").notNull(),
		status: chatRunStatusEnum("status").default("running").notNull(),
		inputTokens: integer("input_tokens"),
		outputTokens: integer("output_tokens"),
		totalTokens: integer("total_tokens"),
		timeToFirstTokenMs: integer("time_to_first_token_ms"),
		latencyMs: integer("latency_ms"),
		stepCount: integer("step_count").default(0).notNull(),
		errorCode: text("error_code"),
		errorMessage: text("error_message"),
		startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [
		index("chat_model_runs_conversation_started_idx").on(
			table.conversationId,
			table.startedAt,
		),
		index("chat_model_runs_status_started_idx").on(table.status, table.startedAt),
		index("chat_model_runs_provider_model_started_idx").on(
			table.provider,
			table.model,
			table.startedAt,
		),
	],
);

export const chatToolRuns = pgTable(
	"chat_tool_runs",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		modelRunId: uuid("model_run_id")
			.notNull()
			.references(() => chatModelRuns.id, { onDelete: "cascade" }),
		toolCallId: text("tool_call_id").notNull(),
		toolName: text("tool_name").notNull(),
		status: text("status").notNull(),
		inputSummary: jsonb("input_summary").$type<Record<string, unknown>>().default({}).notNull(),
		outputSummary: jsonb("output_summary").$type<Record<string, unknown>>().default({}).notNull(),
		errorMessage: text("error_message"),
		startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [
		index("chat_tool_runs_model_started_idx").on(table.modelRunId, table.startedAt),
		index("chat_tool_runs_tool_status_started_idx").on(
			table.toolName,
			table.status,
			table.startedAt,
		),
	],
);

export const counterArgumentDrafts = pgTable(
	"counter_argument_drafts",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		scanJobId: uuid("scan_job_id")
			.notNull()
			.references(() => scanJobs.id, { onDelete: "cascade" }),
		status: draftStatusEnum("status").default("draft").notNull(),
		draftKind: draftKindEnum("draft_kind").default("counter_argument").notNull(),
		evidenceItemId: uuid("evidence_item_id").references(() => evidenceItems.id, {
			onDelete: "set null",
		}),
		originatingChatId: uuid("originating_chat_id").references(
			() => chatConversations.id,
			{ onDelete: "set null" },
		),
		createdByUserId: text("created_by_user_id"),
		createdByDisplayName: text("created_by_display_name"),
		updatedByUserId: text("updated_by_user_id"),
		updatedByDisplayName: text("updated_by_display_name"),
		automationKey: text("automation_key"),
		generationReason: text("generation_reason"),
		tone: text("tone").notNull(),
		audience: text("audience").notNull(),
		language: text("language").default("vi").notNull(),
		length: text("length").default("medium").notNull(),
		operatorNotes: text("operator_notes"),
		body: text("body").notNull(),
		citations: jsonb("citations").$type<unknown[]>().default([]).notNull(),
		safetyNotes: jsonb("safety_notes").$type<unknown[]>().default([]).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("counter_argument_drafts_job_idx").on(table.scanJobId),
		index("counter_argument_drafts_job_created_idx").on(
			table.scanJobId,
			table.createdAt,
		),
		index("counter_argument_drafts_status_kind_created_idx").on(
			table.status,
			table.draftKind,
			table.createdAt,
		),
		index("counter_argument_drafts_evidence_created_idx").on(
			table.evidenceItemId,
			table.createdAt,
		),
		index("counter_argument_drafts_chat_created_idx").on(
			table.originatingChatId,
			table.createdAt,
		),
		uniqueIndex("counter_argument_drafts_automation_key_unique")
			.on(table.automationKey)
			.where(sql`${table.automationKey} is not null`),
	],
);

export const draftAutomationJobs = pgTable(
	"draft_automation_jobs",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		evidenceItemId: uuid("evidence_item_id")
			.notNull()
			.references(() => evidenceItems.id, { onDelete: "cascade" }),
		pageKey: text("page_key")
			.notNull()
			.references(() => facebookPageProfiles.pageKey, { onDelete: "cascade" }),
		classification: facebookPageClassificationEnum("classification").notNull(),
		draftKind: draftKindEnum("draft_kind").notNull(),
		status: draftAutomationStatusEnum("status").default("queued").notNull(),
		attempts: integer("attempts").default(0).notNull(),
		maxAttempts: integer("max_attempts").default(3).notNull(),
		scheduledAt: timestamp("scheduled_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		lockedAt: timestamp("locked_at", { withTimezone: true }),
		draftId: uuid("draft_id").references(() => counterArgumentDrafts.id, {
			onDelete: "set null",
		}),
		errorMessage: text("error_message"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [
		uniqueIndex("draft_automation_jobs_evidence_classification_unique").on(
			table.evidenceItemId,
			table.classification,
		),
		index("draft_automation_jobs_queue_idx").on(
			table.status,
			table.scheduledAt,
			table.lockedAt,
		),
		index("draft_automation_jobs_page_status_idx").on(
			table.pageKey,
			table.status,
			table.updatedAt,
		),
		index("draft_automation_jobs_draft_idx").on(table.draftId),
	],
);

export const counterArgumentDraftVersions = pgTable(
	"counter_argument_draft_versions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		draftId: uuid("draft_id")
			.notNull()
			.references(() => counterArgumentDrafts.id, { onDelete: "cascade" }),
		version: integer("version").notNull(),
		body: text("body").notNull(),
		citations: jsonb("citations").$type<unknown[]>().default([]).notNull(),
		safetyNotes: jsonb("safety_notes").$type<unknown[]>().default([]).notNull(),
		actorUserId: text("actor_user_id").notNull(),
		actorDisplayName: text("actor_display_name"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("counter_argument_draft_versions_draft_version_idx").on(
			table.draftId,
			table.version,
		),
		index("counter_argument_draft_versions_draft_created_idx").on(
			table.draftId,
			table.createdAt,
		),
	],
);

export const auditEvents = pgTable(
	"audit_events",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		entityType: text("entity_type").notNull(),
		entityId: uuid("entity_id").notNull(),
		action: text("action").notNull(),
		payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("audit_events_entity_idx").on(table.entityType, table.entityId),
		index("audit_events_entity_created_idx").on(
			table.entityType,
			table.entityId,
			table.createdAt,
		),
	],
);

export const cronHeartbeats = pgTable("cron_heartbeats", {
	serviceName: text("service_name").primaryKey(),
	lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
	metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
});

export const managedSchedulerIntegrations = pgTable(
	"managed_scheduler_integrations",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		provider: text("provider").default("managed-scheduler").notNull(),
		tokenHash: text("token_hash").notNull(),
		tokenLastFour: text("token_last_four").notNull(),
		enabled: boolean("enabled").default(true).notNull(),
		setupMetadata: jsonb("setup_metadata")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("managed_scheduler_integrations_provider_unique").on(
			table.provider,
		),
	],
);

export const intelligenceDailyRollups = pgTable(
	"intelligence_daily_rollups",
	{
		day: date("day").primaryKey(),
		scanCount: integer("scan_count").default(0).notNull(),
		queuedScanCount: integer("queued_scan_count").default(0).notNull(),
		runningScanCount: integer("running_scan_count").default(0).notNull(),
		completedScanCount: integer("completed_scan_count").default(0).notNull(),
		failedScanCount: integer("failed_scan_count").default(0).notNull(),
		retryingScanCount: integer("retrying_scan_count").default(0).notNull(),
		evidenceCount: integer("evidence_count").default(0).notNull(),
		highRiskEvidenceCount: integer("high_risk_evidence_count").default(0).notNull(),
		mediumRiskEvidenceCount: integer("medium_risk_evidence_count")
			.default(0)
			.notNull(),
		lowRiskEvidenceCount: integer("low_risk_evidence_count").default(0).notNull(),
		claimCount: integer("claim_count").default(0).notNull(),
		riskFlagCount: integer("risk_flag_count").default(0).notNull(),
		draftCount: integer("draft_count").default(0).notNull(),
		approvedDraftCount: integer("approved_draft_count").default(0).notNull(),
		reportReadyCount: integer("report_ready_count").default(0).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("intelligence_daily_rollups_updated_idx").on(table.updatedAt)],
);

export const intelligenceTopicRollups = pgTable(
	"intelligence_topic_rollups",
	{
		topicId: uuid("topic_id")
			.primaryKey()
			.references(() => topics.id, { onDelete: "cascade" }),
		slug: text("slug").notNull(),
		name: text("name").notNull(),
		riskLevel: riskLevelEnum("risk_level").default("medium").notNull(),
		trend: text("trend").default("stable").notNull(),
		momentumScore: integer("momentum_score").default(0).notNull(),
		evidenceCount: integer("evidence_count").default(0).notNull(),
		highRiskEvidenceCount: integer("high_risk_evidence_count").default(0).notNull(),
		claimCount: integer("claim_count").default(0).notNull(),
		scanCount: integer("scan_count").default(0).notNull(),
		sourceCount: integer("source_count").default(0).notNull(),
		firstSeenAt: timestamp("first_seen_at", { withTimezone: true }),
		lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("intelligence_topic_rollups_slug_unique").on(table.slug),
		index("intelligence_topic_rollups_priority_idx").on(
			table.riskLevel,
			table.momentumScore,
			table.evidenceCount,
		),
		index("intelligence_topic_rollups_last_seen_idx").on(table.lastSeenAt),
	],
);

export const intelligenceSourceRollups = pgTable(
	"intelligence_source_rollups",
	{
		sourceId: uuid("source_id")
			.primaryKey()
			.references(() => sources.id, { onDelete: "cascade" }),
		sourceLabel: text("source_label").notNull(),
		sourceType: sourceTypeEnum("source_type").notNull(),
		provider: providerNameEnum("provider"),
		health: text("health").default("unknown").notNull(),
		scanCount: integer("scan_count").default(0).notNull(),
		completedScanCount: integer("completed_scan_count").default(0).notNull(),
		failedScanCount: integer("failed_scan_count").default(0).notNull(),
		evidenceCount: integer("evidence_count").default(0).notNull(),
		highRiskEvidenceCount: integer("high_risk_evidence_count").default(0).notNull(),
		lastScanJobId: uuid("last_scan_job_id").references(() => scanJobs.id, {
			onDelete: "set null",
		}),
		lastScannedAt: timestamp("last_scanned_at", { withTimezone: true }),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("intelligence_source_rollups_health_idx").on(
			table.health,
			table.lastScannedAt,
		),
		index("intelligence_source_rollups_provider_idx").on(table.provider),
	],
);

export const intelligenceProviderRollups = pgTable(
	"intelligence_provider_rollups",
	{
		provider: providerNameEnum("provider").primaryKey(),
		health: text("health").default("unknown").notNull(),
		scanCount: integer("scan_count").default(0).notNull(),
		completedRunCount: integer("completed_run_count").default(0).notNull(),
		failedRunCount: integer("failed_run_count").default(0).notNull(),
		avgDurationMs: integer("avg_duration_ms").default(0).notNull(),
		lastStatus: scanStatusEnum("last_status"),
		lastRunAt: timestamp("last_run_at", { withTimezone: true }),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("intelligence_provider_rollups_health_idx").on(
			table.health,
			table.lastRunAt,
		),
	],
);

export const intelligenceClaimIndex = pgTable(
	"intelligence_claim_index",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		claimKey: text("claim_key").notNull(),
		claim: text("claim").notNull(),
		stance: text("stance").default("neutral").notNull(),
		confidence: integer("confidence").default(0).notNull(),
		riskLevel: riskLevelEnum("risk_level").default("medium").notNull(),
		scanJobId: uuid("scan_job_id").references(() => scanJobs.id, {
			onDelete: "cascade",
		}),
		analysisId: uuid("analysis_id").references(() => analyses.id, {
			onDelete: "cascade",
		}),
		evidenceIds: jsonb("evidence_ids").$type<string[]>().default([]).notNull(),
		evidenceCount: integer("evidence_count").default(0).notNull(),
		topicSlugs: jsonb("topic_slugs").$type<string[]>().default([]).notNull(),
		sourceLabels: jsonb("source_labels").$type<string[]>().default([]).notNull(),
		deepLink: text("deep_link").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("intelligence_claim_index_key_unique").on(table.claimKey),
		index("intelligence_claim_index_risk_idx").on(
			table.riskLevel,
			table.confidence,
		),
		index("intelligence_claim_index_scan_idx").on(table.scanJobId),
	],
);

export const intelligenceActivityRollups = pgTable(
	"intelligence_activity_rollups",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		entityType: text("entity_type").notNull(),
		entityId: uuid("entity_id").notNull(),
		action: text("action").notNull(),
		severity: riskLevelEnum("severity").default("medium").notNull(),
		title: text("title").notNull(),
		description: text("description").notNull(),
		href: text("href").notNull(),
		occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("intelligence_activity_rollups_time_idx").on(table.occurredAt),
		index("intelligence_activity_rollups_entity_idx").on(
			table.entityType,
			table.entityId,
		),
		index("intelligence_activity_rollups_severity_idx").on(table.severity),
	],
);

export type SourceType = (typeof sourceTypeEnum.enumValues)[number];
export type ProviderName = (typeof providerNameEnum.enumValues)[number];
export type ScanStatus = (typeof scanStatusEnum.enumValues)[number];
export type RiskLevel = (typeof riskLevelEnum.enumValues)[number];
export type DraftStatus = (typeof draftStatusEnum.enumValues)[number];
export type EvidenceTriageStatus =
	(typeof evidenceTriageStatusEnum.enumValues)[number];

export type SourceRow = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type ScanJobRow = typeof scanJobs.$inferSelect;
export type TrackedSourceRow = typeof trackedSources.$inferSelect;
export type FacebookPageProfileRow = typeof facebookPageProfiles.$inferSelect;
export type EvidenceItemRow = typeof evidenceItems.$inferSelect;
export type ScanJobEventRow = typeof scanJobEvents.$inferSelect;
export type EvidenceTriageRow = typeof evidenceTriage.$inferSelect;
export type EvidenceTriageNoteRow = typeof evidenceTriageNotes.$inferSelect;
export type AnalysisRow = typeof analyses.$inferSelect;
export type TopicRow = typeof topics.$inferSelect;
export type EvidenceTopicRow = typeof evidenceTopics.$inferSelect;
export type CounterArgumentDraftRow = typeof counterArgumentDrafts.$inferSelect;
export type DraftAutomationJobRow = typeof draftAutomationJobs.$inferSelect;
export type ManagedSchedulerIntegrationRow =
	typeof managedSchedulerIntegrations.$inferSelect;
export type IntelligenceDailyRollupRow =
	typeof intelligenceDailyRollups.$inferSelect;
export type IntelligenceTopicRollupRow =
	typeof intelligenceTopicRollups.$inferSelect;
export type IntelligenceSourceRollupRow =
	typeof intelligenceSourceRollups.$inferSelect;
export type IntelligenceProviderRollupRow =
	typeof intelligenceProviderRollups.$inferSelect;
export type IntelligenceClaimIndexRow =
	typeof intelligenceClaimIndex.$inferSelect;
export type IntelligenceActivityRollupRow =
	typeof intelligenceActivityRollups.$inferSelect;
