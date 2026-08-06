import "server-only";

import { eq, inArray } from "drizzle-orm";

import { refreshIntelligenceRollupsBestEffort } from "@/lib/dashboard/intelligence-rollups";
import { adminDb, adminSqlClient } from "@/lib/db/client";
import { evidenceItems, type RiskLevel } from "@/lib/db/schema";
import { assessEvidenceRisk } from "@/lib/domain/evidence-risk";
import {
	classifyEvidenceRisk,
	isRiskClassificationAvailable,
	type EvidenceRiskInput,
	type EvidenceSentiment,
	type EvidenceStance,
} from "@/lib/llm/risk-classification";

type StoredEvidenceRisk = {
	author: string | null;
	engagement: Record<string, unknown>;
	id: string;
	metadata: Record<string, unknown>;
	quote: string;
	risk_level: RiskLevel;
	sentiment: string;
	source_label: string | null;
	stance: string;
	summary: string;
};

type ScoredEvidence = {
	categories: string[];
	confidence: number | null;
	id: string;
	level: RiskLevel;
	reasons: string[];
	/**
	 * Left null by the rule-based fallback, which cannot judge either. A null
	 * keeps whatever is stored rather than overwriting a model verdict with a
	 * guess when the provider is briefly unavailable.
	 */
	sentiment: EvidenceSentiment | null;
	source: "llm" | "rules";
	stance: EvidenceStance | null;
};

/**
 * Re-scores stored evidence with the LLM classifier, then re-ranks every
 * projection so dashboards reflect the new posture instead of the previous one.
 */
export async function reassessStoredEvidenceRisk(limit = 5_000) {
	// Unjudged rows first, newest within that. Ordering purely by recency meant a
	// repeated run re-read the same newest page forever and never reached the
	// backlog it existed to clear.
	const rows = await adminSqlClient<StoredEvidenceRisk[]>`
		select id, quote, summary, author, source_label, engagement, metadata,
			risk_level, sentiment, stance
		from evidence_items
		order by
			case when metadata->>'riskClassifier' = 'llm' then 1 else 0 end,
			created_at desc
		limit ${limit}
	`;
	const scored = await scoreEvidenceRows(rows);
	let updated = 0;
	let llmScored = 0;

	for (let offset = 0; offset < rows.length; offset += 25) {
		const batch = rows.slice(offset, offset + 25);
		await Promise.all(
			batch.map(async (row) => {
				const assessment = scored.get(row.id);
				if (!assessment) return;
				if (assessment.source === "llm") llmScored += 1;
				if (!hasAssessmentChanged(row, assessment)) return;

				await adminDb
					.update(evidenceItems)
					.set({
						metadata: riskMetadata(row.metadata, assessment),
						riskLevel: assessment.level,
						...(assessment.sentiment ? { sentiment: assessment.sentiment } : {}),
						...(assessment.stance ? { stance: assessment.stance } : {}),
					})
					.where(eq(evidenceItems.id, row.id));
				updated += 1;
			}),
		);
	}

	await alignAggregateRiskLevels();
	await refreshIntelligenceRollupsBestEffort("evidence-risk-reassessment");
	return {
		checked: rows.length,
		classifier: isRiskClassificationAvailable() ? "llm" : "rules",
		llmScored,
		updated,
	};
}

/**
 * Scores freshly ingested evidence during a scan. Provider adapters only attach a
 * provisional rule-based level so the pipeline never blocks on the LLM; this pass
 * replaces it with the model verdict as soon as the rows exist.
 */
