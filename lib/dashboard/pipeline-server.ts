import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { WorkflowPipelineView } from "@/components/dashboard/types";
import {
	DASHBOARD_INTELLIGENCE_TAG,
	DASHBOARD_SCANS_TAG,
	dashboardIntelligenceTag,
} from "@/lib/dashboard/cache-tags";
import { adminSqlClient } from "@/lib/db/client";

type CountRow = Record<string, number>;

/**
 * Counters for the five-step workflow strip on the overview page: sources, scans,
 * timeline triage, drafts, and publication. It answers "where is work stuck right
 * now", which is a different question from the analysis workspace.
 */
export async function getWorkflowPipeline(): Promise<WorkflowPipelineView> {
	return getCachedWorkflowPipeline();
}

async function getCachedWorkflowPipeline(): Promise<WorkflowPipelineView> {
	"use cache";
	cacheLife({ expire: 300, revalidate: 30, stale: 30 });
	cacheTag(DASHBOARD_SCANS_TAG, DASHBOARD_INTELLIGENCE_TAG, dashboardIntelligenceTag("timeline"));

	const [sources, scans, timeline, drafts, articles] = await Promise.all([
		adminSqlClient<CountRow[]>`
			select
				count(*) filter (where is_active)::int as active,
				count(*)::int as total
			from tracked_sources
		`,
		adminSqlClient<CountRow[]>`
			select
				count(*) filter (where status in ('queued', 'retrying'))::int as queued,
				count(*) filter (where status = 'running')::int as running,
				count(*) filter (where status = 'completed' and created_at >= now() - interval '24 hours')::int as completed_today,
				count(*) filter (where status = 'failed' and created_at >= now() - interval '24 hours')::int as failed_today
			from scan_jobs
		`,
		adminSqlClient<CountRow[]>`
			select
				count(*) filter (where e.created_at >= now() - interval '24 hours')::int as collected_today,
				count(*) filter (
					where e.risk_level = 'high'
					and coalesce(t.status, 'new') in ('new', 'reviewing', 'action_required')
				)::int as high_risk_open
			from evidence_items e
			left join evidence_triage t on t.evidence_item_id = e.id
		`,
		adminSqlClient<CountRow[]>`
			select
				count(*) filter (where status = 'draft')::int as pending,
				count(*) filter (where status = 'approved')::int as approved
			from counter_argument_drafts
		`,
		adminSqlClient<CountRow[]>`
			select
				count(*) filter (where review_status = 'needs_review')::int as awaiting_review,
				count(*) filter (where review_status = 'approved' and state <> 'published')::int as approved_unpublished,
				count(*) filter (where state = 'published' and publication_status <> 'published')::int as ready_for_zalo,
				count(*) filter (where publication_status = 'published')::int as live_on_zalo
			from articles
		`,
	]);

	return {
		articles: {
			approvedUnpublished: articles[0]?.approved_unpublished ?? 0,
			awaitingReview: articles[0]?.awaiting_review ?? 0,
			liveOnZalo: articles[0]?.live_on_zalo ?? 0,
			readyForZalo: articles[0]?.ready_for_zalo ?? 0,
		},
		drafts: {
			approved: drafts[0]?.approved ?? 0,
			pending: drafts[0]?.pending ?? 0,
		},
		generatedAt: new Date().toISOString(),
		scans: {
			completedToday: scans[0]?.completed_today ?? 0,
			failedToday: scans[0]?.failed_today ?? 0,
			queued: scans[0]?.queued ?? 0,
			running: scans[0]?.running ?? 0,
		},
		sources: {
			active: sources[0]?.active ?? 0,
			total: sources[0]?.total ?? 0,
		},
		timeline: {
			collectedToday: timeline[0]?.collected_today ?? 0,
			highRiskOpen: timeline[0]?.high_risk_open ?? 0,
		},
	};
}
