import type {
	AnalysisRow,
	CounterArgumentDraftRow,
	DraftStatus,
	EvidenceItemRow,
	ProviderName,
	RiskLevel,
	ScanStatus,
	SourceType,
} from "@/lib/db/schema";

export type DashboardPage =
	| "overview"
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
	stance: string;
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
	audience?: string;
	language?: string;
	length?: string;
	operatorNotes?: string | null;
	body: string;
	citations?: unknown[];
	safetyNotes?: unknown[];
	createdAt?: string | Date;
	updatedAt?: string | Date;
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
	href: string;
	id: string;
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
	citationCoverage: number;
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
