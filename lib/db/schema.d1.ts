import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { isoTimestamp, sqliteEnum } from "./sqlite-columns.ts";
import { sql } from "drizzle-orm";

export const sourceTypeEnum = sqliteEnum("source_type", [
	"url",
	"facebook_post",
	"facebook_group",
	"facebook_page",
	"social",
	"file",
	"text",
]);

export const providerNameEnum = sqliteEnum("provider_name", [
	"apify_facebook_posts",
	"apify_facebook_comments",
	"apify_facebook_groups",
	"firecrawl",
	"firecrawl_parse",
	"browser_use",
	"local_text",
]);

export const scanStatusEnum = sqliteEnum("scan_status", [
	"queued",
	"running",
	"completed",
	"failed",
	"retrying",
]);

export const riskLevelEnum = sqliteEnum("risk_level", ["low", "medium", "high"]);

export const draftStatusEnum = sqliteEnum("draft_status", [
	"draft",
	"needs_review",
	"approved",
	"rejected",
]);

export const draftKindEnum = sqliteEnum("draft_kind", [
	"response",
	"comment",
	"counter_argument",
	"internal_brief",
]);

export const facebookPageClassificationEnum = sqliteEnum(
	"facebook_page_classification",
	["uncategorized", "trusted", "neutral", "at_risk"],
);

export const draftAutomationStatusEnum = sqliteEnum("draft_automation_status", [
	"queued",
	"running",
	"completed",
	"failed",
	"retrying",
	"skipped",
]);

export const chatVisibilityEnum = sqliteEnum("chat_visibility", [
	"private",
	"workspace",
]);

export const chatAttachmentStatusEnum = sqliteEnum("chat_attachment_status", [
	"pending_upload",
	"uploading",
	"processing",
	"ready",
	"failed",
	"deleting",
	"deleted",
]);

export const chatRunStatusEnum = sqliteEnum("chat_run_status", [
	"running",
	"completed",
	"failed",
	"aborted",
]);

export const articleReviewStatusEnum = sqliteEnum("article_review_status", [
	"draft",
	"needs_review",
	"approved",
	"rejected",
]);

export const articleStateEnum = sqliteEnum("article_state", [
	"draft",
	"published",
	"archived",
]);

export const articlePublicationStatusEnum = sqliteEnum(
	"article_publication_status",
	[
		"not_synced",
		"syncing",
		"hidden",
		"scheduled",
		"publishing",
		"published",
		"failed",
	],
);

export const articlePublicationOperationEnum = sqliteEnum(
	"article_publication_operation",
	["sync_hidden", "publish", "hide", "update_visible"],
);

export const articlePublicationJobStatusEnum = sqliteEnum(
	"article_publication_job_status",
	["queued", "running", "completed", "retrying", "failed", "cancelled"],
);

export const promptPresetVisibilityEnum = sqliteEnum("prompt_preset_visibility", [
	"private",
	"workspace",
]);

export const localAccountRoleEnum = sqliteEnum("local_account_role", [
	"admin",
	"member",
]);

export const evidenceTriageStatusEnum = sqliteEnum("evidence_triage_status", [
	"new",
	"reviewing",
	"action_required",
	"resolved",
	"dismissed",
]);

export const sources = sqliteTable("sources", {
		revision: integer("_revision").notNull().default(0),
	id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
	type: sourceTypeEnum("type").notNull(),
	originalInput: text("original_input").notNull(),
	normalizedUrl: text("normalized_url"),
	title: text("title"),
	mimeType: text("mime_type"),
	fileName: text("file_name"),
	fileText: text("file_text"),
	metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>().default({}).notNull(),
	createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
});

export const scanJobs = sqliteTable(
	"scan_jobs",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		sourceId: text("source_id")
			.notNull()
			.references(() => sources.id, { onDelete: "cascade" }),
		status: scanStatusEnum("status").default("queued").notNull(),
		provider: providerNameEnum("provider").notNull(),
		priority: integer("priority").default(0).notNull(),
		attempts: integer("attempts").default(0).notNull(),
		maxAttempts: integer("max_attempts").default(3).notNull(),
		scheduledAt: isoTimestamp("scheduled_at")
			.$defaultFn(() => new Date())
			.notNull(),
		startedAt: isoTimestamp("started_at"),
		completedAt: isoTimestamp("completed_at"),
		lockedAt: isoTimestamp("locked_at"),
		errorMessage: text("error_message"),
		clientRequestId: text("client_request_id"),
		parentScanJobId: text("parent_scan_job_id"),
		requestedByUserId: text("requested_by_user_id"),
		requestedByDisplayName: text("requested_by_display_name"),
		trigger: text("trigger").default("manual").notNull(),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
		updatedAt: isoTimestamp("updated_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [
		index("scan_jobs_queue_idx").on(table.status, table.scheduledAt, table.priority),
		index("scan_jobs_source_idx").on(table.sourceId),
		index("scan_jobs_parent_idx").on(table.parentScanJobId),
		uniqueIndex("scan_jobs_client_request_unique")
			.on(table.clientRequestId)
			.where(sql`${table.clientRequestId} is not null`),
		index("scan_jobs_status_created_idx").on(table.status, table.createdAt),
		index("scan_jobs_created_at_idx").on(table.createdAt),
	],
);

