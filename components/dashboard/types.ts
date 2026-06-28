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
	jobKey: string;
	lastRunAt: string | null;
	lastStatus: string | null;
	name: string;
	nextRunAt: string | null;
	schedule: string;
};

export type ManagedSchedulerStatusView = {
	approvalHref?: string;
	approvalReason?: string;
	code?: string;
	configured: boolean;
	enabled: boolean;
	error?: string;
	jobs: ManagedSchedulerJobView[];
	localStorageReady?: boolean;
	missingApprovalItems?: string[];
	setupDisabled?: boolean;
	setupDisabledReason?: string;
	setupOrigin?: string;
	tokenLastFour: string | null;
	updatedAt: string | null;
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
	name: string;
	count: number;
	trend: string;
	riskLevel: RiskLevel;
};

export type RiskFlagView = {
	label: string;
	count: number;
	severity: RiskLevel;
};

export type AnalysisView = Omit<
	Partial<AnalysisRow>,
	"riskFlags" | "sentiment" | "topicClusters"
> & {
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

export type EvidenceView = Array<Partial<EvidenceItemRow> & { id: string }>;

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
