import type {
	EvidenceItemRow,
	ProviderName,
	SourceRow,
} from "@/lib/db/schema";
import type { CredentialSource } from "@/lib/runtime/client-runtime";

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
	mode: "live";
	credentialSource: CredentialSource;
	raw: Record<string, unknown>;
	evidence: NormalizedEvidence[];
};

export type ProviderAdapter = (source: SourceRow) => Promise<ProviderResult>;