export const trackedSources = sqliteTable(
	"tracked_sources",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		displayName: text("display_name").notNull(),
		normalizedUrl: text("normalized_url").notNull(),
		type: sourceTypeEnum("type").notNull(),
		provider: providerNameEnum("provider").notNull(),
		isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
		lastScanJobId: text("last_scan_job_id").references(() => scanJobs.id, {
			onDelete: "set null",
		}),
		lastScanStatus: scanStatusEnum("last_scan_status"),
		lastScannedAt: isoTimestamp("last_scanned_at"),
		metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>().default({}).notNull(),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
		updatedAt: isoTimestamp("updated_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [
		uniqueIndex("tracked_sources_url_unique").on(table.normalizedUrl),
		index("tracked_sources_active_idx").on(table.isActive, table.updatedAt),
		index("tracked_sources_last_scan_idx").on(table.lastScanJobId),
	],
);

export const facebookPageProfiles = sqliteTable(
	"facebook_page_profiles",
	{
		revision: integer("_revision").notNull().default(0),
		pageKey: text("page_key").primaryKey(),
		facebookPageId: text("facebook_page_id"),
		username: text("username"),
		displayName: text("display_name").notNull(),
		classification: facebookPageClassificationEnum("classification")
			.default("uncategorized")
			.notNull(),
		autoDraftEnabled: integer("auto_draft_enabled", { mode: "boolean" }).default(false).notNull(),
		updatedByUserId: text("updated_by_user_id").notNull(),
		updatedByDisplayName: text("updated_by_display_name"),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
		updatedAt: isoTimestamp("updated_at").$defaultFn(() => new Date()).notNull(),
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

export const providerRuns = sqliteTable(
	"provider_runs",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		scanJobId: text("scan_job_id")
			.notNull()
			.references(() => scanJobs.id, { onDelete: "cascade" }),
		provider: providerNameEnum("provider").notNull(),
		status: scanStatusEnum("status").default("running").notNull(),
		input: text("input", { mode: "json" }).$type<Record<string, unknown>>().default({}).notNull(),
		output: text("output", { mode: "json" }).$type<Record<string, unknown>>().default({}).notNull(),
		errorMessage: text("error_message"),
		startedAt: isoTimestamp("started_at").$defaultFn(() => new Date()).notNull(),
		completedAt: isoTimestamp("completed_at"),
	},
	(table) => [
		index("provider_runs_job_idx").on(table.scanJobId),
		index("provider_runs_job_started_idx").on(table.scanJobId, table.startedAt),
	],
);

export const scanJobEvents = sqliteTable(
	"scan_job_events",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		scanJobId: text("scan_job_id")
			.notNull()
			.references(() => scanJobs.id, { onDelete: "cascade" }),
		eventType: text("event_type").notNull(),
		stage: text("stage").notNull(),
		status: text("status").notNull(),
		message: text("message").notNull(),
		metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>().default({}).notNull(),
		occurredAt: isoTimestamp("occurred_at").$defaultFn(() => new Date()).notNull(),
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

export const evidenceItems = sqliteTable(
	"evidence_items",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		scanJobId: text("scan_job_id")
			.notNull()
			.references(() => scanJobs.id, { onDelete: "cascade" }),
		sourceId: text("source_id")
			.notNull()
			.references(() => sources.id, { onDelete: "cascade" }),
		provider: providerNameEnum("provider").notNull(),
		sourceUrl: text("source_url"),
		sourceLabel: text("source_label"),
		author: text("author"),
		publishedAt: isoTimestamp("published_at"),
		quote: text("quote").notNull(),
		summary: text("summary").notNull(),
		engagement: text("engagement", { mode: "json" })
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		stance: text("stance").default("neutral").notNull(),
		sentiment: text("sentiment").default("neutral").notNull(),
		riskLevel: riskLevelEnum("risk_level").default("medium").notNull(),
		metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>().default({}).notNull(),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
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

	],
);

export const evidenceSemanticProfiles = sqliteTable(
	"evidence_semantic_profiles",
	{
		revision: integer("_revision").notNull().default(0),
		evidenceItemId: text("evidence_item_id")
			.primaryKey()
			.references(() => evidenceItems.id, { onDelete: "cascade" }),
		contentHash: text("content_hash").notNull(),
		embedding: text("embedding", { mode: "json" }).$type<number[]>().notNull(),
		model: text("model").notNull(),
		updatedAt: isoTimestamp("updated_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [

		index("evidence_semantic_profiles_updated_idx").on(table.updatedAt),
	],
);

export const evidenceTriage = sqliteTable(
	"evidence_triage",
	{
		revision: integer("_revision").notNull().default(0),
		evidenceItemId: text("evidence_item_id")
			.primaryKey()
			.references(() => evidenceItems.id, { onDelete: "cascade" }),
		status: evidenceTriageStatusEnum("status").default("new").notNull(),
		isPinned: integer("is_pinned", { mode: "boolean" }).default(false).notNull(),
		assigneeUserId: text("assignee_user_id"),
		assigneeDisplayName: text("assignee_display_name"),
		dueAt: isoTimestamp("due_at"),
		updatedByUserId: text("updated_by_user_id").notNull(),
		updatedByDisplayName: text("updated_by_display_name"),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
		updatedAt: isoTimestamp("updated_at").$defaultFn(() => new Date()).notNull(),
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

export const evidenceTriageNotes = sqliteTable(
	"evidence_triage_notes",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		evidenceItemId: text("evidence_item_id")
			.notNull()
			.references(() => evidenceItems.id, { onDelete: "cascade" }),
		authorUserId: text("author_user_id").notNull(),
		authorDisplayName: text("author_display_name"),
		body: text("body").notNull(),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [
		index("evidence_triage_notes_evidence_created_idx").on(
			table.evidenceItemId,
			table.createdAt,
		),
	],
);

export const analyses = sqliteTable(
	"analyses",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		scanJobId: text("scan_job_id")
			.notNull()
			.references(() => scanJobs.id, { onDelete: "cascade" }),
		riskLevel: riskLevelEnum("risk_level").default("medium").notNull(),
		summary: text("summary").notNull(),
		stanceSummary: text("stance_summary").notNull(),
		topicClusters: text("topic_clusters", { mode: "json" }).$type<unknown[]>().default([]).notNull(),
		claims: text("claims", { mode: "json" }).$type<unknown[]>().default([]).notNull(),
		riskFlags: text("risk_flags", { mode: "json" }).$type<unknown[]>().default([]).notNull(),
		sentiment: text("sentiment", { mode: "json" }).$type<Record<string, unknown>>().default({}).notNull(),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [uniqueIndex("analyses_job_unique").on(table.scanJobId)],
);

export const topics = sqliteTable(
	"topics",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		slug: text("slug").notNull(),
		name: text("name").notNull(),
		riskLevel: riskLevelEnum("risk_level").default("medium").notNull(),
		trend: text("trend").default("stable").notNull(),
		evidenceCount: integer("evidence_count").default(0).notNull(),
		firstSeenAt: isoTimestamp("first_seen_at")
			.$defaultFn(() => new Date())
			.notNull(),
		lastSeenAt: isoTimestamp("last_seen_at")
			.$defaultFn(() => new Date())
			.notNull(),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
		updatedAt: isoTimestamp("updated_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [
		uniqueIndex("topics_slug_unique").on(table.slug),
		index("topics_priority_idx").on(table.riskLevel, table.evidenceCount),
	],
);

export const evidenceTopics = sqliteTable(
	"evidence_topics",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		evidenceItemId: text("evidence_item_id")
			.notNull()
			.references(() => evidenceItems.id, { onDelete: "cascade" }),
		topicId: text("topic_id")
			.notNull()
			.references(() => topics.id, { onDelete: "cascade" }),
		scanJobId: text("scan_job_id")
			.notNull()
			.references(() => scanJobs.id, { onDelete: "cascade" }),
		confidence: integer("confidence").default(0).notNull(),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
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

export const chatConversations = sqliteTable(
	"chat_conversations",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		ownerUserId: text("owner_user_id").notNull(),
		ownerDisplayName: text("owner_display_name"),
		title: text("title").default("Cuộc trò chuyện mới").notNull(),
		visibility: chatVisibilityEnum("visibility").default("private").notNull(),
		forkedFromId: text("forked_from_id"),
		sharedAt: isoTimestamp("shared_at"),
		archivedAt: isoTimestamp("archived_at"),
		deletedAt: isoTimestamp("deleted_at"),
		lastMessageAt: isoTimestamp("last_message_at"),
		model: text("model"),
		temperature: integer("temperature").default(70).notNull(),
		contextBudget: integer("context_budget").default(32000).notNull(),
		pinnedContext: text("pinned_context", { mode: "json" })
			.$type<
				Array<{
					href?: string;
					id: string;
					label: string;
					type: "scan" | "evidence" | "topic" | "draft" | "article";
				}>
			>()
			.default([])
			.notNull(),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
		updatedAt: isoTimestamp("updated_at").$defaultFn(() => new Date()).notNull(),
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

export const aiPromptPresets = sqliteTable(
	"ai_prompt_presets",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		ownerUserId: text("owner_user_id").notNull(),
		ownerDisplayName: text("owner_display_name"),
		name: text("name").notNull(),
		description: text("description"),
		instructions: text("instructions").notNull(),
		tone: text("tone"),
		voice: text("voice"),
		visibility: promptPresetVisibilityEnum("visibility").default("private").notNull(),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
		updatedAt: isoTimestamp("updated_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [
		index("ai_prompt_presets_owner_updated_idx").on(
			table.ownerUserId,
			table.updatedAt,
		),
		index("ai_prompt_presets_visibility_updated_idx").on(
			table.visibility,
			table.updatedAt,
		),
	],
);

export const chatMessages = sqliteTable(
	"chat_messages",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		conversationId: text("conversation_id")
			.notNull()
			.references(() => chatConversations.id, { onDelete: "cascade" }),
		role: text("role").notNull(),
		parts: text("parts", { mode: "json" }).$type<unknown[]>().default([]).notNull(),
		metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>().default({}).notNull(),
		actorUserId: text("actor_user_id"),
		actorDisplayName: text("actor_display_name"),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [
		index("chat_messages_conversation_created_idx").on(
			table.conversationId,
			table.createdAt,
			table.id,
		),
	],
);

export const chatAttachments = sqliteTable(
	"chat_attachments",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		conversationId: text("conversation_id")
			.notNull()
			.references(() => chatConversations.id, { onDelete: "cascade" }),
		messageId: text("message_id").references(() => chatMessages.id, {
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
		scheduledAt: isoTimestamp("scheduled_at").$defaultFn(() => new Date()).notNull(),
		lockedAt: isoTimestamp("locked_at"),
		processedAt: isoTimestamp("processed_at"),
		deleteRequestedAt: isoTimestamp("delete_requested_at"),
		deletedAt: isoTimestamp("deleted_at"),
		errorMessage: text("error_message"),
		extractionMetadata: text("extraction_metadata", { mode: "json" })
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
		updatedAt: isoTimestamp("updated_at").$defaultFn(() => new Date()).notNull(),
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

export const chatAttachmentChunks = sqliteTable(
	"chat_attachment_chunks",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		attachmentId: text("attachment_id")
			.notNull()
			.references(() => chatAttachments.id, { onDelete: "cascade" }),
		ordinal: integer("ordinal").notNull(),
		content: text("content").notNull(),
		metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>().default({}).notNull(),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [
		uniqueIndex("chat_attachment_chunks_attachment_ordinal_idx").on(
			table.attachmentId,
			table.ordinal,
		),

	],
);

export const chatModelRuns = sqliteTable(
	"chat_model_runs",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		conversationId: text("conversation_id")
			.notNull()
			.references(() => chatConversations.id, { onDelete: "cascade" }),
		userMessageId: text("user_message_id").references(() => chatMessages.id, {
			onDelete: "set null",
		}),
		assistantMessageId: text("assistant_message_id").references(
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
		startedAt: isoTimestamp("started_at").$defaultFn(() => new Date()).notNull(),
		completedAt: isoTimestamp("completed_at"),
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

export const chatToolRuns = sqliteTable(
	"chat_tool_runs",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		modelRunId: text("model_run_id")
			.notNull()
			.references(() => chatModelRuns.id, { onDelete: "cascade" }),
		toolCallId: text("tool_call_id").notNull(),
		toolName: text("tool_name").notNull(),
		status: text("status").notNull(),
		inputSummary: text("input_summary", { mode: "json" }).$type<Record<string, unknown>>().default({}).notNull(),
		outputSummary: text("output_summary", { mode: "json" }).$type<Record<string, unknown>>().default({}).notNull(),
		errorMessage: text("error_message"),
		startedAt: isoTimestamp("started_at").$defaultFn(() => new Date()).notNull(),
		completedAt: isoTimestamp("completed_at"),
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

export const counterArgumentDrafts = sqliteTable(
	"counter_argument_drafts",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		scanJobId: text("scan_job_id")
			.notNull()
			.references(() => scanJobs.id, { onDelete: "cascade" }),
		status: draftStatusEnum("status").default("draft").notNull(),
		draftKind: draftKindEnum("draft_kind").default("counter_argument").notNull(),
		evidenceItemId: text("evidence_item_id").references(() => evidenceItems.id, {
			onDelete: "set null",
		}),
		originatingChatId: text("originating_chat_id").references(
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
		voice: text("voice").default("Tự nhiên, gần gũi").notNull(),
		audience: text("audience").notNull(),
		language: text("language").default("vi").notNull(),
		length: text("length").default("medium").notNull(),
		operatorNotes: text("operator_notes"),
		body: text("body").notNull(),
		citations: text("citations", { mode: "json" }).$type<unknown[]>().default([]).notNull(),
		safetyNotes: text("safety_notes", { mode: "json" }).$type<unknown[]>().default([]).notNull(),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
		updatedAt: isoTimestamp("updated_at").$defaultFn(() => new Date()).notNull(),
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

export const draftAutomationJobs = sqliteTable(
	"draft_automation_jobs",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		evidenceItemId: text("evidence_item_id")
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
		scheduledAt: isoTimestamp("scheduled_at")
			.$defaultFn(() => new Date())
			.notNull(),
		lockedAt: isoTimestamp("locked_at"),
		draftId: text("draft_id").references(() => counterArgumentDrafts.id, {
			onDelete: "set null",
		}),
		errorMessage: text("error_message"),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
		updatedAt: isoTimestamp("updated_at").$defaultFn(() => new Date()).notNull(),
		completedAt: isoTimestamp("completed_at"),
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

export const counterArgumentDraftVersions = sqliteTable(
	"counter_argument_draft_versions",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		draftId: text("draft_id")
			.notNull()
			.references(() => counterArgumentDrafts.id, { onDelete: "cascade" }),
		version: integer("version").notNull(),
		body: text("body").notNull(),
		citations: text("citations", { mode: "json" }).$type<unknown[]>().default([]).notNull(),
		safetyNotes: text("safety_notes", { mode: "json" }).$type<unknown[]>().default([]).notNull(),
		actorUserId: text("actor_user_id").notNull(),
		actorDisplayName: text("actor_display_name"),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
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

export const zaloOaConnections = sqliteTable(
	"zalo_oa_connections",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		oaId: text("oa_id").notNull(),
		displayName: text("display_name").notNull(),
		avatarUrl: text("avatar_url"),
		accessTokenEncrypted: text("access_token_encrypted").notNull(),
		refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
		accessTokenExpiresAt: isoTimestamp("access_token_expires_at").notNull(),
		refreshTokenExpiresAt: isoTimestamp("refresh_token_expires_at").notNull(),
		scopes: text("scopes", { mode: "json" }).$type<string[]>().default([]).notNull(),
		isDefault: integer("is_default", { mode: "boolean" }).default(false).notNull(),
		autoSyncDrafts: integer("auto_sync_drafts", { mode: "boolean" }).default(false).notNull(),
		status: text("status").default("connected").notNull(),
		lastError: text("last_error"),
		connectedByUserId: text("connected_by_user_id").notNull(),
		connectedByDisplayName: text("connected_by_display_name"),
		updatedByUserId: text("updated_by_user_id").notNull(),
		updatedByDisplayName: text("updated_by_display_name"),
		lastRefreshedAt: isoTimestamp("last_refreshed_at"),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
		updatedAt: isoTimestamp("updated_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [
		uniqueIndex("zalo_oa_connections_oa_unique").on(table.oaId),
		uniqueIndex("zalo_oa_connections_default_unique")
			.on(table.isDefault)
			.where(sql`${table.isDefault} = true`),
		index("zalo_oa_connections_status_updated_idx").on(
			table.status,
			table.updatedAt,
		),
	],
);

export const articles = sqliteTable(
	"articles",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		title: text("title").default("").notNull(),
		author: text("author").default("").notNull(),
		description: text("description").default("").notNull(),
		coverUrl: text("cover_url"),
		coverStoragePath: text("cover_storage_path"),
		blocks: text("blocks", { mode: "json" })
			.$type<
				Array<
					| { id: string; type: "text"; content: string }
					| { id: string; type: "image"; url: string; caption?: string }
				>
			>()
			.default([])
			.notNull(),
		commentsEnabled: integer("comments_enabled", { mode: "boolean" }).default(true).notNull(),
		reviewStatus: articleReviewStatusEnum("review_status")
			.default("draft")
			.notNull(),
		state: articleStateEnum("state").default("draft").notNull(),
		draftKind: draftKindEnum("draft_kind"),
		generationReason: text("generation_reason"),
		tone: text("tone"),
		voice: text("voice"),
		audience: text("audience"),
		language: text("language").default("vi").notNull(),
		operatorNotes: text("operator_notes"),
		citations: text("citations", { mode: "json" }).$type<unknown[]>().default([]).notNull(),
		safetyNotes: text("safety_notes", { mode: "json" }).$type<unknown[]>().default([]).notNull(),
		automationKey: text("automation_key"),
		cmsEntryId: text("cms_entry_id"),
		publicationStatus: articlePublicationStatusEnum("publication_status")
			.default("not_synced")
			.notNull(),
		targetOaConnectionId: text("target_oa_connection_id").references(
			() => zaloOaConnections.id,
			{ onDelete: "set null" },
		),
		originScanJobId: text("origin_scan_job_id").references(() => scanJobs.id, {
			onDelete: "set null",
		}),
		originEvidenceItemId: text("origin_evidence_item_id").references(
			() => evidenceItems.id,
			{ onDelete: "set null" },
		),
		originDraftId: text("origin_draft_id").references(
			() => counterArgumentDrafts.id,
			{ onDelete: "set null" },
		),
		originatingChatId: text("originating_chat_id").references(
			() => chatConversations.id,
			{ onDelete: "set null" },
		),
		remoteArticleId: text("remote_article_id"),
		remoteOperationToken: text("remote_operation_token"),
		contentHash: text("content_hash").notNull(),
		syncedContentHash: text("synced_content_hash"),
		scheduledAt: isoTimestamp("scheduled_at"),
		lastSyncedAt: isoTimestamp("last_synced_at"),
		publishedAt: isoTimestamp("published_at"),
		remoteSnapshot: text("remote_snapshot", { mode: "json" })
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		lastError: text("last_error"),
		createdByUserId: text("created_by_user_id").notNull(),
		createdByDisplayName: text("created_by_display_name"),
		updatedByUserId: text("updated_by_user_id").notNull(),
		updatedByDisplayName: text("updated_by_display_name"),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
		updatedAt: isoTimestamp("updated_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [
		index("articles_status_updated_idx").on(
			table.publicationStatus,
			table.updatedAt,
		),
		index("articles_review_updated_idx").on(table.reviewStatus, table.updatedAt),
		index("articles_state_updated_idx").on(table.state, table.updatedAt),
		uniqueIndex("articles_automation_key_unique")
			.on(table.automationKey)
			.where(sql`${table.automationKey} is not null`),
		index("articles_oa_updated_idx").on(
			table.targetOaConnectionId,
			table.updatedAt,
		),
		index("articles_schedule_idx").on(table.publicationStatus, table.scheduledAt),
		index("articles_remote_idx").on(table.remoteArticleId),
		uniqueIndex("articles_origin_draft_unique")
			.on(table.originDraftId)
			.where(sql`${table.originDraftId} is not null`),
	],
);

export const articleVersions = sqliteTable(
	"article_versions",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		articleId: text("article_id")
			.notNull()
			.references(() => articles.id, { onDelete: "cascade" }),
		version: integer("version").notNull(),
		origin: text("origin").default("manual").notNull(),
		instruction: text("instruction"),
		snapshot: text("snapshot", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
		actorUserId: text("actor_user_id").notNull(),
		actorDisplayName: text("actor_display_name"),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [
		uniqueIndex("article_versions_article_version_unique").on(
			table.articleId,
			table.version,
		),
		index("article_versions_article_created_idx").on(
			table.articleId,
			table.createdAt,
		),
	],
);

export const articleMedia = sqliteTable(
	"article_media",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		articleId: text("article_id")
			.notNull()
			.references(() => articles.id, { onDelete: "cascade" }),
		kind: text("kind").notNull(),
		fileName: text("file_name").notNull(),
		contentType: text("content_type").notNull(),
		sizeBytes: integer("size_bytes").notNull(),
		drivePath: text("drive_path"),
		storageProvider: text("storage_provider"),
		sourceUrl: text("source_url"),
		cmsAssetId: text("cms_asset_id"),
		cmsEntryId: text("cms_entry_id"),
		storagePath: text("storage_path"),
		deliveryUrl: text("delivery_url"),
		altText: text("alt_text"),
		caption: text("caption"),
		createdByUserId: text("created_by_user_id").notNull(),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [index("article_media_article_created_idx").on(table.articleId, table.createdAt)],
);

export const articleEvidence = sqliteTable(
	"article_evidence",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		articleId: text("article_id")
			.notNull()
			.references(() => articles.id, { onDelete: "cascade" }),
		evidenceItemId: text("evidence_item_id")
			.notNull()
			.references(() => evidenceItems.id, { onDelete: "cascade" }),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [
		uniqueIndex("article_evidence_unique").on(
			table.articleId,
			table.evidenceItemId,
		),
		index("article_evidence_evidence_idx").on(table.evidenceItemId),
	],
);

export const articlePublicationJobs = sqliteTable(
	"article_publication_jobs",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		articleId: text("article_id")
			.notNull()
			.references(() => articles.id, { onDelete: "cascade" }),
		operation: articlePublicationOperationEnum("operation").notNull(),
		status: articlePublicationJobStatusEnum("status").default("queued").notNull(),
		scheduledAt: isoTimestamp("scheduled_at")
			.$defaultFn(() => new Date())
			.notNull(),
		attempts: integer("attempts").default(0).notNull(),
		maxAttempts: integer("max_attempts").default(4).notNull(),
		lockedAt: isoTimestamp("locked_at"),
		remoteOperationToken: text("remote_operation_token"),
		requestFingerprint: text("request_fingerprint").notNull(),
		errorMessage: text("error_message"),
		requestedByUserId: text("requested_by_user_id").notNull(),
		requestedByDisplayName: text("requested_by_display_name"),
		completedAt: isoTimestamp("completed_at"),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
		updatedAt: isoTimestamp("updated_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [
		index("article_publication_jobs_queue_idx").on(
			table.status,
			table.scheduledAt,
			table.lockedAt,
		),
		index("article_publication_jobs_article_idx").on(
			table.articleId,
			table.createdAt,
		),
		uniqueIndex("article_publication_jobs_fingerprint_unique").on(
			table.requestFingerprint,
		),
	],
);

export const auditEvents = sqliteTable(
	"audit_events",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		entityType: text("entity_type").notNull(),
		entityId: text("entity_id").notNull(),
		action: text("action").notNull(),
		payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().default({}).notNull(),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
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

export const cronHeartbeats = sqliteTable("cron_heartbeats", {
		revision: integer("_revision").notNull().default(0),
	serviceName: text("service_name").primaryKey(),
	lastSeenAt: isoTimestamp("last_seen_at").$defaultFn(() => new Date()).notNull(),
	metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>().default({}).notNull(),
});

export const managedSchedulerIntegrations = sqliteTable(
	"managed_scheduler_integrations",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		provider: text("provider").default("managed-scheduler").notNull(),
		tokenHash: text("token_hash").notNull(),
		tokenLastFour: text("token_last_four").notNull(),
		enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
		setupMetadata: text("setup_metadata", { mode: "json" })
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
		updatedAt: isoTimestamp("updated_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [
		uniqueIndex("managed_scheduler_integrations_provider_unique").on(
			table.provider,
		),
	],
);

/**
 * The written trend summary, kept where it survives.
 *
 * It lived in Next's `"use cache"`, which for a dynamic route handler is held
 * per serverless instance — and instances are short-lived and numerous, so
 * nearly every reader landed on a cold one and paid the forty seconds to
 * regenerate. Storing it makes the read a single indexed row.
 *
 * `fingerprint` is what the summary was computed from: the evidence count and
 * newest timestamp in the window. Matching means nothing has been collected
 * since, so the stored answer is still the right one and can be served
 * outright. Not matching means a scan has landed and it is worth regenerating —
 * which is the only thing that should trigger the cost.
 */
export const intelligenceSummaries = sqliteTable(
	"intelligence_summaries",
	{
		revision: integer("_revision").notNull().default(0),
		timeRange: text("time_range").primaryKey(),
		fingerprint: text("fingerprint").notNull(),
		payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
		model: text("model"),
		generatedAt: isoTimestamp("generated_at")
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(table) => [index("intelligence_summaries_generated_idx").on(table.generatedAt)],
);

export const intelligenceDailyRollups = sqliteTable(
	"intelligence_daily_rollups",
	{
		revision: integer("_revision").notNull().default(0),
		day: text("day").primaryKey(),
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
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
		updatedAt: isoTimestamp("updated_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [index("intelligence_daily_rollups_updated_idx").on(table.updatedAt)],
);

export const intelligenceTopicRollups = sqliteTable(
	"intelligence_topic_rollups",
	{
		revision: integer("_revision").notNull().default(0),
		topicId: text("topic_id")
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
		firstSeenAt: isoTimestamp("first_seen_at"),
		lastSeenAt: isoTimestamp("last_seen_at"),
		updatedAt: isoTimestamp("updated_at").$defaultFn(() => new Date()).notNull(),
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

export const intelligenceSourceRollups = sqliteTable(
	"intelligence_source_rollups",
	{
		revision: integer("_revision").notNull().default(0),
		sourceId: text("source_id")
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
		lastScanJobId: text("last_scan_job_id").references(() => scanJobs.id, {
			onDelete: "set null",
		}),
		lastScannedAt: isoTimestamp("last_scanned_at"),
		updatedAt: isoTimestamp("updated_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [
		index("intelligence_source_rollups_health_idx").on(
			table.health,
			table.lastScannedAt,
		),
		index("intelligence_source_rollups_provider_idx").on(table.provider),
	],
);

export const intelligenceProviderRollups = sqliteTable(
	"intelligence_provider_rollups",
	{
		revision: integer("_revision").notNull().default(0),
		provider: providerNameEnum("provider").primaryKey(),
		health: text("health").default("unknown").notNull(),
		scanCount: integer("scan_count").default(0).notNull(),
		completedRunCount: integer("completed_run_count").default(0).notNull(),
		failedRunCount: integer("failed_run_count").default(0).notNull(),
		avgDurationMs: integer("avg_duration_ms").default(0).notNull(),
		lastStatus: scanStatusEnum("last_status"),
		lastRunAt: isoTimestamp("last_run_at"),
		updatedAt: isoTimestamp("updated_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [
		index("intelligence_provider_rollups_health_idx").on(
			table.health,
			table.lastRunAt,
		),
	],
);

export const intelligenceClaimIndex = sqliteTable(
	"intelligence_claim_index",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		claimKey: text("claim_key").notNull(),
		claim: text("claim").notNull(),
		stance: text("stance").default("neutral").notNull(),
		confidence: integer("confidence").default(0).notNull(),
		riskLevel: riskLevelEnum("risk_level").default("medium").notNull(),
		scanJobId: text("scan_job_id").references(() => scanJobs.id, {
			onDelete: "cascade",
		}),
		analysisId: text("analysis_id").references(() => analyses.id, {
			onDelete: "cascade",
		}),
		evidenceIds: text("evidence_ids", { mode: "json" }).$type<string[]>().default([]).notNull(),
		evidenceCount: integer("evidence_count").default(0).notNull(),
		topicSlugs: text("topic_slugs", { mode: "json" }).$type<string[]>().default([]).notNull(),
		sourceLabels: text("source_labels", { mode: "json" }).$type<string[]>().default([]).notNull(),
		deepLink: text("deep_link").notNull(),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
		updatedAt: isoTimestamp("updated_at").$defaultFn(() => new Date()).notNull(),
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

export const intelligenceActivityRollups = sqliteTable(
	"intelligence_activity_rollups",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		entityType: text("entity_type").notNull(),
		entityId: text("entity_id").notNull(),
		action: text("action").notNull(),
		severity: riskLevelEnum("severity").default("medium").notNull(),
		title: text("title").notNull(),
		description: text("description").notNull(),
		href: text("href").notNull(),
		occurredAt: isoTimestamp("occurred_at").notNull(),
		metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>().default({}).notNull(),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
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

export const localAccounts = sqliteTable(
	"local_accounts",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		// Usernames are normalized to lowercase before they ever reach the database
		// so the unique index doubles as the case-insensitive login lookup.
		username: text("username").notNull(),
		displayName: text("display_name"),
		passwordHash: text("password_hash").notNull(),
		role: localAccountRoleEnum("role").default("member").notNull(),
		disabled: integer("disabled", { mode: "boolean" }).default(false).notNull(),
		mustChangePassword: integer("must_change_password", { mode: "boolean" }).default(false).notNull(),
		failedAttempts: integer("failed_attempts").default(0).notNull(),
		lockedUntil: isoTimestamp("locked_until"),
		lastLoginAt: isoTimestamp("last_login_at"),
		passwordUpdatedAt: isoTimestamp("password_updated_at")
			.$defaultFn(() => new Date())
			.notNull(),
		createdByUserId: text("created_by_user_id"),
		createdByDisplayName: text("created_by_display_name"),
		updatedByUserId: text("updated_by_user_id"),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
		updatedAt: isoTimestamp("updated_at").$defaultFn(() => new Date()).notNull(),
	},
	(table) => [
		uniqueIndex("local_accounts_username_idx").on(table.username),
		index("local_accounts_created_idx").on(table.createdAt),
	],
);

export const localAccountSessions = sqliteTable(
	"local_account_sessions",
	{
		revision: integer("_revision").notNull().default(0),
		id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
		accountId: text("account_id")
			.notNull()
			.references(() => localAccounts.id, { onDelete: "cascade" }),
		// Only the hash is stored, so a database leak cannot be replayed as a cookie.
		tokenHash: text("token_hash").notNull(),
		userAgent: text("user_agent"),
		createdAt: isoTimestamp("created_at").$defaultFn(() => new Date()).notNull(),
		lastSeenAt: isoTimestamp("last_seen_at").$defaultFn(() => new Date()).notNull(),
		expiresAt: isoTimestamp("expires_at").notNull(),
		revokedAt: isoTimestamp("revoked_at"),
	},
	(table) => [
		uniqueIndex("local_account_sessions_token_idx").on(table.tokenHash),
		index("local_account_sessions_account_idx").on(table.accountId),
		index("local_account_sessions_expiry_idx").on(table.expiresAt),
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
export type LocalAccountRole = (typeof localAccountRoleEnum.enumValues)[number];
export type LocalAccountRow = typeof localAccounts.$inferSelect;
export type LocalAccountSessionRow = typeof localAccountSessions.$inferSelect;
export type IntelligenceActivityRollupRow =
	typeof intelligenceActivityRollups.$inferSelect;

/** Dedicated provider-account daily totals, independent of scan retention. */
export const providerAccountCosts = sqliteTable("provider_account_costs", {
		revision: integer("_revision").notNull().default(0),
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  accountId: text("account_id").notNull(),
  day: text("day").notNull(),
  amountUsd: text("amount_usd").notNull(),
  observedAt: isoTimestamp("observed_at").notNull(),
  syncedAt: isoTimestamp("synced_at"),
  syncedWorkspaceId: text("synced_workspace_id"),
}, (table) => [uniqueIndex("provider_account_costs_account_day_idx").on(table.provider, table.accountId, table.day)]);
