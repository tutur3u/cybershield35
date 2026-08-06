import "server-only";

import { and, eq, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import type { TimelineFilters } from "@/components/dashboard/types";
import { adminDb } from "@/lib/db/client";
import { evidenceItems, evidenceTriage } from "@/lib/db/schema";
import {
	effectiveTriageStatus,
	facebookPageProfileJoin,
} from "@/lib/dashboard/timeline-shared";
import { timelineConditionsFor } from "@/lib/dashboard/timeline-server";
import { facebookPageProfiles } from "@/lib/db/schema";

export type TimelineFacets = {
	risk: Record<string, number>;
	sentiment: Record<string, number>;
	stance: Record<string, number>;
	triageStatus: Record<string, number>;
};

/**
 * How many results each option would actually return.
 *
 * Without this the filters are a guessing game: eleven dropdowns, no indication
 * which combinations have anything behind them, and a customer picking one that
 * returns nothing cannot tell a working filter from a broken one. Every count is
 * computed against the *other* active filters, so the numbers describe what
 * choosing that option would do from where the reader is standing.
 */
export async function getTimelineFacets(
	filters: TimelineFilters,
): Promise<TimelineFacets> {
	const [risk, sentiment, stance, triageStatus] = await Promise.all([
		countBy(evidenceItems.riskLevel, filters, "risk"),
		countBy(evidenceItems.sentiment, filters, "sentiment"),
		countBy(evidenceItems.stance, filters, "stance"),
		countBy(effectiveTriageStatus, filters, "triageStatus"),
	]);
	return { risk, sentiment, stance, triageStatus };
}

async function countBy(
	/** A column or a computed expression; both group the same way. */
	dimension: PgColumn | SQL<unknown>,
	filters: TimelineFilters,
	exclude: keyof TimelineFilters,
) {
	// The dimension being counted is dropped from the conditions: a reader
	// looking at "Rủi ro" wants to know what each level would give them, not how
	// many of the level they already picked exist.
	const conditions = timelineConditionsFor({ ...filters, [exclude]: undefined });
	const rows = await adminDb
		.select({ count: sql<number>`count(*)::int`, value: dimension })
		.from(evidenceItems)
		.leftJoin(evidenceTriage, eq(evidenceTriage.evidenceItemId, evidenceItems.id))
		.leftJoin(facebookPageProfiles, facebookPageProfileJoin)
		.where(conditions.length ? and(...conditions) : undefined)
		.groupBy(dimension);

	const counts: Record<string, number> = {};
	for (const row of rows) {
		if (row.value == null) continue;
		counts[String(row.value)] = Number(row.count);
	}
	return counts;
}
