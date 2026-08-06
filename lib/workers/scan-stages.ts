import "server-only";

import { eq } from "drizzle-orm";

import { refreshIntelligenceRollupsBestEffort } from "@/lib/dashboard/intelligence-rollups";
import {
	analyses,
	auditEvents,
	evidenceItems,
	providerRuns,
	scanJobs,
	sources,
	trackedSources,
	type ProviderName,
	type ScanStatus,
} from "@/lib/db/schema";
import { adminDb } from "@/lib/db/client";
import { analyzeEvidence } from "@/lib/llm/generation";
import { recordScanEvent } from "@/lib/operations/telemetry";
import { runProvider } from "@/lib/providers";
import {
	isRetryableCollectionError,
	operatorMessageFor,
} from "@/lib/providers/errors";
import { runtimeMode } from "@/lib/runtime/client-runtime";
import { classifyPersistedEvidenceRisk } from "@/lib/workers/evidence-risk";
import { enqueueEvidenceDraftJobs } from "@/lib/workers/facebook-page-jobs";
import { syncTopicsForScan } from "@/lib/workers/topics";

/**
 * The scan pipeline, one stage per function.
 *
 * Each stage is addressed by scan id and reads what it needs from the database
 * rather than receiving it from the stage before. That is what lets the same
 * code run either straight through inside one request or as separate durable
 * steps: a step boundary can only carry what survives being written down, and
 * an id survives where a provider payload does not.
 *
 * The stages stay free of any workflow directive so they remain ordinary
 * functions — the durable wrapper lives in `workflows/scan-pipeline.ts`.
 */

export type ClaimedScanJob = {
	attempts: number;
	id: string;
	max_attempts: number;
	provider: ProviderName;
	source_id: string;
};

