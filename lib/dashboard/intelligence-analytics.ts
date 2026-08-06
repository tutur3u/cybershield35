import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { adminSqlClient } from "@/lib/db/client";
import {
	DASHBOARD_INTELLIGENCE_TAG,
	dashboardIntelligenceTag,
} from "@/lib/dashboard/cache-tags";
import { EVIDENCE_RISK_CATEGORY_LABELS } from "@/lib/domain/evidence-risk";
import { pageIdentity } from "@/lib/domain/page-identity";
import type {
	IntelligenceAnalyticsView,
	IntelligenceFilters,
} from "@/components/dashboard/types";

type RangeKey = "7d" | "30d" | "90d" | "all";

/**
 * Aggregates that only the analysis workspace needs: risk mix, what is driving the
 * risk, which topics and sources carry it, and how sentiment splits. Kept apart
 * from the operational overview so each page answers a different question.
 */
export async function getIntelligenceAnalytics(
	filters: IntelligenceFilters = {},
): Promise<IntelligenceAnalyticsView> {
	return getCachedIntelligenceAnalytics(normalizeRange(filters.timeRange));
}

async function getCachedIntelligenceAnalytics(
	range: RangeKey,
): Promise<IntelligenceAnalyticsView> {
	"use cache";
	cacheLife({ expire: 3600, revalidate: 300, stale: 300 });
	cacheTag(DASHBOARD_INTELLIGENCE_TAG, dashboardIntelligenceTag("analytics"));

	const days = rangeDays(range);
	/*
	 * Every query below is filtered by the same window, written once. It used to
	 * be repeated inline six times, which is how one of them ended up with a
	 * different default than the rest.
	 */
	const within = days
		? adminSqlClient`where created_at >= now() - (${days} || ' days')::interval`
		: adminSqlClient``;

	const [
		riskRows,
		categoryRows,
		topicRows,
		sourceRows,
		sentimentRows,
		stanceRows,
		trendRows,
		reachRows,
		momentumRows,
		loudestRows,
		totalsRows,
	] = await Promise.all([
		adminSqlClient<Array<{ level: string; total: number }>>`
			select risk_level::text as level, count(*)::int as total
			from evidence_items
			${within}
			group by risk_level
		`,
		adminSqlClient<Array<{ category: string; total: number }>>`
			select category, count(*)::int as total
			from (
				select jsonb_array_elements_text(
					case
						when jsonb_typeof(metadata->'riskCategories') = 'array'
							then metadata->'riskCategories'
						else '[]'::jsonb
					end
				) as category
				from evidence_items
				${within}
			) categories
			group by category
			order by count(*) desc
			limit 8
		`,
		adminSqlClient<
			Array<{
				high: number;
				low: number;
				medium: number;
				name: string;
				slug: string;
				total: number;
			}>
		>`
			select
				t.name,
				t.slug,
				count(*)::int as total,
				count(*) filter (where e.risk_level = 'high')::int as high,
				count(*) filter (where e.risk_level = 'medium')::int as medium,
				count(*) filter (where e.risk_level = 'low')::int as low
			from evidence_topics et
			join topics t on t.id = et.topic_id
			join evidence_items e on e.id = et.evidence_item_id
			${days ? adminSqlClient`where e.created_at >= now() - (${days} || ' days')::interval` : adminSqlClient``}
			group by t.name, t.slug
			order by count(*) filter (where e.risk_level = 'high') desc, count(*) desc
			limit 8
		`,
		/*
		 * Grouped by handle, then named from `tracked_sources` in code. The panel
		 * used to print `coalesce(author, source_label)` — the bare handle — while
		 * every other surface in the product had moved to the name the team gave
		 * the page.
		 */
		adminSqlClient<
			Array<{
				display_name: string | null;
				handle: string | null;
				high: number;
				total: number;
			}>
		>`
			with scoped as (
				select
					nullif(lower(regexp_replace(trim(coalesce(author, '')), '^@|\\s+', '', 'g')), '') as handle,
					nullif(trim(source_label), '') as source_label,
					risk_level
				from evidence_items
				${within}
			)
			select
				s.handle,
				(
					select nullif(trim(ts.display_name), '')
					from tracked_sources ts
					where nullif(lower(split_part(regexp_replace(ts.normalized_url, '^https?://(www\\.)?facebook\\.com/', '', 'i'), '/', 1)), '') = s.handle
					order by ts.updated_at desc
					limit 1
				) as display_name,
				count(*)::int as total,
				count(*) filter (where s.risk_level = 'high')::int as high
			from scoped s
			group by s.handle, s.source_label
			order by count(*) desc
			limit 8
		`,
		adminSqlClient<Array<{ sentiment: string; total: number }>>`
			select coalesce(nullif(sentiment, ''), 'neutral') as sentiment, count(*)::int as total
			from evidence_items
			${within}
			group by 1
		`,
		adminSqlClient<Array<{ stance: string; total: number }>>`
			select coalesce(nullif(stance, ''), 'unknown') as stance, count(*)::int as total
			from evidence_items
			${within}
			group by 1
		`,
		adminSqlClient<
			Array<{ day: string; high: number; low: number; medium: number }>
		>`
			select
				to_char(created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as day,
				count(*) filter (where risk_level = 'high')::int as high,
				count(*) filter (where risk_level = 'medium')::int as medium,
				count(*) filter (where risk_level = 'low')::int as low
			from evidence_items
			where created_at >= now() - ((${days ?? 90}) || ' days')::interval
			group by 1
			order by 1
		`,
		/*
		 * Reach, not volume. Counting posts treats a note nobody saw the same as
		 * one shared four thousand times, which is the opposite of how the team
		 * decides what to answer first.
		 */
		adminSqlClient<
			Array<{ level: string; engagement: number; items: number }>
		>`
			select
				risk_level::text as level,
				count(*)::int as items,
				coalesce(sum(
					case when coalesce(engagement->>'reactions', '') ~ '^\\d+$' then (engagement->>'reactions')::bigint else 0 end
					+ case when coalesce(engagement->>'comments', '') ~ '^\\d+$' then (engagement->>'comments')::bigint else 0 end
					+ case when coalesce(engagement->>'shares', '') ~ '^\\d+$' then (engagement->>'shares')::bigint else 0 end
				), 0)::bigint as engagement
			from evidence_items
			${within}
			group by risk_level
		`,
		/*
		 * This window against the one before it, per topic. A ranking by volume
		 * says what is big; only a comparison says what is *moving*, which is the
		 * question a duty officer actually opens this page with.
		 */
		days
			? adminSqlClient<
					Array<{ current: number; name: string; previous: number; slug: string }>
				>`
				select
					t.name,
					t.slug,
					count(*) filter (
						where e.created_at >= now() - (${days} || ' days')::interval
					)::int as current,
					count(*) filter (
						where e.created_at >= now() - (${days * 2} || ' days')::interval
							and e.created_at < now() - (${days} || ' days')::interval
					)::int as previous
				from evidence_topics et
				join topics t on t.id = et.topic_id
				join evidence_items e on e.id = et.evidence_item_id
				where e.created_at >= now() - (${days * 2} || ' days')::interval
				group by t.name, t.slug
				having count(*) filter (
					where e.created_at >= now() - (${days} || ' days')::interval
				) > 0
			`
			: Promise.resolve([]),
		adminSqlClient<
			Array<{
				author: string | null;
				engagement: number;
				id: string;
				quote: string;
				risk_level: string;
			}>
		>`
			select
				id,
				author,
				risk_level::text as risk_level,
				left(quote, 180) as quote,
				(
					case when coalesce(engagement->>'reactions', '') ~ '^\\d+$' then (engagement->>'reactions')::bigint else 0 end
					+ case when coalesce(engagement->>'comments', '') ~ '^\\d+$' then (engagement->>'comments')::bigint else 0 end
					+ case when coalesce(engagement->>'shares', '') ~ '^\\d+$' then (engagement->>'shares')::bigint else 0 end
				)::bigint as engagement
			from evidence_items
			${within}
			order by engagement desc
			limit 5
		`,
		/*
		 * The same counts one window back, for the headline deltas. Without them
		 * every number on the page is a level with nothing to compare it to.
		 */
		days
			? adminSqlClient<Array<{ previous_high: number; previous_total: number }>>`
				select
					count(*)::int as previous_total,
					count(*) filter (where risk_level = 'high')::int as previous_high
				from evidence_items
				where created_at >= now() - (${days * 2} || ' days')::interval
					and created_at < now() - (${days} || ' days')::interval
			`
			: Promise.resolve([]),
	]);

	const riskByLevel = { high: 0, low: 0, medium: 0 };
	for (const row of riskRows) {
		if (row.level in riskByLevel) {
			riskByLevel[row.level as keyof typeof riskByLevel] = Number(row.total);
		}
	}
	const sentiment = { negative: 0, neutral: 0, positive: 0 };
	for (const row of sentimentRows) {
		if (row.sentiment in sentiment) {
			sentiment[row.sentiment as keyof typeof sentiment] = Number(row.total);
		}
	}
	const stance = { critical: 0, neutral: 0, supportive: 0, unknown: 0 };
	for (const row of stanceRows) {
		if (row.stance in stance) {
			stance[row.stance as keyof typeof stance] = Number(row.total);
		}
	}
	const reach = { high: 0, low: 0, medium: 0 };
	for (const row of reachRows) {
		if (row.level in reach) {
			reach[row.level as keyof typeof reach] = Number(row.engagement);
		}
	}

	const total = riskByLevel.high + riskByLevel.medium + riskByLevel.low;
	const previous = totalsRows[0];
	const peak = trendRows.reduce<(typeof trendRows)[number] | null>(
		(best, row) =>
			best && Number(best.high) >= Number(row.high) ? best : row,
		null,
	);

	return {
		generatedAt: new Date().toISOString(),
		// Only meaningful when there is a preceding window to compare against.
		previousPeriod: previous
			? {
					high: Number(previous.previous_high),
					total: Number(previous.previous_total),
				}
			: null,
		loudest: loudestRows
			.filter((row) => Number(row.engagement) > 0)
			.map((row) => ({
				engagement: Number(row.engagement),
				href: `/evidence/${row.id}`,
				id: row.id,
				quote: row.quote,
				riskLevel: row.risk_level,
				source: pageIdentity({ author: row.author }).name,
			})),
		momentum: momentumRows
			.map((row) => ({
				current: Number(row.current),
				name: row.name,
				previous: Number(row.previous),
				slug: row.slug,
			}))
			// A topic appearing for the first time is the strongest signal there is,
			// so a zero denominator sorts to the top rather than out of the list.
			.sort(
				(left, right) =>
					growth(right.current, right.previous) -
					growth(left.current, left.previous),
			)
			.slice(0, 6),
		peakDay: peak && Number(peak.high) > 0
			? {
					day: peak.day,
					high: Number(peak.high),
					total: Number(peak.high) + Number(peak.medium) + Number(peak.low),
				}
			: null,
		reach,
		riskByLevel,
		riskCategories: categoryRows
			.filter((row) => row.category !== "unclassified")
			.map((row) => ({
				count: Number(row.total),
				key: row.category,
				label:
					EVIDENCE_RISK_CATEGORY_LABELS[
						row.category as keyof typeof EVIDENCE_RISK_CATEGORY_LABELS
					] ?? row.category,
			})),
		riskTrend: trendRows.map((row) => ({
			day: row.day,
			high: Number(row.high),
			low: Number(row.low),
			medium: Number(row.medium),
		})),
		sentiment,
		sources: sourceRows.map((row) => {
			const identity = pageIdentity({
				displayName: row.display_name,
				handle: row.handle,
			});
			return {
				handle: identity.handle,
				highRiskCount: Number(row.high),
				label: identity.name,
				total: Number(row.total),
			};
		}),
		stance,
		timeRange: range,
		topics: topicRows.map((row) => ({
			high: Number(row.high),
			low: Number(row.low),
			medium: Number(row.medium),
			name: row.name,
			slug: row.slug,
			total: Number(row.total),
		})),
		total,
	};
}

