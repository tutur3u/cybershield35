import type {
	EvidenceItemRow,
	ProviderName,
	SourceRow,
} from "@/lib/db/schema";

export type NormalizedEvidence = Pick<
	EvidenceItemRow,
	| "sourceUrl"
	| "sourceLabel"
	| "author"
	| "publishedAt"
	| "quote"
	| "summary"
	| "engagement"
	| "stance"
	| "sentiment"
	| "riskLevel"
	| "metadata"
>;

export type ProviderResult = {
	provider: ProviderName;
	mode: "live" | "demo";
	raw: Record<string, unknown>;
	evidence: NormalizedEvidence[];
};

export type ProviderAdapter = (source: SourceRow) => Promise<ProviderResult>;
