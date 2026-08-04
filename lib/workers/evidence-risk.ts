import "server-only";

import { eq } from "drizzle-orm";

import { adminDb, adminSqlClient } from "@/lib/db/client";
import { evidenceItems, type RiskLevel } from "@/lib/db/schema";
import { assessEvidenceRisk } from "@/lib/domain/evidence-risk";

type StoredEvidenceRisk = {
	engagement: Record<string, unknown>;
	id: string;
	metadata: Record<string, unknown>;
	quote: string;
	risk_level: RiskLevel;
	summary: string;
};

export async function reassessStoredEvidenceRisk(limit = 5_000) {
	const rows = await adminSqlClient<StoredEvidenceRisk[]>`
		select id, quote, summary, engagement, metadata, risk_level
		from evidence_items
		order by created_at desc
		limit ${limit}
	`;
	let updated = 0;

	for (let offset = 0; offset < rows.length; offset += 25) {
		const batch = rows.slice(offset, offset + 25);
		await Promise.all(
			batch.map(async (row) => {
				const assessment = assessEvidenceRisk({
					comments: finiteMetric(row.engagement.comments),
					shares: finiteMetric(row.engagement.shares),
					storedRisk: row.risk_level,
					text: `${row.quote}\n${row.summary}`,
				});
				const previousReasons = Array.isArray(row.metadata.riskReasons)
					? row.metadata.riskReasons
					: [];
				if (
					assessment.level === row.risk_level &&
					JSON.stringify(previousReasons) === JSON.stringify(assessment.reasons)
				) {
					return;
				}

				await adminDb
					.update(evidenceItems)
					.set({
						metadata: { ...row.metadata, riskReasons: assessment.reasons },
						riskLevel: assessment.level,
					})
					.where(eq(evidenceItems.id, row.id));
				updated += 1;
			}),
		);
	}

	await alignAggregateRiskLevels();
	return { checked: rows.length, updated };
}

async function alignAggregateRiskLevels() {
	await adminSqlClient`
		with scan_risk as (
			select
				scan_job_id,
				case
					when bool_or(risk_level = 'high') then 'high'::risk_level
					when bool_or(risk_level = 'medium') then 'medium'::risk_level
					else 'low'::risk_level
				end as risk_level
			from evidence_items
			group by scan_job_id
		)
		update analyses a
		set risk_level = sr.risk_level
		from scan_risk sr
		where a.scan_job_id = sr.scan_job_id
			and a.risk_level is distinct from sr.risk_level
	`;

	await adminSqlClient`
		with topic_risk as (
			select
				et.topic_id,
				case
					when bool_or(e.risk_level = 'high') then 'high'::risk_level
					when bool_or(e.risk_level = 'medium') then 'medium'::risk_level
					else 'low'::risk_level
				end as risk_level
			from evidence_topics et
			join evidence_items e on e.id = et.evidence_item_id
			group by et.topic_id
		)
		update topics t
		set risk_level = tr.risk_level, updated_at = now()
		from topic_risk tr
		where t.id = tr.topic_id
			and t.risk_level is distinct from tr.risk_level
	`;
}

function finiteMetric(value: unknown) {
	const parsed = Number(value ?? 0);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
