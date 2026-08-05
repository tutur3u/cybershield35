import "server-only";

import { createHash } from "node:crypto";

import { desc } from "drizzle-orm";

import { adminDb, adminSqlClient } from "@/lib/db/client";
import {
	analyses,
	intelligenceClaimIndex,
	type AnalysisRow,
} from "@/lib/db/schema";

type ClaimCandidate = {
	claim?: unknown;
	confidence?: unknown;
	evidenceIds?: unknown;
	stance?: unknown;
};

type ScanContextRow = {
	evidence_ids: string[] | null;
	evidence_risks: Record<string, string> | null;
	scan_job_id: string;
	source_labels: string[] | null;
	topic_slugs: string[] | null;
};

export async function backfillIntelligenceRollups() {
	await refreshIntelligenceRollups("manual-backfill");
}

export async function refreshIntelligenceForScan(scanId: string) {
	await refreshIntelligenceRollups(`scan:${scanId}`);
}

export async function refreshIntelligenceRollups(reason = "refresh") {
	await clearRollups();
	await Promise.all([
		refreshDailyRollups(),
		refreshTopicRollups(),
		refreshSourceRollups(),
		refreshProviderRollups(),
		refreshClaimIndex(),
		refreshActivityRollups(reason),
	]);
}

export async function refreshIntelligenceRollupsBestEffort(
	reason = "best-effort",
) {
	try {
		await refreshIntelligenceRollups(reason);
	} catch {
		// Rollups are a read-optimization layer. Mutations should not fail just
		// because a projection refresh is temporarily unavailable during deploys.
	}
}

async function clearRollups() {
	await Promise.all([
		adminSqlClient`delete from intelligence_activity_rollups`,
		adminSqlClient`delete from intelligence_claim_index`,
		adminSqlClient`delete from intelligence_provider_rollups`,
		adminSqlClient`delete from intelligence_source_rollups`,
		adminSqlClient`delete from intelligence_topic_rollups`,
		adminSqlClient`delete from intelligence_daily_rollups`,
	]);
}

async function refreshDailyRollups() {
	await adminSqlClient`
		with days as (
			select created_at::date as day from scan_jobs
			union
			select created_at::date as day from evidence_items
			union
			select created_at::date as day from counter_argument_drafts
		),
		scan_counts as (
			select
				created_at::date as day,
				count(*)::int as scan_count,
				count(*) filter (where status = 'queued')::int as queued_scan_count,
				count(*) filter (where status = 'running')::int as running_scan_count,
				count(*) filter (where status = 'completed')::int as completed_scan_count,
				count(*) filter (where status = 'failed')::int as failed_scan_count,
				count(*) filter (where status = 'retrying')::int as retrying_scan_count
			from scan_jobs
			group by created_at::date
		),
		evidence_counts as (
			select
				e.created_at::date as day,
				count(*)::int as evidence_count,
				count(*) filter (where e.risk_level = 'high')::int as high_risk_evidence_count,
				count(*) filter (where e.risk_level = 'medium')::int as medium_risk_evidence_count,
				count(*) filter (where e.risk_level = 'low')::int as low_risk_evidence_count
			from evidence_items e
			group by e.created_at::date
		),
		analysis_counts as (
			select
				sj.created_at::date as day,
				coalesce(sum(jsonb_array_length(a.claims)), 0)::int as claim_count,
				coalesce(sum(jsonb_array_length(a.risk_flags)), 0)::int as risk_flag_count
			from analyses a
			join scan_jobs sj on sj.id = a.scan_job_id
			group by sj.created_at::date
		),
		draft_counts as (
			select
				created_at::date as day,
				count(*)::int as draft_count,
				count(*) filter (where status = 'approved')::int as approved_draft_count
			from counter_argument_drafts
			group by created_at::date
		)
		insert into intelligence_daily_rollups (
			day,
			scan_count,
			queued_scan_count,
			running_scan_count,
			completed_scan_count,
			failed_scan_count,
			retrying_scan_count,
			evidence_count,
			high_risk_evidence_count,
			medium_risk_evidence_count,
			low_risk_evidence_count,
			claim_count,
			risk_flag_count,
			draft_count,
			approved_draft_count,
			report_ready_count,
			updated_at
		)
		select
			days.day,
			coalesce(sc.scan_count, 0),
			coalesce(sc.queued_scan_count, 0),
			coalesce(sc.running_scan_count, 0),
			coalesce(sc.completed_scan_count, 0),
			coalesce(sc.failed_scan_count, 0),
			coalesce(sc.retrying_scan_count, 0),
			coalesce(ec.evidence_count, 0),
			coalesce(ec.high_risk_evidence_count, 0),
			coalesce(ec.medium_risk_evidence_count, 0),
			coalesce(ec.low_risk_evidence_count, 0),
			coalesce(ac.claim_count, 0),
			coalesce(ac.risk_flag_count, 0),
			coalesce(dc.draft_count, 0),
			coalesce(dc.approved_draft_count, 0),
			least(coalesce(sc.completed_scan_count, 0), coalesce(dc.approved_draft_count, 0))::int,
			now()
		from days
		left join scan_counts sc on sc.day = days.day
		left join evidence_counts ec on ec.day = days.day
		left join analysis_counts ac on ac.day = days.day
		left join draft_counts dc on dc.day = days.day
		order by days.day;
	`;
}

