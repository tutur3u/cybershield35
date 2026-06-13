import type {
	CounterArgumentDraftRow,
	DraftStatus,
	EvidenceItemRow,
	RiskLevel,
} from "@/lib/db/schema";
import type { demoAnalysis } from "@/lib/domain/fixtures";

export type DashboardPage =
	| "overview"
	| "sources"
	| "analysis"
	| "counter-arguments"
	| "scan-detail"
	| "evidence"
	| "evidence-detail"
	| "draft-detail"
	| "alerts"
	| "reports"
	| "settings"
	| "audit";

export type AdminSessionView = {
	appName: string | null;
	authenticated: boolean;
	expiresAt: string;
	refreshExpiresAt: string;
	user: {
		email: string | null;
		id: string;
	};
	workspaceId: string | null;
};

export type AuthViewState = {
	authenticated: boolean;
	configured?: boolean;
	demoBypass?: boolean;
	error?: string;
	session?: AdminSessionView;
};

export type ScanDetail = {
	job?: Record<string, unknown>;
	source?: {
		title?: string | null;
		type?: string;
		normalizedUrl?: string | null;
		fileName?: string | null;
		createdAt?: string;
	};
	analysis?: typeof demoAnalysis;
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
	demoMode?: boolean;
};
