import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { IntelligenceFilters } from "@/components/dashboard/types";
import {
	DASHBOARD_INTELLIGENCE_TAG,
	dashboardIntelligenceTag,
} from "@/lib/dashboard/cache-tags";
import {
	getIntelligenceAnalytics,
	getIntelligenceEvidenceSample,
} from "@/lib/dashboard/intelligence-analytics";
import {
	summarizeIntelligence,
	type IntelligenceSummary,
} from "@/lib/llm/intelligence-summary";

/**
 * The written summary, generated once per window rather than per reader.
 *
 * This is the only part of the analysis page that costs money to produce, and
 * the answer is identical for everybody looking at the same window — so it is
 * cached far harder than the charts beside it. Half an hour of staleness on a
 * paragraph of narrative is a fair trade for not running a model on every page
 * view; the numbers it describes refresh on their own five-minute cycle and are
 * always the live ones.
 *
 * Tagged alongside the rest of the intelligence data so a scan completing clears
 * the narrative too, rather than leaving yesterday's read above today's charts.
 */
export async function getIntelligenceSummary(
	filters: IntelligenceFilters = {},
): Promise<IntelligenceSummary | null> {
	const range =
		filters.timeRange === "7d" ||
		filters.timeRange === "90d" ||
		filters.timeRange === "all"
			? filters.timeRange
			: "30d";
	return getCachedIntelligenceSummary(range);
}

async function getCachedIntelligenceSummary(
	range: "7d" | "30d" | "90d" | "all",
): Promise<IntelligenceSummary | null> {
	"use cache";
	cacheLife({ expire: 7200, revalidate: 1800, stale: 1800 });
	cacheTag(DASHBOARD_INTELLIGENCE_TAG, dashboardIntelligenceTag("summary"));

	const [analytics, samples] = await Promise.all([
		getIntelligenceAnalytics({ timeRange: range }),
		getIntelligenceEvidenceSample({ timeRange: range }),
	]);
	return summarizeIntelligence(analytics, samples);
}
