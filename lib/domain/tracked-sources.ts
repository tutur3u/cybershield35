import type { ProviderName, SourceType } from "@/lib/db/schema";
import { detectSource } from "@/lib/domain/source-detection";

export type TrackedSourceSeed = {
	displayName: string;
	normalizedUrl: string;
	type: SourceType;
	provider: ProviderName;
	isActive: boolean;
	metadata: Record<string, unknown>;
};

/**
 * Seed sources, read from the environment rather than written down here.
 *
 * Which pages a unit follows is operational information about an investigation,
 * not a property of the software, and this repository may be published. The
 * list lived in the source with two real pages in it; it now comes from
 * `CYBERSHIELD35_SEED_SOURCE_URLS` and is empty by default.
 */
export function defaultTrackedSourceSeeds(): TrackedSourceSeed[] {
	return (process.env.CYBERSHIELD35_SEED_SOURCE_URLS ?? "")
		.split(",")
		.map((url) => url.trim())
		.filter(Boolean)
		.map((url) => toTrackedSourceSeed(url));
}

export function toTrackedSourceSeed(
	input: string,
	displayName?: string,
): TrackedSourceSeed {
	const detection = detectSource(input);

	return {
		displayName: displayName?.trim() || detection.label,
		normalizedUrl: trimTrailingSlash(detection.normalizedInput),
		type: detection.type,
		provider: detection.provider,
		isActive: true,
		metadata: { label: detection.label },
	};
}

function trimTrailingSlash(value: string) {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}
