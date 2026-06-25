import type { ProviderName } from "@/lib/db/schema";
import type { DetectionResult } from "@/lib/domain/source-detection";

export type ScanProviderOverride = Extract<ProviderName, "browser_use">;

const urlSourceTypes = new Set([
	"url",
	"facebook_post",
	"facebook_group",
	"facebook_page",
	"social",
]);

export function resolveScanProvider(
	detection: DetectionResult,
	providerOverride?: ScanProviderOverride,
): ProviderName {
	if (!providerOverride) return detection.provider;

	if (providerOverride !== "browser_use") {
		throw new Error(`Unsupported provider override: ${providerOverride}`);
	}

	if (!urlSourceTypes.has(detection.type)) {
		throw new Error("Browser Use can only be selected for URL scans");
	}

	return providerOverride;
}
