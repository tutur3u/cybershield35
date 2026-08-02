import type {
	AnalysisRow,
	CounterArgumentDraftRow,
	DraftStatus,
	EvidenceTriageStatus,
	EvidenceItemRow,
	ProviderName,
	RiskLevel,
	ScanStatus,
	SourceType,
} from "@/lib/db/schema";

export type DashboardPage =
	| "overview"
	| "operations"
	| "sources"
	| "analysis"
	| "topics"
	| "topic-detail"
	| "counter-arguments"
	| "chat"
	| "members"
	| "scan-detail"
	| "evidence"
	| "evidence-detail"
	| "draft-detail"
	| "alerts"
	| "reports"
	| "settings"
	| "audit"
	| "guide-process"
	| "guide-user"
	| "guide-policies";

export type OperationsQueueStatus = {
	completed: number;
	failed: number;
	queued: number;
	retrying: number;
	running: number;
};

export type OperationsServiceView = {
	ageSeconds: number | null;
	health: "healthy" | "stale" | "unknown";
	label: string;
	lastSeenAt: string | null;
	serviceName: string;
};

export type OperationsProviderView = {
	averageDurationMs: number;
	completed: number;
	failed: number;
	provider: ProviderName;
	running: number;
	successRate: number;
};

export type OperationsPipelineEventView = {
	eventType: string;
	id: string;
	message: string;
	metadata: Record<string, unknown>;
	occurredAt: string;
	scanHref: string;
	scanJobId: string;
	stage: string;
	status: string;
};

export type OperationsJobView = {
	attempts: number;
	createdAt: string;
	durationMs: number | null;
	errorMessage: string | null;
	id: string;
	latestEvent: OperationsPipelineEventView | null;
	maxAttempts: number;
	priority: number;
	provider: ProviderName;
	scheduledAt: string;
	sourceLabel: string;
	status: ScanStatus;
};

export type OperationsOverview = {
	chat: {
		attachmentsDeleting: number;
		attachmentsFailed: number;
		attachmentsProcessing: number;
		averageLatencyMs24h: number;
		failedRuns24h: number;
		runningRuns: number;
	};
	generatedAt: string;
	oldestQueuedAgeSeconds: number | null;
	oldestQueuedAt: string | null;
	pipelineEvents: OperationsPipelineEventView[];
	providers: OperationsProviderView[];
	queue: OperationsQueueStatus;
	recentJobs: OperationsJobView[];
	services: OperationsServiceView[];
	throughput24h: {
		averageDurationMs: number;
		completed: number;
		failed: number;
		successRate: number;
	};
};

export type AdminSessionView = {
	appName: string | null;
	authenticated: boolean;
	expiresAt: string;
	refreshExpiresAt: string;
	user: {
		avatarUrl: string | null;
		displayName: string | null;
		email: string | null;
		id: string;
	};
};

export type AuthViewState = {
	authenticated: boolean;
	configured?: boolean;
	error?: string;
	loginHref?: string;
	scopeApprovalHref?: string;
	session?: AdminSessionView;
};

export type WorkspaceMemberRole = "admin" | "member";

export type WorkspaceMemberView = {
	avatarUrl: string | null;
	displayName: string | null;
	email: string | null;
	id: string;
	isCreator: boolean;
	isCurrentUser: boolean;
	role: WorkspaceMemberRole;
	roleSources: Array<"admin" | "creator" | "default" | "role">;
};

export type WorkspaceInvitationView = {
	createdAt: string | null;
	email: string;
};

export type WorkspaceMembersResponse = {
	context: {
		canManageMembers: boolean;
		canManageRoles: boolean;
		defaultAdminEnabled: boolean;
	};
	invitations: WorkspaceInvitationView[];
	members: WorkspaceMemberView[];
};

export type ManagedSchedulerJobView = {
	active: boolean;
	failureCount: number;
	isOverdue?: boolean;
	jobId?: string | null;
	jobKey: string;
	lastExecution?: ManagedSchedulerExecutionView | null;
	lastRunAt: string | null;
	lastStatus: string | null;
	lockedByDeployment?: boolean;
	name: string;
	nextRunAt: string | null;
	overdueReason?: string | null;
	overdueSince?: string | null;
	remoteStatusUnknown?: boolean;
	schedule: string;
	scheduleDescription?: string;
	scheduleTimezone?: string;
};