export async function classifyPersistedEvidenceRisk(evidenceIds: string[]) {
	if (!evidenceIds.length) return { scored: 0, updated: 0 };
	const rows = await adminDb
		.select({
			author: evidenceItems.author,
			engagement: evidenceItems.engagement,
			id: evidenceItems.id,
			metadata: evidenceItems.metadata,
			quote: evidenceItems.quote,
			risk_level: evidenceItems.riskLevel,
			sentiment: evidenceItems.sentiment,
			source_label: evidenceItems.sourceLabel,
			stance: evidenceItems.stance,
			summary: evidenceItems.summary,
		})
		.from(evidenceItems)
		.where(inArray(evidenceItems.id, evidenceIds));
	const scored = await scoreEvidenceRows(rows as StoredEvidenceRisk[]);
	let updated = 0;

	for (const row of rows as StoredEvidenceRisk[]) {
		const assessment = scored.get(row.id);
		if (!assessment || !hasAssessmentChanged(row, assessment)) continue;
		await adminDb
			.update(evidenceItems)
			.set({
				metadata: riskMetadata(row.metadata, assessment),
				riskLevel: assessment.level,
				...(assessment.sentiment ? { sentiment: assessment.sentiment } : {}),
				...(assessment.stance ? { stance: assessment.stance } : {}),
			})
			.where(eq(evidenceItems.id, row.id));
		updated += 1;
	}

	return { scored: scored.size, updated };
}

async function scoreEvidenceRows(rows: StoredEvidenceRisk[]) {
	const inputs: EvidenceRiskInput[] = rows.map((row) => ({
		author: row.author,
		comments: finiteMetric(row.engagement?.comments),
		id: row.id,
		reactions: finiteMetric(row.engagement?.reactions),
		shares: finiteMetric(row.engagement?.shares),
		sourceLabel: row.source_label,
		text: `${row.quote}\n${row.summary}`.trim(),
	}));
	const classified = await classifyEvidenceRisk(inputs).catch(
		() => new Map<string, never>(),
	);
	const scored = new Map<string, ScoredEvidence>();

	for (const row of rows) {
		const verdict = classified.get(row.id);
		if (verdict) {
			scored.set(row.id, {
				categories: verdict.categories,
				confidence: verdict.confidence,
				id: row.id,
				level: verdict.level,
				reasons: [verdict.rationale],
				sentiment: verdict.sentiment,
				source: "llm",
				stance: verdict.stance,
			});
			continue;
		}
		const fallback = assessEvidenceRisk({
			comments: finiteMetric(row.engagement?.comments),
			shares: finiteMetric(row.engagement?.shares),
			storedRisk: row.risk_level,
			text: `${row.quote}\n${row.summary}`,
		});
		scored.set(row.id, {
			categories: fallback.categories,
			confidence: null,
			id: row.id,
			level: fallback.level,
			reasons: fallback.reasons,
			sentiment: null,
			source: "rules",
			stance: null,
		});
	}

	return scored;
}

/**
 * Whether anything the model decided differs from what is stored.
 *
 * Covers sentiment and stance as well as risk: an item whose risk is unchanged
 * but whose sentiment finally has a real value would otherwise be skipped, and
 * the backfill would leave the field exactly as it found it.
 */
function hasAssessmentChanged(
	row: StoredEvidenceRisk,
	assessment: ScoredEvidence,
) {
	const previousReasons = Array.isArray(row.metadata?.riskReasons)
		? row.metadata.riskReasons
		: [];
	const previousCategories = Array.isArray(row.metadata?.riskCategories)
		? row.metadata.riskCategories
		: [];
	return (
		assessment.level !== row.risk_level ||
		(assessment.sentiment !== null && assessment.sentiment !== row.sentiment) ||
		(assessment.stance !== null && assessment.stance !== row.stance) ||
		row.metadata?.riskClassifier !== assessment.source ||
		JSON.stringify(previousReasons) !== JSON.stringify(assessment.reasons) ||
		JSON.stringify(previousCategories) !== JSON.stringify(assessment.categories)
	);
}

function riskMetadata(
	metadata: Record<string, unknown>,
	assessment: ScoredEvidence,
) {
	return {
		...metadata,
		riskCategories: assessment.categories,
		riskClassifier: assessment.source,
		riskConfidence: assessment.confidence,
		riskReasons: assessment.reasons,
		riskScoredAt: new Date().toISOString(),
	};
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
					when count(*) filter (where e.risk_level = 'high') >= greatest(3, ceil(count(*) * 0.15)) then 'high'::risk_level
					when count(*) filter (where e.risk_level in ('high', 'medium')) >= greatest(3, ceil(count(*) * 0.20)) then 'medium'::risk_level
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