async function refreshTopicRollups() {
	await adminSqlClient`
		with topic_analysis as (
			select
				et.topic_id,
				a.id as analysis_id,
				jsonb_array_length(a.claims)::int as claim_count
			from evidence_topics et
			join analyses a on a.scan_job_id = et.scan_job_id
			group by et.topic_id, a.id, a.claims
		),
		topic_claims as (
			select topic_id, coalesce(sum(claim_count), 0)::int as claim_count
			from topic_analysis
			group by topic_id
		)
		insert into intelligence_topic_rollups (
			topic_id,
			slug,
			name,
			risk_level,
			trend,
			momentum_score,
			evidence_count,
			high_risk_evidence_count,
			claim_count,
			scan_count,
			source_count,
			first_seen_at,
			last_seen_at,
			updated_at
		)
		select
			t.id,
			t.slug,
			t.name,
			t.risk_level,
			t.trend,
			least(
				100,
				(count(distinct et.evidence_item_id) * 6)
					+ (count(distinct et.scan_job_id) * 8)
					+ (count(distinct et.evidence_item_id) filter (where ei.risk_level = 'high') * 12)
			)::int as momentum_score,
			count(distinct et.evidence_item_id)::int,
			count(distinct et.evidence_item_id) filter (where ei.risk_level = 'high')::int,
			coalesce(max(tc.claim_count), 0)::int,
			count(distinct et.scan_job_id)::int,
			count(distinct ei.source_id)::int,
			coalesce(min(et.created_at), t.first_seen_at),
			coalesce(max(et.created_at), t.last_seen_at),
			now()
		from topics t
		left join evidence_topics et on et.topic_id = t.id
		left join evidence_items ei on ei.id = et.evidence_item_id
		left join topic_claims tc on tc.topic_id = t.id
		group by t.id, t.slug, t.name, t.risk_level, t.trend, t.first_seen_at, t.last_seen_at
		order by momentum_score desc, evidence_count desc;
	`;
}

async function refreshSourceRollups() {
	await adminSqlClient`
		with source_scan_counts as (
			select
				s.source_id,
				count(*)::int as scan_count,
				count(*) filter (where s.status = 'completed')::int as completed_scan_count,
				count(*) filter (where s.status = 'failed')::int as failed_scan_count
			from scan_jobs s
			group by s.source_id
		),
		source_evidence_counts as (
			select
				source_id,
				count(*)::int as evidence_count,
				count(*) filter (where risk_level = 'high')::int as high_risk_evidence_count
			from evidence_items
			group by source_id
		),
		last_scans as (
			select distinct on (source_id)
				source_id,
				id as scan_job_id,
				provider,
				status,
				coalesce(completed_at, started_at, updated_at, created_at) as last_scanned_at
			from scan_jobs
			order by source_id, coalesce(completed_at, started_at, updated_at, created_at) desc
		)
		insert into intelligence_source_rollups (
			source_id,
			source_label,
			source_type,
			provider,
			health,
			scan_count,
			completed_scan_count,
			failed_scan_count,
			evidence_count,
			high_risk_evidence_count,
			last_scan_job_id,
			last_scanned_at,
			updated_at
		)
		select
			src.id,
			coalesce(src.title, src.file_name, src.normalized_url, src.original_input, 'Nguồn chưa đặt tên'),
			src.type,
			ls.provider,
			case
				when ls.status = 'failed' then 'blocked'
				when ls.last_scanned_at is null then 'unseen'
				when ls.last_scanned_at < now() - interval '7 days' then 'stale'
				when ls.status in ('queued', 'retrying', 'running') then 'attention'
				else 'healthy'
			end,
			coalesce(ssc.scan_count, 0),
			coalesce(ssc.completed_scan_count, 0),
			coalesce(ssc.failed_scan_count, 0),
			coalesce(sec.evidence_count, 0),
			coalesce(sec.high_risk_evidence_count, 0),
			ls.scan_job_id,
			ls.last_scanned_at,
			now()
		from sources src
		left join source_scan_counts ssc on ssc.source_id = src.id
		left join source_evidence_counts sec on sec.source_id = src.id
		left join last_scans ls on ls.source_id = src.id;
	`;
}