export type ManagedSchedulerExecutionView = {
	durationMs: number | null;
	endedAt: string | null;
	error: string | null;
	httpStatus: number | null;
	id: string;
	jobId: string | null;
	jobKey: string;
	jobName: string;
	response: string | null;
	source: "manual" | "scheduled";
	startedAt: string | null;
	status: string;
};

export type ManagedSchedulerExecutionsView = {
	hasNextPage?: boolean;
	hasPreviousPage?: boolean;
	items: ManagedSchedulerExecutionView[];
	limit?: number;
	offset?: number;
	page?: number;
	pageCount?: number;
	total?: number;
};

export type ManagedSchedulerStatusView = {
	adminRecoveryHref?: string;
	adminRecoveryReason?: string;
	approvalHref?: string;
	approvalReason?: string;
	code?: string;
	configured: boolean;
	enabled: boolean;
	error?: string;
	generatedAt?: string | null;
	jobs: ManagedSchedulerJobView[];
	localStorageReady?: boolean;
	missingApprovalItems?: string[];
	remoteConfigured?: boolean;
	remoteStatusAvailable?: boolean;
	schedulerProvider?: "managed-scheduler" | "vercel-cron";
	setupDisabled?: boolean;
	setupDisabledReason?: string;
	setupOrigin?: string;
	serverNow?: string | null;
	tokenLastFour: string | null;
	updatedAt: string | null;
	upstreamStatus?: number;
};

export type DashboardInitialData = {
	detail: ScanDetail | null;
	loadError?: string;
	scans: DashboardScan[];
	selectedScanId: string;
	trackedSources: TrackedSourceView[];
};

export type DashboardScan = {
	id: string;
	status: ScanStatus;
	sourceType: SourceType;
	provider: ProviderName;
	title: string;
	sourceLabel: string;
	riskLevel: RiskLevel;
	progress: number;
	createdAt: string;
};

export type DashboardScansPage = {
	hasNextPage?: boolean;
	items: DashboardScan[];
	limit?: number;
	nextCursor?: string | null;
};

export type ScanDetail = {
	job?: Record<string, unknown>;
	source?: {
		title?: string | null;
		type?: string;
		normalizedUrl?: string | null;
		fileName?: string | null;
		createdAt?: string | Date;
	};
	analysis?: AnalysisView | AnalysisRow | null;
	evidence?: Array<Partial<EvidenceItemRow> & { id: string }>;
	drafts?: Array<Partial<CounterArgumentDraftRow> & { id: string }>;
	providerRuns?: Array<Record<string, unknown>>;
	audit?: Array<{
		id?: string;
		action?: string;
		createdAt?: string | Date;
		payload?: unknown;
	}>;
};

export type TopicCluster = {
	id?: string;
	name: string;
	count: number;
	trend: string;
	riskLevel: RiskLevel;
	slug?: string;
};

export type ClaimView = {
	claim: string;
	confidence: number;
	evidenceIds: string[];
	proofs?: AnalysisProofView[];
	rationale?: string;
	stance: string;
};

export type AnalysisProofView = {
	confidence: number;
	evidenceId: string;
	excerpt: string;
	limitation: string | null;
	support: string;
};

export type TopicView = {
	createdAt: string;
	evidenceCount: number;
	firstSeenAt: string;
	id: string;
	lastSeenAt: string;
	name: string;
	riskLevel: RiskLevel;
	slug: string;
	trend: string;
	updatedAt: string;
};

export type TopicsPage = {
	hasNextPage?: boolean;
	items: TopicView[];
	limit?: number;
	nextCursor?: string | null;
};

export type RiskFlagView = {
	label: string;
	count: number;
	confidence?: number;
	evidenceIds?: string[];
	proofs?: AnalysisProofView[];
	rationale?: string;
	severity: RiskLevel;
};

export type AnalysisView = Omit<
	Partial<AnalysisRow>,
	"claims" | "riskFlags" | "sentiment" | "topicClusters"
> & {
	claims: ClaimView[];
	riskLevel: RiskLevel;
	summary: string;
	stanceSummary: string;
	topicClusters: TopicCluster[];
	riskFlags: RiskFlagView[];
	sentiment: {
		positive: number;
		neutral: number;
		negative: number;
		total: number;
	};
};

