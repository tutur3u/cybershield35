import { loadLocalEnvFile } from "@/lib/env/load-local-env";

export async function run() {

loadLocalEnvFile();

const { adminSqlClient } = await import("@/lib/db/client");

type SummaryRow = {
	analyses: number;
	analyses_without_claims: number;
	analyses_without_topics: number;
	completed_without_analysis: number;
	evidence: number;
	evidence_topics: number;
	intelligence_claims: number;
	intelligence_rollups_ready: boolean;
	low_confidence_links: number;
	orphan_topics: number;
	scans: number;
	sources: number;
	topics: number;
	unlinked_evidence: number;
	unlinked_high_risk_evidence: number;
};

try {
	const [rollupState] = await adminSqlClient<
		Array<{ claim_index_ready: boolean; rollups_ready: boolean }>
	>`
		select
			exists(select 1 from sqlite_schema where type = 'table' and name = 'intelligence_claim_index') as claim_index_ready,
			exists(select 1 from sqlite_schema where type = 'table' and name = 'intelligence_daily_rollups') as rollups_ready
	`;
	const [claimCount] = rollupState?.claim_index_ready
		? await adminSqlClient<Array<{ count: number }>>`
				select count(*) as count from intelligence_claim_index
			`
		: [{ count: 0 }];
	const [summary] = await adminSqlClient<SummaryRow[]>`
		select
			(select count(*) from sources) as sources,
			(select count(*) from scan_jobs) as scans,
			(select count(*) from evidence_items) as evidence,
			(select count(*) from analyses) as analyses,
			(select count(*) from topics) as topics,
			(select count(*) from evidence_topics) as evidence_topics,
			(select count(*) from evidence_topics where confidence < 30) as low_confidence_links,
			(
				select count(*)
				from evidence_items e
				left join evidence_topics et on et.evidence_item_id = e.id
				where et.id is null
			) as unlinked_evidence,
			(
				select count(*)
				from evidence_items e
				left join evidence_topics et on et.evidence_item_id = e.id
				where et.id is null and e.risk_level = 'high'
			) as unlinked_high_risk_evidence,
			(
				select count(*)
				from topics t
				left join evidence_topics et on et.topic_id = t.id
				where et.id is null
			) as orphan_topics,
			(
				select count(*)
				from analyses
				where json_array_length(topic_clusters) = 0
			) as analyses_without_topics,
			(
				select count(*)
				from analyses
				where json_array_length(claims) = 0
			) as analyses_without_claims,
			(
				select count(*)
				from scan_jobs sj
				left join analyses a on a.scan_job_id = sj.id
				where sj.status = 'completed' and a.id is null
			) as completed_without_analysis,
			${Boolean(rollupState?.rollups_ready)} as intelligence_rollups_ready,
			${claimCount?.count ?? 0} as intelligence_claims
	`;
	const topTopics = await adminSqlClient`
		select
			t.name,
			t.slug,
			t.risk_level as "riskLevel",
			count(et.id) as links,
			coalesce(round(avg(et.confidence)), 0) as "avgConfidence",
			coalesce(min(et.confidence), 0) as "minConfidence"
		from topics t
		left join evidence_topics et on et.topic_id = t.id
		group by t.id
		order by links desc, "avgConfidence" desc, t.name
		limit 12
	`;
	const weakLinks = await adminSqlClient`
		select
			t.name as topic,
			et.confidence,
			e.risk_level as "riskLevel",
			substr(e.quote, 1, 180) as quote
		from evidence_topics et
		join topics t on t.id = et.topic_id
		join evidence_items e on e.id = et.evidence_item_id
		where et.confidence < 30
		order by et.confidence asc, e.created_at desc
		limit 10
	`;
	const scanTopicHealth = await adminSqlClient`
		select
			sj.id as "scanJobId",
			coalesce(src.title, src.normalized_url, src.original_input) as source,
			count(distinct e.id) as evidence,
			count(distinct et.evidence_item_id) as linked,
			count(distinct et.topic_id) as topics,
			coalesce(round(avg(et.confidence)), 0) as "avgConfidence"
		from scan_jobs sj
		left join sources src on src.id = sj.source_id
		left join evidence_items e on e.scan_job_id = sj.id
		left join evidence_topics et on et.evidence_item_id = e.id
		group by sj.id, source
		order by sj.created_at desc
		limit 12
	`;

	console.log(
		JSON.stringify(
			{
				ok: true,
				recommendedActions: buildRecommendedActions(summary),
				scanTopicHealth,
				summary,
				task: "db:analyze-intelligence",
				topTopics,
				weakLinks,
			},
			null,
			2,
		),
	);
} catch (error) {
	console.error(
		JSON.stringify({
			error:
				error instanceof Error
					? error.message
					: "Failed to analyze intelligence database.",
			ok: false,
			task: "db:analyze-intelligence",
		}),
	);
	process.exitCode = 1;
} finally {
	await adminSqlClient.end({ timeout: 5 });
}

function buildRecommendedActions(summary: SummaryRow | undefined) {
	if (!summary) return ["Database returned no summary row."];
	const actions: string[] = [];

	if (!summary.intelligence_rollups_ready) {
		actions.push("Run migrations before intelligence backfill.");
	}
	if (summary.low_confidence_links > 0) {
		actions.push("Run topic backfill to replace weak evidence-topic links.");
	}
	if (summary.unlinked_high_risk_evidence > 0) {
		actions.push("Review unlinked high-risk evidence and extend topic taxonomy.");
	}
	if (summary.orphan_topics > 0) {
		actions.push("Run topic backfill to prune topics without supporting evidence.");
	}
	if (summary.completed_without_analysis > 0) {
		actions.push("Re-run analysis for completed scans missing analysis rows.");
	}
	if (!actions.length) {
		actions.push("No immediate database cleanup action detected.");
	}

	return actions;
}

}