async function refreshProviderRollups() {
	await adminSqlClient`
		with last_runs as (
			select distinct on (provider)
				provider,
				status,
				coalesce(completed_at, started_at) as last_run_at
			from provider_runs
			order by provider, coalesce(completed_at, started_at) desc
		),
		run_counts as (
			select
				provider,
				count(*)::int as scan_count,
				count(*) filter (where status = 'completed')::int as completed_run_count,
				count(*) filter (where status = 'failed')::int as failed_run_count,
				coalesce(avg(extract(epoch from (completed_at - started_at)) * 1000) filter (where completed_at is not null), 0)::int as avg_duration_ms
			from provider_runs
			group by provider
		)
		insert into intelligence_provider_rollups (
			provider,
			health,
			scan_count,
			completed_run_count,
			failed_run_count,
			avg_duration_ms,
			last_status,
			last_run_at,
			updated_at
		)
		select
			rc.provider,
			case
				when lr.status = 'failed' then 'blocked'
				when lr.last_run_at is null then 'unseen'
				when lr.last_run_at < now() - interval '7 days' then 'stale'
				else 'healthy'
			end,
			rc.scan_count,
			rc.completed_run_count,
			rc.failed_run_count,
			rc.avg_duration_ms,
			lr.status,
			lr.last_run_at,
			now()
		from run_counts rc
		left join last_runs lr on lr.provider = rc.provider;
	`;
}

async function refreshClaimIndex() {
	const [analysesRows, contextRows] = await Promise.all([
		adminDb.select().from(analyses).orderBy(desc(analyses.createdAt)),
		adminSqlClient<ScanContextRow[]>`
			select
				sj.id as scan_job_id,
				coalesce(array_agg(distinct ei.id::text) filter (where ei.id is not null), '{}') as evidence_ids,
				coalesce(jsonb_object_agg(ei.id::text, ei.risk_level) filter (where ei.id is not null), '{}'::jsonb) as evidence_risks,
				coalesce(array_agg(distinct nullif(ei.source_label, '')) filter (where ei.source_label is not null), '{}') as source_labels,
				coalesce(array_agg(distinct t.slug) filter (where t.slug is not null), '{}') as topic_slugs
			from scan_jobs sj
			left join evidence_items ei on ei.scan_job_id = sj.id
			left join evidence_topics et on et.evidence_item_id = ei.id
			left join topics t on t.id = et.topic_id
			group by sj.id;
		`,
	]);
	const contextByScan = new Map(
		contextRows.map((row) => [
			row.scan_job_id,
			{
				evidenceIds: normalizeStringArray(row.evidence_ids),
				evidenceRisks: normalizeRiskRecord(row.evidence_risks),
				sourceLabels: normalizeStringArray(row.source_labels),
				topicSlugs: normalizeStringArray(row.topic_slugs),
			},
		]),
	);
	const values = analysesRows.flatMap((analysis) =>
		normalizeClaimsForAnalysis(analysis, contextByScan.get(analysis.scanJobId)),
	);

	if (!values.length) return;
	await adminDb.insert(intelligenceClaimIndex).values(values);
}

