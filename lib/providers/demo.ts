import { buildDemoProviderEvidence } from "@/lib/domain/fixtures";

import type { ProviderAdapter } from "./types";

export const runDemoProvider: ProviderAdapter = async (source) => ({
	provider: source.type === "text" ? "local_text" : "demo",
	mode: "demo",
	raw: {
		reason: "Demo mode or missing provider credentials",
		source: source.originalInput,
	},
	evidence: buildDemoProviderEvidence(source.title ?? source.normalizedUrl ?? "Nguồn"),
});
