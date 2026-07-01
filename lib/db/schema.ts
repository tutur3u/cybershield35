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
	(table) => [index("provider_runs_job_idx").on(table.scanJobId)],
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
		index("evidence_items_source_idx").on(table.sourceId),
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
	(table) => [index("counter_argument_drafts_job_idx").on(table.scanJobId)],
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
	(table) => [index("audit_events_entity_idx").on(table.entityType, table.entityId)],
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

export type SourceRow = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type ScanJobRow = typeof scanJobs.$inferSelect;
export type TrackedSourceRow = typeof trackedSources.$inferSelect;
export type EvidenceItemRow = typeof evidenceItems.$inferSelect;
export type AnalysisRow = typeof analyses.$inferSelect;
export type TopicRow = typeof topics.$inferSelect;
export type EvidenceTopicRow = typeof evidenceTopics.$inferSelect;
export type CounterArgumentDraftRow = typeof counterArgumentDrafts.$inferSelect;
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
