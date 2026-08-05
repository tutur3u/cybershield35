import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { adminSqlClient } from "@/lib/db/client";
import {
	DASHBOARD_INTELLIGENCE_TAG,
	dashboardIntelligenceTag,
} from "@/lib/dashboard/cache-tags";
import { EVIDENCE_RISK_CATEGORY_LABELS } from "@/lib/domain/evidence-risk";
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
	const [riskRows, categoryRows, topicRows, sourceRows, sentimentRows, trendRows] =
		await Promise.all([
			adminSqlClient<Array<{ level: string; total: number }>>`
				select risk_level::text as level, count(*)::int as total
				from evidence_items
				${days ? adminSqlClient`where created_at >= now() - (${days} || ' days')::interval` : adminSqlClient``}
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
					${days ? adminSqlClient`where created_at >= now() - (${days} || ' days')::interval` : adminSqlClient``}
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
			adminSqlClient<
				Array<{ high: number; label: string; total: number }>
			>`
				select
					coalesce(nullif(author, ''), nullif(source_label, ''), 'Không rõ nguồn') as label,
					count(*)::int as total,
					count(*) filter (where risk_level = 'high')::int as high
				from evidence_items
				${days ? adminSqlClient`where created_at >= now() - (${days} || ' days')::interval` : adminSqlClient``}
				group by 1
				order by count(*) desc
				limit 8
			`,
			adminSqlClient<Array<{ sentiment: string; total: number }>>`
				select coalesce(nullif(sentiment, ''), 'neutral') as sentiment, count(*)::int as total
				from evidence_items
				${days ? adminSqlClient`where created_at >= now() - (${days} || ' days')::interval` : adminSqlClient``}
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

	return {
		generatedAt: new Date().toISOString(),
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
		sources: sourceRows.map((row) => ({
			highRiskCount: Number(row.high),
			label: row.label,
			total: Number(row.total),
		})),
		timeRange: range,
		topics: topicRows.map((row) => ({
			high: Number(row.high),
			low: Number(row.low),
			medium: Number(row.medium),
			name: row.name,
			slug: row.slug,
			total: Number(row.total),
		})),
	};
}

function normalizeRange(value?: string): RangeKey {
	return value === "7d" || value === "90d" || value === "all" ? value : "30d";
}

function rangeDays(range: RangeKey) {
	if (range === "all") return null;
	return range === "7d" ? 7 : range === "90d" ? 90 : 30;
}