/** Mirrors the outcome onto the tracked source that scheduled the scan. */
async function markTrackedSource(scanJobId: string, status: ScanStatus) {
	await adminDb
		.update(trackedSources)
		.set({
			lastScanStatus: status,
			lastScannedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(trackedSources.lastScanJobId, scanJobId));
}

export async function recordScanClaimed(job: ClaimedScanJob) {
	await recordScanEvent({
		eventType: "scan_claimed",
		message: "Worker đã nhận scan từ hàng đợi.",
		metadata: { attempt: job.attempts, provider: job.provider },
		scanJobId: job.id,
		stage: "queue",
		status: "completed",
	});
}

/**
 * Collects from the provider and writes the evidence rows.
 *
 * By far the slowest and least reliable stage — it waits on somebody else's
 * crawler — which is why it is worth isolating: a retry should re-run this and
 * nothing else.
 */
export async function collectEvidence(job: ClaimedScanJob) {
	const [source] = await adminDb
		.select()
		.from(sources)
		.where(eq(sources.id, job.source_id))
		.limit(1);
	if (!source) throw new Error(`Source not found for job ${job.id}`);

	const [run] = await adminDb
		.insert(providerRuns)
		.values({
			input: {
				input: source.originalInput,
				runtimeMode: runtimeMode(),
				sourceId: source.id,
			},
			provider: job.provider,
			scanJobId: job.id,
			status: "running",
		})
		.returning();
	if (!run) throw new Error("Failed to create provider run");

	await recordScanEvent({
		eventType: "provider_started",
		message: "Provider bắt đầu thu thập dữ liệu.",
		metadata: { provider: job.provider, providerRunId: run.id },
		scanJobId: job.id,
		stage: "provider",
		status: "running",
	});

	const result = await runProvider(job.provider, source);

	await adminDb
		.update(providerRuns)
		.set({ completedAt: new Date(), output: result.raw, status: "completed" })
		.where(eq(providerRuns.id, run.id));
	await recordScanEvent({
		eventType: "provider_completed",
		message: "Provider đã hoàn tất thu thập dữ liệu.",
		metadata: {
			candidateCount: result.evidence.length,
			provider: result.provider,
		},
		scanJobId: job.id,
		stage: "provider",
		status: "completed",
	});

	const inserted = result.evidence.length
		? await adminDb
				.insert(evidenceItems)
				.values(
					result.evidence.map((item) => ({
						author: item.author,
						engagement: item.engagement,
						metadata: item.metadata,
						provider: result.provider,
						publishedAt: item.publishedAt,
						quote: item.quote,
						riskLevel: item.riskLevel,
						scanJobId: job.id,
						sentiment: item.sentiment,
						sourceId: source.id,
						sourceLabel: item.sourceLabel,
						sourceUrl: item.sourceUrl,
						stance: item.stance,
						summary: item.summary,
					})),
				)
				.returning({ id: evidenceItems.id })
		: [];

	return {
		credentialSource: result.credentialSource,
		evidenceCount: inserted.length,
		mode: result.mode,
	};
}

/**
 * Re-scores the evidence with the model.
 *
 * Providers attach a provisional rule-based level so collection never waits on
 * the model; this replaces it before anything downstream reads it.
 */
export async function scoreEvidenceRisk(scanJobId: string) {
	const rows = await adminDb
		.select({ id: evidenceItems.id })
		.from(evidenceItems)
		.where(eq(evidenceItems.scanJobId, scanJobId));
	const scoring = await classifyPersistedEvidenceRisk(
		rows.map((row) => row.id),
	).catch(() => ({ scored: 0, updated: 0 }));

	const scored = await adminDb
		.select()
		.from(evidenceItems)
		.where(eq(evidenceItems.scanJobId, scanJobId));
	const automatedDraftCount = await enqueueEvidenceDraftJobs(scored);

	await recordScanEvent({
		eventType: "evidence_persisted",
		message: "Bằng chứng chuẩn hóa đã được lưu và chấm mức rủi ro.",
		metadata: {
			automatedDraftCount,
			evidenceCount: scored.length,
			riskRescored: scoring.updated,
		},
		scanJobId,
		stage: "evidence",
		status: "completed",
	});

	return { evidenceCount: scored.length, riskRescored: scoring.updated };
}

export async function analyzeScan(scanJobId: string) {
	await recordScanEvent({
		eventType: "analysis_started",
		message: "AI bắt đầu phân tích bằng chứng.",
		scanJobId,
		stage: "analysis",
		status: "running",
	});

	const evidence = await adminDb
		.select({
			id: evidenceItems.id,
			quote: evidenceItems.quote,
			riskLevel: evidenceItems.riskLevel,
			summary: evidenceItems.summary,
		})
		.from(evidenceItems)
		.where(eq(evidenceItems.scanJobId, scanJobId));

	const analysis = await analyzeEvidence(evidence);

	await adminDb
		.insert(analyses)
		.values({
			claims: analysis.claims,
			riskFlags: analysis.riskFlags,
			riskLevel: analysis.riskLevel,
			scanJobId,
			sentiment: analysis.sentiment,
			stanceSummary: analysis.stanceSummary,
			summary: analysis.summary,
			topicClusters: analysis.topicClusters,
		})
		.onConflictDoUpdate({
			set: {
				claims: analysis.claims,
				riskFlags: analysis.riskFlags,
				riskLevel: analysis.riskLevel,
				sentiment: analysis.sentiment,
				stanceSummary: analysis.stanceSummary,
				summary: analysis.summary,
				topicClusters: analysis.topicClusters,
			},
			target: analyses.scanJobId,
		});

	await recordScanEvent({
		eventType: "analysis_completed",
		message: "Phân tích rủi ro và lập trường đã hoàn tất.",
		metadata: { riskLevel: analysis.riskLevel },
		scanJobId,
		stage: "analysis",
		status: "completed",
	});

	return { riskLevel: analysis.riskLevel };
}

/**
 * Reads the clusters back from the persisted analysis rather than taking them
 * from the stage before, so the two stages can be separated in time.
 */
export async function syncScanTopics(scanJobId: string) {
	const [analysis] = await adminDb
		.select({ topicClusters: analyses.topicClusters })
		.from(analyses)
		.where(eq(analyses.scanJobId, scanJobId))
		.limit(1);

	await syncTopicsForScan(scanJobId, analysis?.topicClusters ?? []);

	const topicCount = Array.isArray(analysis?.topicClusters)
		? analysis.topicClusters.length
		: 0;
	await recordScanEvent({
		eventType: "topics_completed",
		message: "Chủ đề và liên kết bằng chứng đã được cập nhật.",
		metadata: { topicCount },
		scanJobId,
		stage: "topics",
		status: "completed",
	});

	return { topicCount };
}

export async function completeScan(input: {
	credentialSource?: string;
	evidenceCount: number;
	mode?: string;
	scanJobId: string;
	startedAtMs: number;
}) {
	await adminDb
		.update(scanJobs)
		.set({
			completedAt: new Date(),
			errorMessage: null,
			status: "completed",
			updatedAt: new Date(),
		})
		.where(eq(scanJobs.id, input.scanJobId));

	await markTrackedSource(input.scanJobId, "completed");
	await adminDb.insert(auditEvents).values({
		action: "processed",
		entityId: input.scanJobId,
		entityType: "scan_job",
		payload: {
			credentialSource: input.credentialSource,
			evidenceCount: input.evidenceCount,
			providerMode: input.mode,
		},
	});
	await recordScanEvent({
		eventType: "scan_completed",
		message: "Scan đã hoàn tất toàn bộ pipeline.",
		metadata: {
			durationMs: Date.now() - input.startedAtMs,
			evidenceCount: input.evidenceCount,
		},
		scanJobId: input.scanJobId,
		stage: "complete",
		status: "completed",
	});
	await refreshIntelligenceRollupsBestEffort(
		`scan-processed:${input.scanJobId}`,
	);
}

/**
 * Records a scan that could not finish, and decides whether it is worth
 * another attempt.
 *
 * A terminal fault must not consume the retry budget: retrying an exhausted
 * account quota keeps every scan in a "Thử lại" state that reads like recovery
 * in progress, when nothing will change until someone intervenes.
 */
export async function failScan(input: {
	attempts: number;
	error: unknown;
	maxAttempts: number;
	/**
	 * Overrides the classification when the caller already made the decision.
	 *
	 * A durable step boundary does not carry an error across intact, so the
	 * workflow decides retryability where the error is still real and passes the
	 * answer rather than a reconstructed exception.
	 */
	retryable?: boolean;
	scanJobId: string;
	startedAtMs: number;
}) {
	const raw =
		input.error instanceof Error ? input.error.message : String(input.error);
	// Prefer the operator-facing explanation when the provider gave us one: the
	// raw text ("Monthly usage hard limit exceeded") tells the person reading the
	// queue nothing about what they should do next.
	const message = operatorMessageFor(input.error) ?? raw;
	const retryable = input.retryable ?? isRetryableCollectionError(input.error);
	const nextStatus: ScanStatus =
		retryable && input.attempts < input.maxAttempts ? "retrying" : "failed";

	await adminDb
		.update(scanJobs)
		.set({
			completedAt: nextStatus === "failed" ? new Date() : null,
			errorMessage: message,
			scheduledAt:
				nextStatus === "retrying" ? new Date(Date.now() + 60_000) : new Date(),
			status: nextStatus,
			updatedAt: new Date(),
		})
		.where(eq(scanJobs.id, input.scanJobId));

	await markTrackedSource(input.scanJobId, nextStatus);
	await adminDb.insert(auditEvents).values({
		action: "failed",
		entityId: input.scanJobId,
		entityType: "scan_job",
		payload: { message, nextStatus },
	});
	await recordScanEvent({
		eventType: nextStatus === "retrying" ? "scan_retry_scheduled" : "scan_failed",
		message:
			nextStatus === "retrying"
				? "Scan gặp lỗi và đã được lên lịch thử lại."
				: "Scan đã dừng sau khi hết số lần thử.",
		metadata: {
			attempt: input.attempts,
			durationMs: Date.now() - input.startedAtMs,
			errorType: input.error instanceof Error ? input.error.name : "UnknownError",
			nextStatus,
		},
		scanJobId: input.scanJobId,
		stage: "complete",
		status: "failed",
	});
	await refreshIntelligenceRollupsBestEffort(`scan-failed:${input.scanJobId}`);

	return { message, nextStatus };
}
