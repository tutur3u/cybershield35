import type { ArticleContent } from "@/lib/articles/schemas";

export type ArticleRow = ArticleContent & {
	contentHash: string;
	createdAt: string;
	id: string;
	lastError: string | null;
	lastSyncedAt: string | null;
	originDraftId: string | null;
	publicationStatus: string;
	publishedAt: string | null;
	remoteArticleId: string | null;
	remoteSnapshot: Record<string, unknown>;
	reviewStatus: string;
	scheduledAt: string | null;
	state: "archived" | "draft" | "published";
	syncedContentHash: string | null;
	targetOaConnectionId: string | null;
	updatedAt: string;
};

export type ArticleEvidenceRow = {
	author: string | null;
	id: string;
	quote: string;
	riskLevel: string;
	sourceLabel: string | null;
	summary: string;
};

export type ArticleJobRow = {
	createdAt: string;
	errorMessage: string | null;
	id: string;
	operation: string;
	status: string;
};

export type ArticleVersionRow = {
	actorDisplayName: string | null;
	createdAt: string;
	id: string;
	origin: string;
	version: number;
};

export type ArticleDetail = {
	article: ArticleRow;
	evidence: ArticleEvidenceRow[];
	jobs: ArticleJobRow[];
	oaDisplayName: string | null;
	oaId: string | null;
	versions: ArticleVersionRow[];
};

export type ZaloAccount = {
	displayName: string;
	id: string;
	isDefault: boolean;
	lastError: string | null;
	oaId: string;
	status: string;
};

export type AiProposal = ArticleContent & { reviewNotes: string[] };

export type EditorialIntent = "counter_argument" | "support" | "balanced";

export type EditorNotice = { tone: "error" | "success"; text: string } | null;

export type ReadinessItem = { done: boolean; hint: string; label: string };

export type StatusTone = "accent" | "danger" | "neutral" | "success" | "warning";