async function refreshActivityRollups(reason: string) {
	await adminSqlClient`
		insert into intelligence_activity_rollups (
			entity_type,
			entity_id,
			action,
			severity,
			title,
			description,
			href,
			occurred_at,
			metadata
		)
		select
			a.entity_type,
			a.entity_id,
			a.action,
			-- Notability of the event, not risk of the content. Deleting an article
			-- is ordinary editorial work, so only a broken pipeline step is
			-- 'high'; everything that merely moves an item through review is
			-- 'medium'; the rest is routine and renders without a badge.
			case
				when a.action = 'failed' then 'high'::risk_level
				when a.action in (
					'article_deleted',
					'deleted',
					'article_review_needs_review',
					'article_review_rejected',
					'article_removed_from_zalo',
					'review_status_updated',
					'evidence_triage_updated',
					'rescan_created'
				) then 'medium'::risk_level
				else 'low'::risk_level
			end,
			case a.action
				when 'created' then 'Đã tạo lượt quét'
				when 'processed' then 'Đã quét xong nguồn'
				when 'failed' then 'Lượt quét gặp lỗi'
				when 'deleted' then 'Đã xóa lượt quét'
				when 'rescan_created' then 'Đã tạo lượt quét lại'
				when 'analysis_revised' then 'Đã cập nhật phân tích'
				when 'draft_generated' then 'Đã soạn bản nháp phản hồi'
				when 'draft_content_updated' then 'Đã sửa nội dung bản nháp'
				when 'review_status_updated' then 'Đã cập nhật trạng thái duyệt'
				when 'evidence_triage_updated' then 'Đã cập nhật xử lý nội dung'
				when 'evidence_triage_note_added' then 'Đã thêm ghi chú xử lý'
				when 'article_created' then 'Đã tạo bài viết'
				when 'article_updated' then 'Đã sửa bài viết'
				when 'article_deleted' then 'Đã xóa bài viết'
				when 'article_review_needs_review' then 'Bài viết chờ duyệt'
				when 'article_review_approved' then 'Đã phê duyệt bài viết'
				when 'article_review_rejected' then 'Đã từ chối bài viết'
				when 'article_sync_hidden_queued' then 'Đang chuẩn bị bản ẩn trên Zalo'
				when 'article_synced_hidden' then 'Đã đồng bộ bản ẩn lên Zalo'
				when 'article_published_internally' then 'Đã xuất bản bài viết'
				when 'article_removed_from_zalo' then 'Đã gỡ bài khỏi Zalo'
				when 'article_schedule_cancelled' then 'Đã hủy lịch đăng bài'
				when 'article_evidence_added' then 'Đã gắn thêm dẫn chứng'
				when 'article_headline_regenerated' then 'Đã chuẩn hóa tiêu đề bài viết'
				when 'zalo_oa_connected' then 'Đã kết nối Zalo OA'
				else initcap(replace(a.action, '_', ' '))
			end,
			case a.entity_type
				when 'scan_job' then 'Diễn ra trong quá trình thu thập và phân tích nguồn.'
				when 'evidence_item' then 'Thay đổi trên một bài viết trong dòng thời gian.'
				when 'counter_argument_draft' then 'Thay đổi trên một bản nháp phản hồi.'
				when 'article' then 'Thay đổi trên một bài viết của CyberShield35.'
				when 'zalo_oa_connection' then 'Thay đổi trên kết nối Zalo OA.'
				else 'Thay đổi được ghi lại để truy vết.'
			end,
			case
				when a.entity_type = 'scan_job' then '/scans/' || a.entity_id::text
				when a.entity_type = 'evidence_item' then '/evidence/' || a.entity_id::text
				when a.entity_type = 'counter_argument_draft' then '/drafts/' || a.entity_id::text
				when a.entity_type = 'article' then '/articles/' || a.entity_id::text
				else '/audit'
			end,
			a.created_at,
			jsonb_build_object('projectionReason', ${reason}::text)
		from audit_events a
		-- Reconciliation and bulk-normalization passes fire on hundreds of rows at a
		-- time and would bury the events an operator actually needs to see.
		where a.action not in (
			'article_metadata_updated',
			'article_headline_regenerated'
		)
		order by a.created_at desc
		limit 250;
	`;
}

