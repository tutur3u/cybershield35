import "server-only";

import { eq } from "drizzle-orm";

import type { IntelligenceFilters } from "@/components/dashboard/types";
import { adminDb, adminSqlClient } from "@/lib/db/client";
import { intelligenceSummaries } from "@/lib/db/schema";
import {
	getIntelligenceAnalytics,
	getIntelligenceEvidenceSample,
} from "@/lib/dashboard/intelligence-analytics";
import {
	summarizeIntelligence,
	type IntelligenceSummary,
} from "@/lib/llm/intelligence-summary";

type RangeKey = "7d" | "30d" | "90d" | "all";

/**
 * The written read of a window, stored rather than cached.
 *
 * It began in Next's `"use cache"`, which for a dynamic route handler is held
 * per serverless instance. Instances are short-lived and numerous, so nearly
 * every reader landed on a cold one and paid the forty seconds to regenerate —
 * on every refresh, for ever. Tagging made it worse: twenty-five call sites
 * invalidate the intelligence tag, so even a warm instance was cleared within
 * minutes.
 *
 * A row in Postgres survives all of that. The read is one indexed lookup, and
 * the model runs only when the thing it describes has actually changed.
 */

/**
 * What the summary was computed from.
 *
 * The count and the newest timestamp in the window. Equal fingerprints mean
 * nothing has been collected since, so the stored answer is still the right
 * one — no model call can improve it. A completed scan moves both, which is
 * exactly when regenerating is worth the cost.
 */
async function fingerprintFor(range: RangeKey) {
	const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : null;
	const rows = await adminSqlClient<Array<{ newest: string | null; total: number }>>`
		select
			count(*)::int as total,
			coalesce(max(created_at)::text, 'none') as newest
		from evidence_items
		${days ? adminSqlClient`where created_at >= now() - (${days} || ' days')::interval` : adminSqlClient``}
	`;
	const row = rows[0];
	return `${row?.total ?? 0}:${row?.newest ?? "none"}`;
}

function normalizeRange(value?: string): RangeKey {
	return value === "7d" || value === "90d" || value === "all" ? value : "30d";
}

/**
 * Serves the stored summary, and regenerates only when the data has moved.
 *
 * A stale row is returned as-is rather than held while a new one is produced:
 * a paragraph describing last hour's shape is worth far more to somebody
 * opening the page than a spinner. The refresh happens on the next scheduled
 * run, which is the path that should be paying for it.
 */
export type IntelligenceSummaryRead = {
	/** `generating` means no row yet and one is being produced right now. */
	status: "generating" | "ready" | "stale";
	summary: IntelligenceSummary | null;
};

/**
 * Reads the stored summary. Never generates one on the way.
 *
 * Generating inline was the last thing making this page feel broken: the first
 * reader after a deploy or a cleared row waited forty seconds inside their own
 * request, and often the request died first — the panel showed a skeleton and
 * then vanished, which is the failure branch rendering nothing.
 *
 * A read is now always a single indexed lookup. When there is no row the caller
 * is told `generating` and asked to come back, and production happens outside
 * the request where nothing is waiting on it.
 */
export async function readIntelligenceSummary(
	filters: IntelligenceFilters = {},
): Promise<IntelligenceSummaryRead> {
	const range = normalizeRange(filters.timeRange);
	const [stored, fingerprint] = await Promise.all([
		readStoredSummary(range),
		fingerprintFor(range),
	]);

	if (!stored) return { status: "generating", summary: null };
	return {
		// Stale is still served: a paragraph describing the last hour beats a
		// spinner, and the scheduled run refreshes it.
		status: stored.fingerprint === fingerprint ? "ready" : "stale",
		summary: stored.summary,
	};
}

/** Back-compat for callers that only want the summary itself. */
export async function getIntelligenceSummary(
	filters: IntelligenceFilters = {},
): Promise<IntelligenceSummary | null> {
	return (await readIntelligenceSummary(filters)).summary;
}

/**
 * Claims the right to generate, so twenty readers do not start twenty runs.
 *
 * Writes a placeholder row: whoever inserts it wins, everybody else sees a row
 * and waits. The placeholder carries a sentinel fingerprint, so if generation
 * dies the row stays stale and the next scheduled run replaces it rather than
 * the slot being held for ever.
 */
const GENERATING = "__generating__";

/**
 * How long a claim is honoured before anyone may take it over.
 *
 * A claim that never expires is a deadlock, and it deadlocked: the first
 * attempt was abandoned mid-flight, the placeholder stayed, every later reader
 * saw "generating" and none of them could claim it. Generation takes under a
 * minute, so two is generous and still recovers quickly.
 */
const CLAIM_TTL_MS = 2 * 60 * 1000;

export async function claimSummaryGeneration(range: RangeKey) {
	const cutoff = new Date(Date.now() - CLAIM_TTL_MS);
	const claimed = await adminSqlClient<Array<{ time_range: string }>>`
		insert into intelligence_summaries (time_range, fingerprint, payload, generated_at)
		values (${range}, ${GENERATING}, '{}'::jsonb, now())
		on conflict (time_range) do update
			set generated_at = now()
			where intelligence_summaries.fingerprint = ${GENERATING}
				and intelligence_summaries.generated_at < ${cutoff.toISOString()}::timestamptz
		returning time_range
	`;
	return claimed.length > 0;
}

async function readStoredSummary(range: RangeKey) {
	const [row] = await adminDb
		.select({
			fingerprint: intelligenceSummaries.fingerprint,
			payload: intelligenceSummaries.payload,
		})
		.from(intelligenceSummaries)
		.where(eq(intelligenceSummaries.timeRange, range))
		.limit(1);
	if (!row) return null;
	// A claim placeholder is not an answer: treat it as "nothing stored yet".
	if (row.fingerprint === GENERATING) return null;
	return {
		fingerprint: row.fingerprint,
		summary: row.payload as unknown as IntelligenceSummary,
	};
}

/**
 * Produces a summary and stores it. Called by the scheduler after a scan run,
 * and once by the first reader of a window that has never been summarised.
 *
 * Returns null without writing when there is nothing to say — no model
 * configured, or an empty window — so an absent row keeps meaning "not yet
 * generated" rather than "generated and empty".
 */
export async function regenerateIntelligenceSummary(
	range: RangeKey = "30d",
): Promise<IntelligenceSummary | null> {
	const [analytics, samples, fingerprint] = await Promise.all([
		getIntelligenceAnalytics({ timeRange: range }),
		getIntelligenceEvidenceSample({ timeRange: range }),
		fingerprintFor(range),
	]);
	const summary = await summarizeIntelligence(analytics, samples);
	if (!summary) return null;

	await adminDb
		.insert(intelligenceSummaries)
		.values({
			fingerprint,
			generatedAt: new Date(),
			payload: summary as unknown as Record<string, unknown>,
			timeRange: range,
		})
		.onConflictDoUpdate({
			target: intelligenceSummaries.timeRange,
			set: {
				fingerprint,
				generatedAt: new Date(),
				payload: summary as unknown as Record<string, unknown>,
			},
		});

	return summary;
}

/**
 * Whether the stored summary still describes the current data.
 *
 * Lets the scheduler skip the model entirely on a run that collected nothing
 * new, which is most of them.
 */
export async function intelligenceSummaryIsStale(range: RangeKey = "30d") {
	const [stored, fingerprint] = await Promise.all([
		readStoredSummary(range),
		fingerprintFor(range),
	]);
	return !stored || stored.fingerprint !== fingerprint;
}
