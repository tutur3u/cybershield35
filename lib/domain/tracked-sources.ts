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

const defaultTrackedSourceUrls = [
	"https://www.facebook.com/example-page",
	"https://www.facebook.com/example-fanpage",
] as const;

export const defaultTrackedSourceSeeds = defaultTrackedSourceUrls.map((url) =>
	toTrackedSourceSeed(url),
);

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
