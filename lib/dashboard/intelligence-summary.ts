import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { IntelligenceFilters } from "@/components/dashboard/types";
import { dashboardIntelligenceTag } from "@/lib/dashboard/cache-tags";
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
 * Refreshed on its own timer rather than with the rest of the intelligence
 * data: see the tag note below for why sharing that tag made it uncacheable.
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
	/*
	 * Its own tag only, deliberately not the broad intelligence one.
	 *
	 * Twenty-five call sites invalidate `DASHBOARD_INTELLIGENCE_TAG`, and with
	 * scans running through the day something clears it every few minutes. The
	 * summary was tagged with it, so the cache never survived long enough to be
	 * read: every reader regenerated it from cold and waited the full forty
	 * seconds, every single refresh.
	 *
	 * Half an hour behind the charts is the right trade for a paragraph about
	 * trends — it describes the shape of a window, not a live count — and the
	 * daily job warms it besides.
	 */
	cacheTag(dashboardIntelligenceTag("summary"));

	const [analytics, samples] = await Promise.all([
		getIntelligenceAnalytics({ timeRange: range }),
		getIntelligenceEvidenceSample({ timeRange: range }),
	]);
	return summarizeIntelligence(analytics, samples);
}