export type DraftShape = {
	id: string;
	scanJobId?: string;
	status?: DraftStatus;
	tone?: string;
	voice?: string;
	audience?: string;
	language?: string;
	length?: string;
	operatorNotes?: string | null;
	body: string;
	citations?: unknown[];
	draftKind?: "response" | "comment" | "counter_argument" | "internal_brief";
	evidenceItemId?: string | null;
	safetyNotes?: unknown[];
	createdAt?: string | Date;
	updatedAt?: string | Date;
};

export type DraftRewriteLength =
	| "keep"
	| "slightly_longer"
	| "substantially_longer"
	| "shorter";

export type DraftRewriteResult = {
	draft: DraftShape | null;
	error: string | null;
};

export type EvidenceView = Array<
	Partial<EvidenceItemRow> & {
		id: string;
		topicConfidence?: number;
	}
>;

export type EvidenceItemsPage = {
	hasNextPage?: boolean;
	items: EvidenceView;
	limit?: number;
	nextCursor?: string | null;
	scanId: string;
};

export type IntelligenceTimeRange = "7d" | "30d" | "90d" | "all";

export type IntelligenceHealthState =
	| "healthy"
	| "attention"
	| "blocked"
	| "stale"
	| "unseen"
	| "unknown";

export type IntelligenceFilters = {
	facebookPage?: string;
	provider?: string;
	query?: string;
	risk?: RiskLevel | "all";
	source?: string;
	status?: string;
	timeRange?: IntelligenceTimeRange;
	topic?: string;
};

export type IntelligenceKpi = {
	description: string;
	help: string;
	href: string;
	id: string;
	label: string;
	tone: "accent" | "danger" | "neutral" | "success" | "warning";
	trendLabel: string;
	value: string;
};

export type IntelligenceTrendPoint = {
	day: string;
	evidence: number;
	highRisk: number;
	scans: number;
};

export type IntelligenceTopicRow = {
	claimCount: number;
	evidenceCount: number;
	firstSeenAt: string | null;
	highRiskEvidenceCount: number;
	href: string;
	id: string;
	lastSeenAt: string | null;
	momentumScore: number;
	name: string;
	riskLevel: RiskLevel;
	scanCount: number;
	sourceCount: number;
	slug: string;
	trend: string;
};

export type IntelligenceEvidenceRow = {
	author: string | null;
	createdAt: string;
	facebookPageId: string | null;
	facebookUsername: string | null;
	href: string;
	id: string;
	originalPostHref: string | null;
	originalImageUrl?: string | null;
	provider: ProviderName;
	publishedAt: string | null;
	quote: string;
	riskLevel: RiskLevel;
	scanHref: string;
	scanId: string;
	sentiment: string;
	sourceLabel: string | null;
	sourceUrl: string | null;
	stance: string;
	summary: string;
	topicSlugs: string[];
};

export type TimelineSort =
	| "published-desc"
	| "published-asc"
	| "engagement-desc"
	| "risk-desc"
	| "triage-updated-desc";

export type TimelineDueFilter = "all" | "overdue" | "today" | "none";

export type TimelineFilters = IntelligenceFilters & {
	assignee?: string;
	dateFrom?: string;
	dateTo?: string;
	due?: TimelineDueFilter;
	isPinned?: boolean;
	sentiment?: string;
	sort?: TimelineSort;
	stance?: string;
	triageStatus?: EvidenceTriageStatus | "all";
};

export type EvidenceTriageView = {
	assigneeDisplayName: string | null;
	assigneeUserId: string | null;
	dueAt: string | null;
	isPinned: boolean;
	status: EvidenceTriageStatus;
	updatedAt: string | null;
	updatedByDisplayName: string | null;
};

export type EvidenceTriageNoteView = {
	authorDisplayName: string | null;
	authorUserId: string;
	body: string;
	createdAt: string;
	id: string;
};

export type TimelinePost = IntelligenceEvidenceRow & {
	engagement: {
		comments: number;
		reactions: number;
		shares: number;
		total: number;
	};
	pageClassification: FacebookPageClassification;
	triage: EvidenceTriageView;
};

export type RelatedEvidenceItem = TimelinePost & {
	reasons: string[];
	relevance: number;
	relationship: "same_event" | "strongly_related" | "related";
	semanticSimilarity: number;
	sharedTopics: string[];
};

export type RelatedEvidenceResponse = {
	generatedAt: string | null;
	items: RelatedEvidenceItem[];
	model: string | null;
	profileReady: boolean;
};

export type EvidenceSemanticRebuildResult = {
	failed: number;
	generated: number;
	model: string;
	skipped: number;
	total: number;
};

