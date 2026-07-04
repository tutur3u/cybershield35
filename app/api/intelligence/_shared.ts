import type { IntelligenceFilters } from "@/components/dashboard/types";

export function parseIntelligenceFilters(searchParams: URLSearchParams): {
	cursor: string | null;
	filters: IntelligenceFilters;
	limit: number;
} {
	return {
		cursor: searchParams.get("cursor"),
		filters: {
			facebookPage: searchParams.get("facebookPage") ?? undefined,
			provider: searchParams.get("provider") ?? undefined,
			query: searchParams.get("q") ?? undefined,
			risk: searchParams.get("risk") as IntelligenceFilters["risk"],
			source: searchParams.get("source") ?? undefined,
			status: searchParams.get("status") ?? undefined,
			timeRange: searchParams.get("timeRange") as IntelligenceFilters["timeRange"],
			topic: searchParams.get("topic") ?? undefined,
		},
		limit: Number(searchParams.get("limit") ?? "25"),
	};
}