function normalizeClaimsForAnalysis(
	analysis: AnalysisRow,
	context:
		| {
				evidenceIds: string[];
				evidenceRisks: Record<string, "high" | "low" | "medium">;
				sourceLabels: string[];
				topicSlugs: string[];
		  }
		| undefined,
) {
	if (!Array.isArray(analysis.claims)) return [];
	const sourceLabels = context?.sourceLabels ?? [];
	const topicSlugs = context?.topicSlugs ?? [];
	// The model cites evidence by whatever identifier it chose, which is often a
	// shortened or invented string rather than a real row id. Linking those built
	// URLs like /evidence/8d315204 that 404, and left every claim inheriting the
	// analysis-level risk because no lookup ever matched.
	const realEvidenceIds = new Set(context?.evidenceIds ?? []);

	return analysis.claims
		.map((candidate, index) => {
			const claim = normalizeClaim(candidate);
			if (!claim.claim) return null;
			const evidenceIds = resolveClaimEvidenceIds(
				claim.evidenceIds,
				realEvidenceIds,
			);
			const claimKey = stableClaimKey(analysis.id, claim.claim, index);

			return {
				analysisId: analysis.id,
				claim: claim.claim,
				claimKey,
				confidence: claim.confidence,
				createdAt: analysis.createdAt,
				deepLink: `/alerts?claim=${encodeURIComponent(claimKey)}`,
				evidenceCount: evidenceIds.length,
				evidenceIds,
				riskLevel: claimRiskLevel(evidenceIds, context?.evidenceRisks, analysis.riskLevel),
				scanJobId: analysis.scanJobId,
				sourceLabels,
				stance: claim.stance,
				topicSlugs,
				updatedAt: new Date(),
			};
		})
		.filter((value): value is NonNullable<typeof value> => Boolean(value));
}

function normalizeClaim(candidate: unknown) {
	if (!candidate || typeof candidate !== "object") {
		return {
			claim: typeof candidate === "string" ? candidate : "",
			confidence: 0,
			evidenceIds: [],
			stance: "neutral",
		};
	}
	const record = candidate as ClaimCandidate;
	const claim = typeof record.claim === "string" ? record.claim.trim() : "";
	const confidence = normalizeConfidence(record.confidence);
	const evidenceIds = normalizeStringArray(record.evidenceIds);
	const stance = typeof record.stance === "string" ? record.stance : "neutral";

	return { claim, confidence, evidenceIds, stance };
}

/**
 * Keeps only citations that name evidence this analysis actually has.
 *
 * A prefix match is accepted because models routinely shorten a UUID; anything
 * ambiguous or unmatched is dropped rather than turned into a dead link.
 */
function resolveClaimEvidenceIds(cited: string[], real: Set<string>) {
	const resolved = new Set<string>();
	for (const candidate of cited) {
		const id = candidate.trim();
		if (!id) continue;
		if (real.has(id)) {
			resolved.add(id);
			continue;
		}
		const prefixMatches = [...real].filter((value) => value.startsWith(id));
		if (prefixMatches.length === 1 && id.length >= 8) {
			resolved.add(prefixMatches[0] as string);
		}
	}
	return [...resolved];
}

function claimRiskLevel(
	evidenceIds: string[],
	riskByEvidenceId: Record<string, "high" | "low" | "medium"> | undefined,
	fallback: "high" | "low" | "medium",
) {
	const levels = evidenceIds.flatMap((id) => riskByEvidenceId?.[id] ?? []);
	if (levels.includes("high")) return "high";
	if (levels.includes("medium")) return "medium";
	if (levels.includes("low")) return "low";
	return fallback;
}

function normalizeRiskRecord(value: Record<string, string> | null) {
	return Object.fromEntries(
		Object.entries(value ?? {}).filter(
			(entry): entry is [string, "high" | "low" | "medium"] =>
				entry[1] === "high" || entry[1] === "medium" || entry[1] === "low",
		),
	);
}

function normalizeConfidence(value: unknown) {
	const parsed = Number(value ?? 0);
	if (!Number.isFinite(parsed)) return 0;
	const scaled = parsed <= 1 ? parsed * 100 : parsed;
	return Math.max(0, Math.min(100, Math.round(scaled)));
}

function normalizeStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => (typeof item === "string" ? item.trim() : ""))
		.filter(Boolean);
}

function stableClaimKey(analysisId: string, claim: string, index: number) {
	const digest = createHash("sha256")
		.update(`${analysisId}:${index}:${claim}`)
		.digest("hex")
		.slice(0, 16);
	return `claim_${digest}`;
}
