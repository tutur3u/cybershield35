import { cachedData } from "@/lib/cache/data";
import { sql as ormSql } from "drizzle-orm";
import { facebookHandleFromAuthor, facebookHandleFromUrl } from "@/lib/db/page-name";
import "server-only";


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
 return cachedData("lib/dashboard/intelligence-analytics.ts:getCachedIntelligenceAnalytics", [range], {revalidate: 300, tags: [DASHBOARD_INTELLIGENCE_TAG, dashboardIntelligenceTag("analytics")]}, async () => {
const days = rangeDays(range);
const within = days
		? adminSqlClient`where created_at >= (strftime('%Y-%m-%dT%H:%M:%f', 'now', '-' || ${days} || ' days') || '000Z')`
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
		hashtagRows,
		totalsRows,
	] = await Promise.all([
		adminSqlClient<Array<{ level: string; total: number }>>`
			select risk_level as level, count(*) as total
			from evidence_items
			${within}
			group by risk_level
		`,
        adminSqlClient<Array<{category:string;total:number}>>`
            select j.value as category,count(*) as total from evidence_items,
            json_each(case when json_type(metadata,'$.riskCategories')='array' then json_extract(metadata,'$.riskCategories') else '[]' end) j
            ${within} group by j.value order by count(*) desc limit 8
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
				count(*) as total,
				count(*) filter (where e.risk_level = 'high') as high,
				count(*) filter (where e.risk_level = 'medium') as medium,
				count(*) filter (where e.risk_level = 'low') as low
			from evidence_topics et
			join topics t on t.id = et.topic_id
			join evidence_items e on e.id = et.evidence_item_id
			${days ? adminSqlClient`where e.created_at >= (strftime('%Y-%m-%dT%H:%M:%f', 'now', '-' || ${days} || ' days') || '000Z')` : adminSqlClient``}
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
					${facebookHandleFromAuthor(ormSql.raw("author"))} as handle,
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
					where ${facebookHandleFromUrl(ormSql.raw("ts.normalized_url"))} = s.handle
					order by ts.updated_at desc
					limit 1
				) as display_name,
				count(*) as total,
				count(*) filter (where s.risk_level = 'high') as high
			from scoped s
			group by s.handle, s.source_label
			order by count(*) desc
			limit 8
		`,
		adminSqlClient<Array<{ sentiment: string; total: number }>>`
			select coalesce(nullif(sentiment, ''), 'neutral') as sentiment, count(*) as total
			from evidence_items
			${within}
			group by 1
		`,
		adminSqlClient<Array<{ stance: string; total: number }>>`
			select coalesce(nullif(stance, ''), 'unknown') as stance, count(*) as total
			from evidence_items
			${within}
			group by 1
		`,
		adminSqlClient<
			Array<{ day: string; high: number; low: number; medium: number }>
		>`
			select
				date(created_at,'+7 hours') as day,
				count(*) filter (where risk_level = 'high') as high,
				count(*) filter (where risk_level = 'medium') as medium,
				count(*) filter (where risk_level = 'low') as low
			from evidence_items
			where created_at >= (strftime('%Y-%m-%dT%H:%M:%f', 'now', '-' || ${days ?? 90} || ' days') || '000Z')
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
				risk_level as level,
				count(*) as items,
				coalesce(sum(
					case when cast(engagement->>'reactions' as text) <> '' and cast(engagement->>'reactions' as text) not glob '*[^0-9]*' then cast(engagement->>'reactions' as integer) else 0 end
					+ case when cast(engagement->>'comments' as text) <> '' and cast(engagement->>'comments' as text) not glob '*[^0-9]*' then cast(engagement->>'comments' as integer) else 0 end
					+ case when cast(engagement->>'shares' as text) <> '' and cast(engagement->>'shares' as text) not glob '*[^0-9]*' then cast(engagement->>'shares' as integer) else 0 end
				), 0) as engagement
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
						where e.created_at >= (strftime('%Y-%m-%dT%H:%M:%f', 'now', '-' || ${days} || ' days') || '000Z')
					) as current,
					count(*) filter (
						where e.created_at >= (strftime('%Y-%m-%dT%H:%M:%f', 'now', '-' || ${days * 2} || ' days') || '000Z')
							and e.created_at < (strftime('%Y-%m-%dT%H:%M:%f', 'now', '-' || ${days} || ' days') || '000Z')
					) as previous
				from evidence_topics et
				join topics t on t.id = et.topic_id
				join evidence_items e on e.id = et.evidence_item_id
				where e.created_at >= (strftime('%Y-%m-%dT%H:%M:%f', 'now', '-' || ${days * 2} || ' days') || '000Z')
				group by t.name, t.slug
				having count(*) filter (
					where e.created_at >= (strftime('%Y-%m-%dT%H:%M:%f', 'now', '-' || ${days} || ' days') || '000Z')
				) > 0
			`
			: Promise.resolve([]),
		/*
		 * One row per post, not per time it was scraped.
		 *
		 * A page re-scanned daily stores the same post again each time, so the
		 * unfiltered ranking was three copies of one dolphin story followed by two
		 * copies of the next thing. Collapsed on the author and the opening of the
		 * text — the engagement count drifts between captures, so it cannot be part
		 * of the key — keeping the highest reading of each.
		 */
		getLoudestPosts(days),
		/*
		 * What people are actually posting about, in their own words.
		 *
		 * The topic taxonomy is a filing system — "Chính trị và Quản lý Nhà nước"
		 * is a shelf, not a subject, and tells a reader nothing about what was
		 * being discussed this week. Hashtags are written by the authors
		 * themselves, so they name the specific thing, and they are cheap to count
		 * exactly rather than infer.
		 */
		getHashtagRows(days),
		/*
		 * The same counts one window back, for the headline deltas. Without them
		 * every number on the page is a level with nothing to compare it to.
		 */
		days
			? adminSqlClient<Array<{ previous_high: number; previous_total: number }>>`
				select
					count(*) as previous_total,
					count(*) filter (where risk_level = 'high') as previous_high
				from evidence_items
				where created_at >= (strftime('%Y-%m-%dT%H:%M:%f', 'now', '-' || ${days * 2} || ' days') || '000Z')
					and created_at < (strftime('%Y-%m-%dT%H:%M:%f', 'now', '-' || ${days} || ' days') || '000Z')
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
		hashtags: hashtagRows.map((row) => ({
			engagement: Number(row.engagement),
			highRiskCount: Number(row.high),
			tag: row.tag,
			total: Number(row.total),
		})),
		loudest: loudestRows
			.filter((row) => Number(row.engagement) > 0)
			.map((row) => ({
				engagement: Number(row.engagement),
				href: `/evidence/${row.id}`,
				id: row.id,
				quote: row.quote,
				riskLevel: row.risk_level,
				source: pageIdentity({
					author: row.author,
					displayName: row.display_name,
				}).name,
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
 });
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
 return cachedData("lib/dashboard/intelligence-analytics.ts:getCachedEvidenceSample", [range], {revalidate: 600, tags: [dashboardIntelligenceTag("sample")]}, async () => {
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
			e.risk_level as risk_level,
			coalesce(nullif(e.sentiment, ''), 'neutral') as sentiment,
			coalesce(nullif(e.stance, ''), 'unknown') as stance,
			substr(coalesce(nullif(e.summary, ''), e.quote), 1, 200) as quote,
			(
				case when cast(e.engagement->>'reactions' as text) <> '' and cast(e.engagement->>'reactions' as text) not glob '*[^0-9]*' then cast(e.engagement->>'reactions' as integer) else 0 end
				+ case when cast(e.engagement->>'comments' as text) <> '' and cast(e.engagement->>'comments' as text) not glob '*[^0-9]*' then cast(e.engagement->>'comments' as integer) else 0 end
				+ case when cast(e.engagement->>'shares' as text) <> '' and cast(e.engagement->>'shares' as text) not glob '*[^0-9]*' then cast(e.engagement->>'shares' as integer) else 0 end
			) as engagement,
			json_group_array(t.name) filter (where t.name is not null) as topics
		from evidence_items e
		left join evidence_topics et on et.evidence_item_id = e.id
		left join topics t on t.id = et.topic_id
		${days ? adminSqlClient`where e.created_at >= (strftime('%Y-%m-%dT%H:%M:%f', 'now', '-' || ${days} || ' days') || '000Z')` : adminSqlClient``}
		group by e.id
		order by engagement desc, e.created_at desc
		limit 28
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
 });
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

function rawEngagement(column: string) {
    const value = ormSql.raw(column);
    const part = (key: string) => ormSql`case when cast(${value}->>${key} as text) <> '' and cast(${value}->>${key} as text) not glob '*[^0-9]*' then cast(${value}->>${key} as integer) else 0 end`;
    return ormSql`${part("reactions")} + ${part("comments")} + ${part("shares")}`;
}
async function getLoudestPosts(days: number | null) {
    const result: Array<{id:string;author:string|null;display_name:string|null;engagement:number;quote:string;risk_level:string}> = [];
    const seen = new Set<string>();
    for (let offset=0;;offset+=100) {
        const rows = await adminSqlClient<Array<{id:string;author:string|null;display_name:string|null;engagement:number;quote:string;risk_level:string}>>`
            select e.id,e.author,e.quote,e.risk_level,(${rawEngagement("e.engagement")}) as engagement,
                (select nullif(trim(ts.display_name),'') from tracked_sources ts where ${facebookHandleFromUrl(ormSql.raw("ts.normalized_url"))}=${facebookHandleFromAuthor(ormSql.raw("e.author"))} order by ts.updated_at desc limit 1) as display_name
            from evidence_items e ${days ? adminSqlClient`where e.created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-' || ${days} || ' days')` : adminSqlClient``}
            order by engagement desc,e.id limit 100 offset ${offset}`;
        for (const row of rows) {
            const key = JSON.stringify([(row.author ?? "").trim().replace(/^@|\s+/gu,"").toLowerCase(),[...row.quote].slice(0,120).join("").replace(/\s+/gu," ").toLowerCase()]);
            if (seen.has(key)) continue;
            seen.add(key); result.push({...row,quote:[...row.quote].slice(0,180).join("")});
            if(result.length===6)return result;
        }
        if(rows.length<100)return result;
    }
}
async function getHashtagRows(days: number | null) {
    const tags = new Map<string,{engagement:number;high:number;tag:string;total:number}>();
    for(let offset=0;;offset+=100) {
        const rows = await adminSqlClient<Array<{quote:string;risk_level:string;engagement:number}>>`
            select quote,risk_level,(${rawEngagement("engagement")}) as engagement from evidence_items
            ${days ? adminSqlClient`where created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-' || ${days} || ' days')` : adminSqlClient``}
            order by id limit 100 offset ${offset}`;
        for(const row of rows) for(const match of row.quote.matchAll(/#([\p{L}\p{N}_]{2,40})/gu)) {
            const tag=match[1]!.toLowerCase();const value=tags.get(tag) ?? {tag,total:0,high:0,engagement:0};
            value.total++;value.high+=Number(row.risk_level==="high");value.engagement+=Number(row.engagement);tags.set(tag,value);
        }
        if(rows.length<100)break;
    }
    return [...tags.values()].sort((a,b)=>b.total-a.total || b.engagement-a.engagement).slice(0,12);
}