export type IntelligenceEvidenceSample = {
	engagement: number;
	quote: string;
	riskLevel: string;
	sentiment: string;
	source: string;
	stance: string;
	topics: string[];
};

/**
 * A bounded, real slice of what was actually posted in the window.
 *
 * The written summary needs this. Aggregates alone can say "criticism is up
 * eighteen per cent" but never what the criticism is *about*, which is the first
 * thing anyone asks. The sample is drawn by reach rather than at random — what
 * travelled is what the team will be asked about — and each row carries its own
 * classification so the model is describing labelled data rather than guessing.
 *
 * Server-only and never returned to the browser: it is model input, not a view.
 */
export async function getIntelligenceEvidenceSample(
	filters: IntelligenceFilters = {},
): Promise<IntelligenceEvidenceSample[]> {
	return getCachedEvidenceSample(normalizeRange(filters.timeRange));
}

async function getCachedEvidenceSample(
	range: RangeKey,
): Promise<IntelligenceEvidenceSample[]> {
	"use cache";
	cacheLife({ expire: 3600, revalidate: 600, stale: 600 });
	cacheTag(DASHBOARD_INTELLIGENCE_TAG, dashboardIntelligenceTag("sample"));

	const days = rangeDays(range);
	const rows = await adminSqlClient<
		Array<{
			author: string | null;
			engagement: number;
			quote: string;
			risk_level: string;
			sentiment: string | null;
			stance: string | null;
			topics: string[] | null;
		}>
	>`
		select
			e.author,
			e.risk_level::text as risk_level,
			coalesce(nullif(e.sentiment, ''), 'neutral') as sentiment,
			coalesce(nullif(e.stance, ''), 'unknown') as stance,
			left(coalesce(nullif(e.summary, ''), e.quote), 320) as quote,
			(
				case when coalesce(e.engagement->>'reactions', '') ~ '^\\d+$' then (e.engagement->>'reactions')::bigint else 0 end
				+ case when coalesce(e.engagement->>'comments', '') ~ '^\\d+$' then (e.engagement->>'comments')::bigint else 0 end
				+ case when coalesce(e.engagement->>'shares', '') ~ '^\\d+$' then (e.engagement->>'shares')::bigint else 0 end
			)::bigint as engagement,
			array_remove(array_agg(t.name), null) as topics
		from evidence_items e
		left join evidence_topics et on et.evidence_item_id = e.id
		left join topics t on t.id = et.topic_id
		${days ? adminSqlClient`where e.created_at >= now() - (${days} || ' days')::interval` : adminSqlClient``}
		group by e.id
		order by engagement desc, e.created_at desc
		limit 60
	`;

	return rows.map((row) => ({
		engagement: Number(row.engagement),
		quote: row.quote,
		riskLevel: row.risk_level,
		sentiment: row.sentiment ?? "neutral",
		source: pageIdentity({ author: row.author }).name,
		stance: row.stance ?? "unknown",
		topics: (row.topics ?? []).slice(0, 3),
	}));
}

/**
 * How much a topic grew, with a first appearance treated as the strongest move.
 *
 * A topic with no prior period has no percentage — dividing by zero is not a
 * ratio — so it is ranked above everything that does have one, and among those,
 * by size. The first version subtracted the count from the ceiling, which sorted
 * brand-new topics smallest-first: exactly backwards, and invisible in a dataset
 * younger than two windows because every row took that branch.
 */
const NEW_TOPIC_RANK_BASE = 1_000_000;

function growth(current: number, previous: number) {
	if (previous === 0) return current > 0 ? NEW_TOPIC_RANK_BASE + current : 0;
	return (current - previous) / previous;
}

function normalizeRange(value?: string): RangeKey {
	return value === "7d" || value === "90d" || value === "all" ? value : "30d";
}

function rangeDays(range: RangeKey) {
	if (range === "all") return null;
	return range === "7d" ? 7 : range === "90d" ? 90 : 30;
}