export type TimelinePage = IntelligencePage<TimelinePost> & {
	refreshedAt: string;
	total: number;
};

export type TimelineHead = {
	latestTriageUpdatedAt: string | null;
	newestPostId: string | null;
	newestPublishedAt: string | null;
	refreshedAt: string;
	total: number;
};

export type IntelligenceFacebookPageOption = {
	autoDraftEnabled: boolean;
	automation: {
		completed: number;
		failed: number;
		pending: number;
	};
	classification: FacebookPageClassification;
	evidenceCount: number;
	facebookId: string | null;
	href: string;
	label: string;
	lastSeenAt: string | null;
	pageKey: string;
	sourceUrl: string | null;
	trackedSourceId: string | null;
	username: string | null;
	value: string;
};

export type FacebookPageClassification =
	| "uncategorized"
	| "trusted"
	| "neutral"
	| "at_risk";

export type IntelligenceClaimRow = {
	claim: string;
	claimKey: string;
	confidence: number;
	deepLink: string;
	evidenceCount: number;
	evidenceHrefs: string[];
	id: string;
	riskLevel: RiskLevel;
	scanHref: string | null;
	sourceLabels: string[];
	stance: string;
	topicSlugs: string[];
	updatedAt: string;
};

export type IntelligenceSourceRow = {
	completedScanCount: number;
	evidenceCount: number;
	failedScanCount: number;
	health: IntelligenceHealthState;
	highRiskEvidenceCount: number;
	href: string;
	lastScanHref: string | null;
	lastScannedAt: string | null;
	provider: ProviderName | null;
	scanCount: number;
	sourceId: string;
	sourceLabel: string;
	sourceType: SourceType;
};

export type IntelligenceProviderRow = {
	avgDurationMs: number;
	completedRunCount: number;
	failedRunCount: number;
	health: IntelligenceHealthState;
	lastRunAt: string | null;
	lastStatus: ScanStatus | null;
	provider: ProviderName;
	scanCount: number;
};

export type IntelligenceActivityRow = {
	action: string;
	description: string;
	entityId: string;
	entityType: string;
	href: string;
	id: string;
	occurredAt: string;
	severity: RiskLevel;
	title: string;
};

export type IntelligenceReadiness = {
	approvedDrafts: number;
	approvedDraftRate: number;
	draftCount: number;
	label: string;
	readyReports: number;
};

export type IntelligenceActionItem = {
	body: string;
	help: string;
	href: string;
	id: string;
	label: string;
	severity: RiskLevel;
};

export type IntelligenceOverviewView = {
	actions: IntelligenceActionItem[];
	filters: Required<Pick<IntelligenceFilters, "timeRange">> &
		Omit<IntelligenceFilters, "timeRange">;
	generatedAt: string;
	kpis: IntelligenceKpi[];
	providerHealth: IntelligenceProviderRow[];
	readiness: IntelligenceReadiness;
	sourceHealth: IntelligenceSourceRow[];
	topClaims: IntelligenceClaimRow[];
	topEvidence: IntelligenceEvidenceRow[];
	topTopics: IntelligenceTopicRow[];
	trends: IntelligenceTrendPoint[];
};

export type IntelligencePage<T> = {
	hasNextPage: boolean;
	items: T[];
	limit: number;
	nextCursor: string | null;
};

export type TopicDetailView = TopicView & {
	evidence: EvidenceView;
	hasNextPage?: boolean;
	limit?: number;
	nextCursor?: string | null;
};

export type ProviderAvailabilityView = {
	apify?: boolean;
	firecrawl?: boolean;
	browserUse?: boolean;
	openai?: boolean;
	googleGenerativeAi?: boolean;
	llm?: boolean;
};

export type TrackedSourceView = {
	id: string;
	displayName: string;
	normalizedUrl: string;
	type: SourceType;
	provider: ProviderName;
	isActive: boolean;
	lastScanJobId?: string | null;
	lastScanStatus?: ScanStatus | null;
	lastScannedAt?: string | Date | null;
	metadata?: Record<string, unknown>;
	createdAt?: string | Date;
	updatedAt?: string | Date;
};

export type ReportKind = string;

export type ReportSpec = {
	kind: ReportKind;
	title: string;
	description: string;
	sections: string[];
};

export type ChatMessage = {
	id: string;
	role: "assistant" | "user";
	content: string;
	createdAt: string;
	mode?: "live";
};
