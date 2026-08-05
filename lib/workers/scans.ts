import { NoObjectGeneratedError } from "ai";
import { and, desc, eq, inArray, max, ne } from "drizzle-orm";

import { adminDb, adminSqlClient } from "@/lib/db/client";
import { refreshIntelligenceRollupsBestEffort } from "@/lib/dashboard/intelligence-rollups";
import {
	analyses,
	auditEvents,
	counterArgumentDrafts,
	counterArgumentDraftVersions,
	cronHeartbeats,
	evidenceItems,
	providerRuns,
	scanJobs,
	sources,
	trackedSources,
	type DraftStatus,
	type ProviderName,
	type RiskLevel,
	type ScanStatus,
	type SourceType,
} from "@/lib/db/schema";
import {
	resolveScanProvider,
	type ScanProviderOverride,
} from "@/lib/domain/provider-override";
import type { TuturuuuAdminSession } from "@/lib/auth/tuturuuu-session";
import { cleanDraftContent } from "@/lib/domain/draft-content";
import { resolveDraftGenerationStyle } from "@/lib/domain/draft-style";
import { detectSource } from "@/lib/domain/source-detection";
import { invalidateEvidenceSemanticProfile } from "@/lib/workers/evidence-semantics";
import {
	analyzeEvidence,
	generateCounterArgumentWithEvidenceFallback,
	reviseCounterArgumentWithEvidenceFallback,
} from "@/lib/llm/generation";
import type { AnalysisOutput } from "@/lib/llm/schemas";
import { runProvider } from "@/lib/providers";
import {
	isRetryableCollectionError,
	operatorMessageFor,
} from "@/lib/providers/errors";
import {
	runtimeKeySummary,
	runtimeMode,
} from "@/lib/runtime/client-runtime";
import { recordScanEvent } from "@/lib/operations/telemetry";
import {
	syncExistingAnalysisTopicsForScan,
	syncTopicsForScan,
} from "@/lib/workers/topics";
import { enqueueEvidenceDraftJobs } from "@/lib/workers/facebook-page-jobs";
import { classifyPersistedEvidenceRisk } from "@/lib/workers/evidence-risk";

type ClaimedJob = {
	id: string;
	source_id: string;
	provider: ProviderName;
	attempts: number;
	max_attempts: number;
};

export type CreateScanInput = {
	clientRequestId?: string;
	input: string;
	fileName?: string;
	mimeType?: string;
	fileText?: string;
	title?: string;
	providerOverride?: ScanProviderOverride;
	requestedByDisplayName?: string | null;
	requestedByUserId?: string;
	trigger?: string;
};

export type UpdateScanInput = {
	status?: ScanStatus;
	title?: string;
};

export type CreateEvidenceInput = {
	author?: string | null;
	quote: string;
	riskLevel?: RiskLevel;
	scanJobId: string;
	sentiment?: string;
	sourceLabel?: string | null;
	sourceUrl?: string | null;
	stance?: string;
	summary: string;
};

export type UpdateEvidenceInput = {
	author?: string | null;
	quote?: string;
	riskLevel?: RiskLevel;
	sentiment?: string;
	sourceLabel?: string | null;
	sourceUrl?: string | null;
	stance?: string;
	summary?: string;
};

const DEFAULT_PAGE_LIMIT = 25;
const MAX_PAGE_LIMIT = 50;

export async function createScan(input: CreateScanInput) {
	if (input.clientRequestId) {
		const existing = await findScanByClientRequestId(input.clientRequestId);
		if (existing) return { scanId: existing.id, status: existing.status };
	}
	const detection = detectSource(input.input, {
		fileName: input.fileName,
		mimeType: input.mimeType,
	});
	const provider = resolveScanProvider(detection, input.providerOverride);

	const [source] = await adminDb
		.insert(sources)
		.values({
			type: detection.type,
			originalInput: input.input,
			normalizedUrl:
				detection.type === "text" || detection.type === "file"
					? null
					: detection.normalizedInput,
			title: input.title ?? detection.label,
			mimeType: input.mimeType,
			fileName: input.fileName,
			fileText: input.fileText,
			metadata: { label: detection.label },
		})
		.returning();

	if (!source) throw new Error("Failed to create source");

	const [job] = await adminDb
		.insert(scanJobs)
		.values({
			clientRequestId: input.clientRequestId,
			sourceId: source.id,
			provider,
			status: "queued",
			priority: detection.type.startsWith("facebook") ? 5 : 1,
			requestedByDisplayName: input.requestedByDisplayName,
			requestedByUserId: input.requestedByUserId,
			trigger: input.trigger ?? "manual",
		})
		.returning();

	if (!job) throw new Error("Failed to create scan job");

	await writeAudit("scan_job", job.id, "created", {
		sourceType: source.type,
		provider: job.provider,
		runtimeMode: runtimeMode(),
		clientKeys: runtimeKeySummary(),
	});
	await recordScanEvent({
		eventType: "scan_queued",
		message: "Scan đã được thêm vào hàng đợi.",
		metadata: { priority: job.priority, provider: job.provider },
		scanJobId: job.id,
		stage: "queue",
		status: "waiting",
	});
	await refreshIntelligenceRollupsBestEffort(`scan-created:${job.id}`);

	return { scanId: job.id, status: job.status };
}

export async function findScanByClientRequestId(clientRequestId: string) {
	const [row] = await adminDb
		.select({
			createdAt: scanJobs.createdAt,
			errorMessage: scanJobs.errorMessage,
			fileName: sources.fileName,
			id: scanJobs.id,
			normalizedUrl: sources.normalizedUrl,
			provider: scanJobs.provider,
			riskLevel: analyses.riskLevel,
			sourceType: sources.type,
			status: scanJobs.status,
			title: sources.title,
		})
		.from(scanJobs)
		.innerJoin(sources, eq(scanJobs.sourceId, sources.id))
		.leftJoin(analyses, eq(analyses.scanJobId, scanJobs.id))
		.where(eq(scanJobs.clientRequestId, clientRequestId))
		.limit(1);
	return row ? toDashboardScan(row) : null;
}

export async function createRescan(
	parentScanJobId: string,
	actor: { displayName: string | null; id: string },
) {
	const [parent] = await adminDb
		.select()
		.from(scanJobs)
		.where(eq(scanJobs.id, parentScanJobId))
		.limit(1);
	if (!parent) return null;

	const [active] = await adminDb
		.select()
		.from(scanJobs)
		.where(
			and(
				eq(scanJobs.parentScanJobId, parentScanJobId),
				inArray(scanJobs.status, ["queued", "running", "retrying"]),
			),
		)
		.limit(1);
	if (active) {
		return { deduplicated: true, scanId: active.id, status: active.status };
	}

	const [job] = await adminDb
		.insert(scanJobs)
		.values({
			parentScanJobId,
			priority: parent.priority,
			provider: parent.provider,
			requestedByDisplayName: actor.displayName,
			requestedByUserId: actor.id,
			sourceId: parent.sourceId,
			status: "queued",
			trigger: "manual_rescan",
		})
		.returning();
	if (!job) throw new Error("Không thể tạo lượt quét lại.");
	await writeAudit("scan_job", job.id, "rescan_created", {
		actorId: actor.id,
		parentScanJobId,
	});
	await recordScanEvent({
		eventType: "scan_queued",
		message: "Đã tạo lượt quét lại và đưa vào hàng đợi.",
		metadata: { parentScanJobId, provider: job.provider },
		scanJobId: job.id,
		stage: "queue",
		status: "waiting",
	});
	return { deduplicated: false, scanId: job.id, status: job.status };
}

export async function listScans() {
	const page = await listScansPage();
	return page.items;
}

export async function getLatestScanId() {
	const [latestScan] = await adminDb
		.select({ id: scanJobs.id })
		.from(scanJobs)
		.orderBy(desc(scanJobs.createdAt))
		.limit(1);

	return latestScan?.id ?? "";
}

export async function listScansPage(input?: {
	cursor?: string | null;
	limit?: number;
}) {
	const limit = normalizePageLimit(input?.limit);
	const offset = normalizeOffsetCursor(input?.cursor);
	const rows = await adminDb
		.select({
			id: scanJobs.id,
			status: scanJobs.status,
			provider: scanJobs.provider,
			createdAt: scanJobs.createdAt,
			errorMessage: scanJobs.errorMessage,
			sourceType: sources.type,
			title: sources.title,
			normalizedUrl: sources.normalizedUrl,
			fileName: sources.fileName,
			riskLevel: analyses.riskLevel,
		})
		.from(scanJobs)
		.innerJoin(sources, eq(scanJobs.sourceId, sources.id))
		.leftJoin(analyses, eq(analyses.scanJobId, scanJobs.id))
		.orderBy(desc(scanJobs.createdAt))
		.limit(limit + 1)
		.offset(offset);

	const hasNextPage = rows.length > limit;
	const items = rows.slice(0, limit).map(toDashboardScan);
	return {
		hasNextPage,
		items,
		limit,
		nextCursor: hasNextPage ? String(offset + limit) : null,
	};
}

export async function getScanDetail(id: string) {
	const [rows, analysisRows, evidence, drafts, runs, audit] = await Promise.all([
		adminDb
			.select({
				jobCompletedAt: scanJobs.completedAt,
				jobCreatedAt: scanJobs.createdAt,
				jobErrorMessage: scanJobs.errorMessage,
				jobId: scanJobs.id,
				jobProvider: scanJobs.provider,
				jobStartedAt: scanJobs.startedAt,
				jobStatus: scanJobs.status,
				jobUpdatedAt: scanJobs.updatedAt,
				sourceCreatedAt: sources.createdAt,
				sourceFileName: sources.fileName,
				sourceNormalizedUrl: sources.normalizedUrl,
				sourceTitle: sources.title,
				sourceType: sources.type,
			})
			.from(scanJobs)
			.innerJoin(sources, eq(scanJobs.sourceId, sources.id))
			.where(eq(scanJobs.id, id))
			.limit(1),
		adminDb
			.select()
			.from(analyses)
			.where(eq(analyses.scanJobId, id))
			.limit(1),
		adminDb
			.select({
				author: evidenceItems.author,
				createdAt: evidenceItems.createdAt,
				engagement: evidenceItems.engagement,
				id: evidenceItems.id,
				metadata: evidenceItems.metadata,
				provider: evidenceItems.provider,
				publishedAt: evidenceItems.publishedAt,
				quote: evidenceItems.quote,
				riskLevel: evidenceItems.riskLevel,
				scanJobId: evidenceItems.scanJobId,
				sentiment: evidenceItems.sentiment,
				sourceId: evidenceItems.sourceId,
				sourceLabel: evidenceItems.sourceLabel,
				sourceUrl: evidenceItems.sourceUrl,
				stance: evidenceItems.stance,
				summary: evidenceItems.summary,
			})
			.from(evidenceItems)
			.where(eq(evidenceItems.scanJobId, id))
			.orderBy(desc(evidenceItems.createdAt)),
		adminDb
			.select()
			.from(counterArgumentDrafts)
			.where(eq(counterArgumentDrafts.scanJobId, id))
			.orderBy(desc(counterArgumentDrafts.createdAt)),
		adminDb
			.select({
				completedAt: providerRuns.completedAt,
				errorMessage: providerRuns.errorMessage,
				id: providerRuns.id,
				provider: providerRuns.provider,
				startedAt: providerRuns.startedAt,
				status: providerRuns.status,
			})
			.from(providerRuns)
			.where(eq(providerRuns.scanJobId, id))
			.orderBy(desc(providerRuns.startedAt)),
		adminDb
			.select({
				action: auditEvents.action,
				createdAt: auditEvents.createdAt,
				id: auditEvents.id,
			})
			.from(auditEvents)
			.where(
				and(
					eq(auditEvents.entityType, "scan_job"),
					eq(auditEvents.entityId, id),
				),
			)
			.orderBy(desc(auditEvents.createdAt)),
	]);
	const row = rows[0];
	if (!row) return null;
	const analysis = analysisRows[0];

	return {
		job: {
			completedAt: row.jobCompletedAt,
			createdAt: row.jobCreatedAt,
			errorMessage: row.jobErrorMessage,
			id: row.jobId,
			provider: row.jobProvider,
			startedAt: row.jobStartedAt,
			status: row.jobStatus,
			updatedAt: row.jobUpdatedAt,
		},
		source: {
			createdAt: row.sourceCreatedAt,
			fileName: row.sourceFileName,
			normalizedUrl: row.sourceNormalizedUrl,
			title: row.sourceTitle,
			type: row.sourceType,
		},
		analysis,
		evidence,
		drafts,
		providerRuns: runs,
		audit,
	};
}

export async function listEvidenceForScanPage(input: {
	cursor?: string | null;
	limit?: number;
	scanId: string;
}) {
	const limit = normalizePageLimit(input.limit);
	const offset = normalizeOffsetCursor(input.cursor);
	const rows = await adminDb
		.select({
			author: evidenceItems.author,
			createdAt: evidenceItems.createdAt,
			engagement: evidenceItems.engagement,
			id: evidenceItems.id,
			metadata: evidenceItems.metadata,
			provider: evidenceItems.provider,
			publishedAt: evidenceItems.publishedAt,
			quote: evidenceItems.quote,
			riskLevel: evidenceItems.riskLevel,
			scanJobId: evidenceItems.scanJobId,
			sentiment: evidenceItems.sentiment,
			sourceId: evidenceItems.sourceId,
			sourceLabel: evidenceItems.sourceLabel,
			sourceUrl: evidenceItems.sourceUrl,
			stance: evidenceItems.stance,
			summary: evidenceItems.summary,
		})
		.from(evidenceItems)
		.where(eq(evidenceItems.scanJobId, input.scanId))
		.orderBy(desc(evidenceItems.createdAt), desc(evidenceItems.id))
		.limit(limit + 1)
		.offset(offset);

	const hasNextPage = rows.length > limit;
	return {
		hasNextPage,
		items: rows.slice(0, limit),
		limit,
		nextCursor: hasNextPage ? String(offset + limit) : null,
		scanId: input.scanId,
	};
}

export async function updateScan(id: string, input: UpdateScanInput) {
	const [job] = await adminDb
		.select({ sourceId: scanJobs.sourceId })
		.from(scanJobs)
		.where(eq(scanJobs.id, id))
		.limit(1);

	if (!job) return null;

	if (input.title !== undefined) {
		await adminDb
			.update(sources)
			.set({ title: input.title })
			.where(eq(sources.id, job.sourceId));
	}

	if (input.status !== undefined) {
		const completedAt =
			input.status === "completed" || input.status === "failed"
				? new Date()
				: null;
		await adminDb
			.update(scanJobs)
			.set({
				completedAt,
				status: input.status,
				updatedAt: new Date(),
			})
			.where(eq(scanJobs.id, id));
	}

	await writeAudit("scan_job", id, "updated", {
		status: input.status,
		title: input.title,
	});
	await refreshIntelligenceRollupsBestEffort(`scan-updated:${id}`);

	return getScanSummary(id);
}

export async function deleteScan(id: string) {
	const [job] = await adminDb
		.select({ sourceId: scanJobs.sourceId })
		.from(scanJobs)
		.where(eq(scanJobs.id, id))
		.limit(1);

	if (!job) return false;

	await writeAudit("scan_job", id, "deleted", {});
	await adminDb.delete(sources).where(eq(sources.id, job.sourceId));
	await refreshIntelligenceRollupsBestEffort(`scan-deleted:${id}`);
	return true;
}

export async function createEvidence(input: CreateEvidenceInput) {
	const [job] = await adminDb
		.select({
			provider: scanJobs.provider,
			sourceId: scanJobs.sourceId,
		})
		.from(scanJobs)
		.where(eq(scanJobs.id, input.scanJobId))
		.limit(1);

	if (!job) return null;

	const [item] = await adminDb
		.insert(evidenceItems)
		.values({
			author: input.author,
			provider: job.provider,
			quote: input.quote,
			riskLevel: input.riskLevel ?? "medium",
			scanJobId: input.scanJobId,
			sentiment: input.sentiment ?? "neutral",
			sourceId: job.sourceId,
			sourceLabel: input.sourceLabel,
			sourceUrl: input.sourceUrl,
			stance: input.stance ?? "neutral",
			summary: input.summary,
		})
		.returning();

	if (!item) throw new Error("Failed to create evidence");
	await writeAudit("evidence_item", item.id, "created", {
		scanJobId: input.scanJobId,
	});
	await syncExistingAnalysisTopicsForScan(input.scanJobId);
	await refreshIntelligenceRollupsBestEffort(`evidence-created:${item.id}`);
	return item;
}

export async function updateEvidence(id: string, input: UpdateEvidenceInput) {
	const [item] = await adminDb
		.update(evidenceItems)
		.set({
			...(input.author !== undefined ? { author: input.author } : {}),
			...(input.quote !== undefined ? { quote: input.quote } : {}),
			...(input.riskLevel !== undefined ? { riskLevel: input.riskLevel } : {}),
			...(input.sentiment !== undefined ? { sentiment: input.sentiment } : {}),
			...(input.sourceLabel !== undefined
				? { sourceLabel: input.sourceLabel }
				: {}),
			...(input.sourceUrl !== undefined ? { sourceUrl: input.sourceUrl } : {}),
			...(input.stance !== undefined ? { stance: input.stance } : {}),
			...(input.summary !== undefined ? { summary: input.summary } : {}),
		})
		.where(eq(evidenceItems.id, id))
		.returning();

	if (!item) return null;
	if (
		input.author !== undefined ||
		input.quote !== undefined ||
		input.sourceLabel !== undefined ||
		input.summary !== undefined
	) {
		await invalidateEvidenceSemanticProfile(id);
	}
	await writeAudit("evidence_item", id, "updated", {});
	await syncExistingAnalysisTopicsForScan(item.scanJobId);
	await refreshIntelligenceRollupsBestEffort(`evidence-updated:${id}`);
	return item;
}

export async function deleteEvidence(id: string) {
	const [item] = await adminDb
		.delete(evidenceItems)
		.where(eq(evidenceItems.id, id))
		.returning();

	if (!item) return null;
	await writeAudit("evidence_item", id, "deleted", {
		scanJobId: item.scanJobId,
	});
	await syncExistingAnalysisTopicsForScan(item.scanJobId);
	await refreshIntelligenceRollupsBestEffort(`evidence-deleted:${id}`);
	return item;
}

export async function processNextJob() {
	const claimed = await claimNextJob();
	if (!claimed) return { processed: false };

	return processClaimedJob(claimed);
}

export async function processScanJobNow(scanId: string) {
	const claimed = await claimJobById(scanId);
	if (!claimed) return { processed: false };

	return processClaimedJob(claimed);
}

async function processClaimedJob(claimed: ClaimedJob) {
	const processingStartedAt = Date.now();
	try {
		await recordScanEvent({
			eventType: "scan_claimed",
			message: "Worker đã nhận scan từ hàng đợi.",
			metadata: { attempt: claimed.attempts, provider: claimed.provider },
			scanJobId: claimed.id,
			stage: "queue",
			status: "completed",
		});
		const [source] = await adminDb
			.select()
			.from(sources)
			.where(eq(sources.id, claimed.source_id))
			.limit(1);

		if (!source) throw new Error(`Source not found for job ${claimed.id}`);

		const [run] = await adminDb
			.insert(providerRuns)
			.values({
				scanJobId: claimed.id,
				provider: claimed.provider,
				status: "running",
				input: {
					sourceId: source.id,
					input: source.originalInput,
					runtimeMode: runtimeMode(),
				},
			})
			.returning();

		if (!run) throw new Error("Failed to create provider run");
		await recordScanEvent({
			eventType: "provider_started",
			message: "Provider bắt đầu thu thập dữ liệu.",
			metadata: { provider: claimed.provider, providerRunId: run.id },
			scanJobId: claimed.id,
			stage: "provider",
			status: "running",
		});

		const result = await runProvider(claimed.provider, source);

		await adminDb
			.update(providerRuns)
			.set({
				status: "completed",
				output: result.raw,
				completedAt: new Date(),
			})
			.where(eq(providerRuns.id, run.id));
		await recordScanEvent({
			eventType: "provider_completed",
			message: "Provider đã hoàn tất thu thập dữ liệu.",
			metadata: {
				candidateCount: result.evidence.length,
				provider: result.provider,
			},
			scanJobId: claimed.id,
			stage: "provider",
			status: "completed",
		});

		const insertedEvidence =
			result.evidence.length > 0
				? await adminDb
						.insert(evidenceItems)
						.values(
							result.evidence.map((item) => ({
								scanJobId: claimed.id,
								sourceId: source.id,
								provider: result.provider,
								sourceUrl: item.sourceUrl,
								sourceLabel: item.sourceLabel,
								author: item.author,
								publishedAt: item.publishedAt,
								quote: item.quote,
								summary: item.summary,
								engagement: item.engagement,
								stance: item.stance,
								sentiment: item.sentiment,
								riskLevel: item.riskLevel,
								metadata: item.metadata,
							})),
						)
						.returning()
				: [];
		// Providers attach a provisional rule-based level so collection never waits
		// on the model. Re-score with the LLM before drafts or analysis read it.
		const riskScoring = await classifyPersistedEvidenceRisk(
			insertedEvidence.map((item) => item.id),
		).catch(() => ({ scored: 0, updated: 0 }));
		const scoredEvidence = riskScoring.updated
			? await adminDb
					.select()
					.from(evidenceItems)
					.where(eq(evidenceItems.scanJobId, claimed.id))
			: insertedEvidence;
		const queuedAutomatedDrafts = await enqueueEvidenceDraftJobs(scoredEvidence);
		await recordScanEvent({
			eventType: "evidence_persisted",
			message: "Bằng chứng chuẩn hóa đã được lưu và chấm mức rủi ro.",
			metadata: {
				automatedDraftCount: queuedAutomatedDrafts,
				evidenceCount: insertedEvidence.length,
				riskRescored: riskScoring.updated,
			},
			scanJobId: claimed.id,
			stage: "evidence",
			status: "completed",
		});

		await recordScanEvent({
			eventType: "analysis_started",
			message: "AI bắt đầu phân tích bằng chứng.",
			scanJobId: claimed.id,
			stage: "analysis",
			status: "running",
		});
		const analysis = await analyzeEvidence(
			scoredEvidence.map((item) => ({
				id: item.id,
				quote: item.quote,
				summary: item.summary,
				riskLevel: item.riskLevel,
			})),
		);

		await persistAnalysis(claimed.id, analysis);
		await recordScanEvent({
			eventType: "analysis_completed",
			message: "Phân tích rủi ro và lập trường đã hoàn tất.",
			metadata: { riskLevel: analysis.riskLevel },
			scanJobId: claimed.id,
			stage: "analysis",
			status: "completed",
		});

		await syncTopicsForScan(claimed.id, analysis.topicClusters, scoredEvidence);
		await recordScanEvent({
			eventType: "topics_completed",
			message: "Chủ đề và liên kết bằng chứng đã được cập nhật.",
			metadata: { topicCount: analysis.topicClusters.length },
			scanJobId: claimed.id,
			stage: "topics",
			status: "completed",
		});

		await adminDb
			.update(scanJobs)
			.set({
				status: "completed",
				completedAt: new Date(),
				updatedAt: new Date(),
				errorMessage: null,
			})
			.where(eq(scanJobs.id, claimed.id));

		await updateTrackedSourceLastScan(claimed.id, "completed");

		await writeAudit("scan_job", claimed.id, "processed", {
			providerMode: result.mode,
			credentialSource: result.credentialSource,
			evidenceCount: insertedEvidence.length,
		});
		await recordScanEvent({
			eventType: "scan_completed",
			message: "Scan đã hoàn tất toàn bộ pipeline.",
			metadata: {
				durationMs: Date.now() - processingStartedAt,
				evidenceCount: insertedEvidence.length,
			},
			scanJobId: claimed.id,
			stage: "complete",
			status: "completed",
		});
		await refreshIntelligenceRollupsBestEffort(`scan-processed:${claimed.id}`);

		return { processed: true, scanId: claimed.id };
	} catch (error) {
		const rawMessage = error instanceof Error ? error.message : String(error);
		// Prefer the operator-facing explanation when the provider gave us one: the
		// raw text ("Monthly usage hard limit exceeded") tells the person reading
		// the queue nothing about what they should do next.
		const message = operatorMessageFor(error) ?? rawMessage;
		// A terminal fault must not consume the retry budget. Retrying an exhausted
		// account quota keeps every scan in a "Thử lại" state that reads like
		// recovery in progress, when nothing will change until someone intervenes.
		const nextStatus: ScanStatus =
			isRetryableCollectionError(error) &&
			claimed.attempts < claimed.max_attempts
				? "retrying"
				: "failed";

		await adminDb
			.update(scanJobs)
			.set({
				status: nextStatus,
				errorMessage: message,
				scheduledAt: nextStatus === "retrying" ? new Date(Date.now() + 60_000) : new Date(),
				updatedAt: new Date(),
				completedAt: nextStatus === "failed" ? new Date() : null,
			})
			.where(eq(scanJobs.id, claimed.id));

		await updateTrackedSourceLastScan(claimed.id, nextStatus);

		await writeAudit("scan_job", claimed.id, "failed", { message, nextStatus });
		await recordScanEvent({
			eventType: nextStatus === "retrying" ? "scan_retry_scheduled" : "scan_failed",
			message:
				nextStatus === "retrying"
					? "Scan gặp lỗi và đã được lên lịch thử lại."
					: "Scan đã dừng sau khi hết số lần thử.",
			metadata: {
				attempt: claimed.attempts,
				durationMs: Date.now() - processingStartedAt,
				errorType: error instanceof Error ? error.name : "UnknownError",
				nextStatus,
			},
			scanJobId: claimed.id,
			stage: "complete",
			status: "failed",
		});
		await refreshIntelligenceRollupsBestEffort(`scan-failed:${claimed.id}`);
		return { processed: true, scanId: claimed.id, error: message };
	}
}

export async function reviseAnalysisForScan(
	scanId: string,
	actor: { displayName: string | null; id: string },
) {
	const [scan, evidence] = await Promise.all([
		adminDb
			.select({ id: scanJobs.id, status: scanJobs.status })
			.from(scanJobs)
			.where(eq(scanJobs.id, scanId))
			.limit(1)
			.then((rows) => rows[0] ?? null),
		adminDb
			.select()
			.from(evidenceItems)
			.where(eq(evidenceItems.scanJobId, scanId))
			.orderBy(desc(evidenceItems.createdAt)),
	]);
	if (!scan) return null;
	if (scan.status !== "completed") {
		throw new Error("Chỉ có thể phân tích lại scan đã hoàn tất.");
	}
	if (!evidence.length) {
		throw new Error("Scan chưa có bằng chứng để phân tích lại.");
	}

	await recordScanEvent({
		eventType: "analysis_revision_started",
		message: "Người vận hành yêu cầu phân tích lại và kiểm chứng từng trích đoạn.",
		metadata: { actorId: actor.id, evidenceCount: evidence.length },
		scanJobId: scanId,
		stage: "analysis",
		status: "running",
	});

	try {
		const analysis = await analyzeEvidence(
			evidence.map((item) => ({
				id: item.id,
				quote: item.quote,
				riskLevel: item.riskLevel,
				summary: item.summary,
			})),
		);
		await persistAnalysis(scanId, analysis);
		await syncTopicsForScan(scanId, analysis.topicClusters, evidence);

		const proofCount = [...analysis.claims, ...analysis.riskFlags].reduce(
			(total, item) => total + item.proofs.length,
			0,
		);
		await writeAudit("scan_job", scanId, "analysis_revised", {
			actorDisplayName: actor.displayName,
			actorId: actor.id,
			claimCount: analysis.claims.length,
			proofCount,
			riskFlagCount: analysis.riskFlags.length,
		});
		await recordScanEvent({
			eventType: "analysis_revision_completed",
			message: "Phân tích và các trích đoạn chứng minh đã được kiểm chứng lại.",
			metadata: {
				claimCount: analysis.claims.length,
				proofCount,
				riskFlagCount: analysis.riskFlags.length,
			},
			scanJobId: scanId,
			stage: "analysis",
			status: "completed",
		});
		await refreshIntelligenceRollupsBestEffort(`analysis-revised:${scanId}`);
		return { analysis, evidenceCount: evidence.length, proofCount };
	} catch (error) {
		const objectError = NoObjectGeneratedError.isInstance(error) ? error : null;
		await recordScanEvent({
			eventType: "analysis_revision_failed",
			message: "Không thể hoàn tất lần kiểm chứng lại phân tích.",
			metadata: {
				...(objectError?.cause instanceof Error
					? { causeType: objectError.cause.name }
					: {}),
				errorType: error instanceof Error ? error.name : "UnknownError",
				...(objectError?.finishReason
					? { finishReason: objectError.finishReason }
					: {}),
			},
			scanJobId: scanId,
			stage: "analysis",
			status: "failed",
		});
		throw error;
	}
}

async function persistAnalysis(scanId: string, analysis: AnalysisOutput) {
	await adminDb
		.insert(analyses)
		.values({
			claims: analysis.claims,
			riskFlags: analysis.riskFlags,
			riskLevel: analysis.riskLevel,
			scanJobId: scanId,
			sentiment: analysis.sentiment,
			stanceSummary: analysis.stanceSummary,
			summary: analysis.summary,
			topicClusters: analysis.topicClusters,
		})
		.onConflictDoUpdate({
			target: analyses.scanJobId,
			set: {
				claims: analysis.claims,
				riskFlags: analysis.riskFlags,
				riskLevel: analysis.riskLevel,
				sentiment: analysis.sentiment,
				stanceSummary: analysis.stanceSummary,
				summary: analysis.summary,
				topicClusters: analysis.topicClusters,
			},
		});
}

export async function updateTrackedSourceLastScan(
	scanId: string,
	status: ScanStatus,
) {
	await adminDb
		.update(trackedSources)
		.set({
			lastScanStatus: status,
			lastScannedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(trackedSources.lastScanJobId, scanId));
}

export async function generateDraftForScan(
	scanId: string,
	options: {
		tone: string;
		voice?: string;
		audience: string;
		language: string;
		length: string;
		operatorNotes?: string | null;
		draftKind?: "response" | "comment" | "counter_argument" | "internal_brief";
		evidenceId?: string;
		includeRelatedEvidence?: boolean;
		originatingChatId?: string;
		actor?: { displayName: string | null; id: string };
		automationKey?: string;
		generationReason?: string;
		session?: Pick<TuturuuuAdminSession, "accessToken" | "workspaceId">;
	},
) {
	if (options.automationKey) {
		const [existing] = await adminDb
			.select()
			.from(counterArgumentDrafts)
			.where(eq(counterArgumentDrafts.automationKey, options.automationKey))
			.limit(1);
		if (existing) return existing;
	}
	const generationMode = options.automationKey ? "automatic" : "operator";
	const generationStyle = resolveDraftGenerationStyle({
		language: options.language,
		mode: generationMode,
		voice: options.voice,
	});
	const evidence = options.evidenceId
		? (
				await Promise.all([
					adminDb
						.select()
						.from(evidenceItems)
						.where(
							and(
								eq(evidenceItems.scanJobId, scanId),
								eq(evidenceItems.id, options.evidenceId),
							),
						)
						.limit(1),
					options.includeRelatedEvidence
						? adminDb
								.select()
								.from(evidenceItems)
								.where(
									and(
										eq(evidenceItems.scanJobId, scanId),
										ne(evidenceItems.id, options.evidenceId),
									),
								)
								.orderBy(desc(evidenceItems.createdAt))
								.limit(3)
						: Promise.resolve([]),
				])
			).flat()
		: await adminDb
				.select()
				.from(evidenceItems)
				.where(eq(evidenceItems.scanJobId, scanId))
				.orderBy(desc(evidenceItems.createdAt))
				.limit(8);

	const output = await generateCounterArgumentWithEvidenceFallback({
		audience: options.audience,
		draftKind: options.draftKind,
		evidence: evidence.map((item) => ({
			id: item.id,
			quote: item.quote,
			summary: item.summary,
		})),
		generationMode,
		language: generationStyle.language,
		length: options.length,
		operatorNotes: options.operatorNotes,
		tone: options.tone,
		voice: generationStyle.voice,
		session: options.session,
	});
	const cleanBody = cleanDraftContent(output.body);

	const actor = options.actor ?? { displayName: "Hệ thống", id: "system" };
	const draft = await adminDb.transaction(async (tx) => {
		const [created] = await tx
			.insert(counterArgumentDrafts)
			.values({
				audience: options.audience,
				body: cleanBody,
				citations: output.citations,
				createdByDisplayName: actor.displayName,
				createdByUserId: actor.id,
				draftKind: options.draftKind ?? "counter_argument",
				evidenceItemId: options.evidenceId,
				language: generationStyle.language,
				length: options.length,
				operatorNotes: options.operatorNotes,
				originatingChatId: options.originatingChatId,
				safetyNotes: output.safetyNotes,
				scanJobId: scanId,
				status: "needs_review",
				tone: options.tone,
				voice: generationStyle.voice,
				updatedByDisplayName: actor.displayName,
				updatedByUserId: actor.id,
				automationKey: options.automationKey,
				generationReason: options.generationReason,
			})
			.returning();
		if (!created) return null;
		await tx.insert(counterArgumentDraftVersions).values({
			actorDisplayName: actor.displayName,
			actorUserId: actor.id,
			body: cleanBody,
			citations: output.citations,
			draftId: created.id,
			safetyNotes: output.safetyNotes,
			version: 1,
		});
		return created;
	});

	if (!draft) throw new Error("Failed to generate draft");

	await writeAudit("scan_job", scanId, "draft_generated", {
		draftId: draft.id,
		draftKind: draft.draftKind,
		runtimeMode: runtimeMode(),
		clientKeys: runtimeKeySummary(),
	});
	await refreshIntelligenceRollupsBestEffort(`draft-created:${draft.id}`);

	return draft;
}

export async function reviewDraft(
	id: string,
	status: DraftStatus,
	actor?: { displayName: string | null; id: string },
) {
	const [draft] = await adminDb
		.update(counterArgumentDrafts)
		.set({
			status,
			updatedAt: new Date(),
			...(actor
				? {
						updatedByDisplayName: actor.displayName,
						updatedByUserId: actor.id,
					}
				: {}),
		})
		.where(eq(counterArgumentDrafts.id, id))
		.returning();

	if (!draft) return null;
	await writeAudit("counter_argument_draft", id, "review_status_updated", {
		status,
		reviewerUserId: actor?.id,
	});
	await refreshIntelligenceRollupsBestEffort(`draft-reviewed:${id}`);
	return draft;
}

export async function updateDraftContent(
	id: string,
	options: {
		actor: { displayName: string | null; id: string };
		body: string;
		citations?: unknown[];
		mode: "ai" | "manual";
		operatorNotes?: string | null;
		safetyNotes?: unknown[];
		tone?: string;
		voice?: string;
	},
) {
	const draft = await adminDb.transaction(async (tx) => {
		const [existing] = await tx
			.select()
			.from(counterArgumentDrafts)
			.where(eq(counterArgumentDrafts.id, id))
			.limit(1)
			.for("update");
		if (!existing) return null;

		const [versionRow] = await tx
			.select({ version: max(counterArgumentDraftVersions.version) })
			.from(counterArgumentDraftVersions)
			.where(eq(counterArgumentDraftVersions.draftId, id));
		const citations = options.citations ?? existing.citations;
		const safetyNotes = options.safetyNotes ?? existing.safetyNotes;

		const [updated] = await tx
			.update(counterArgumentDrafts)
			.set({
				body: options.body,
				citations,
				operatorNotes: options.operatorNotes ?? existing.operatorNotes,
				safetyNotes,
				status: "needs_review",
				tone: options.tone ?? existing.tone,
				updatedAt: new Date(),
				updatedByDisplayName: options.actor.displayName,
				updatedByUserId: options.actor.id,
				voice: options.voice ?? existing.voice,
			})
			.where(eq(counterArgumentDrafts.id, id))
			.returning();
		if (!updated) return null;

		await tx.insert(counterArgumentDraftVersions).values({
			actorDisplayName: options.actor.displayName,
			actorUserId: options.actor.id,
			body: updated.body,
			citations: updated.citations,
			draftId: updated.id,
			safetyNotes: updated.safetyNotes,
			version: (versionRow?.version ?? 0) + 1,
		});
		return updated;
	});

	if (!draft) return null;
	await writeAudit("counter_argument_draft", id, "draft_content_updated", {
		editorUserId: options.actor.id,
		mode: options.mode,
	});
	await refreshIntelligenceRollupsBestEffort(`draft-updated:${id}`);
	return draft;
}

export async function reviseDraftWithAi(
	id: string,
	options: {
		actor: { displayName: string | null; id: string };
		instruction: string;
		length?: "keep" | "slightly_longer" | "substantially_longer" | "shorter";
		session?: Pick<TuturuuuAdminSession, "accessToken" | "workspaceId">;
		tone: string;
		voice: string;
	},
) {
	const [draft] = await adminDb
		.select()
		.from(counterArgumentDrafts)
		.where(eq(counterArgumentDrafts.id, id))
		.limit(1);
	if (!draft) return null;

	const evidence = await adminDb
		.select()
		.from(evidenceItems)
		.where(eq(evidenceItems.scanJobId, draft.scanJobId))
		.orderBy(desc(evidenceItems.createdAt))
		.limit(8);
	const lengthGuidance = {
		keep: draft.length,
		slightly_longer:
			"Dài hơn khoảng 20–35% so với bản hiện tại; bổ sung diễn giải trực tiếp từ bằng chứng và không lặp ý.",
		substantially_longer:
			"Dài hơn khoảng 50–70% so với bản hiện tại; phát triển lập luận theo bằng chứng, có chuyển ý tự nhiên và không thêm tuyên bố mới.",
		shorter:
			"Ngắn hơn khoảng 20–30% so với bản hiện tại; giữ đủ luận điểm và bằng chứng cốt lõi.",
	} as const;
	const output = await reviseCounterArgumentWithEvidenceFallback({
		audience: draft.audience,
		currentBody: draft.body,
		evidence: evidence.map((item) => ({
			id: item.id,
			quote: item.quote,
			summary: item.summary,
		})),
		instruction: options.instruction,
		language: draft.language,
		length: lengthGuidance[options.length ?? "keep"],
		draftKind: draft.draftKind,
		session: options.session,
		tone: options.tone,
		voice: options.voice,
	});

	return updateDraftContent(id, {
		actor: options.actor,
		body: cleanDraftContent(output.body),
		citations: output.citations,
		mode: "ai",
		operatorNotes: options.instruction,
		safetyNotes: output.safetyNotes,
		tone: options.tone,
		voice: options.voice,
	});
}

export async function heartbeat(
	serviceName = "worker",
	metadata: Record<string, unknown> = {},
) {
	const nextMetadata = {
		pid: process.pid,
		updatedAt: new Date().toISOString(),
		...metadata,
	};

	await adminDb
		.insert(cronHeartbeats)
		.values({
			serviceName,
			lastSeenAt: new Date(),
			metadata: nextMetadata,
		})
		.onConflictDoUpdate({
			target: cronHeartbeats.serviceName,
			set: {
				lastSeenAt: new Date(),
				metadata: nextMetadata,
			},
		});
}

async function claimNextJob() {
	const rows = await adminSqlClient<ClaimedJob[]>`
		update scan_jobs
		set
			status = 'running',
			locked_at = now(),
			started_at = coalesce(started_at, now()),
			attempts = attempts + 1,
			updated_at = now()
		where id = (
			select id
			from scan_jobs
			where status in ('queued', 'retrying')
				and scheduled_at <= now()
			order by priority desc, scheduled_at asc
			for update skip locked
			limit 1
		)
		returning id, source_id, provider, attempts, max_attempts
	`;

	return rows[0] ?? null;
}

async function claimJobById(scanId: string) {
	const rows = await adminSqlClient<ClaimedJob[]>`
		update scan_jobs
		set
			status = 'running',
			locked_at = now(),
			started_at = coalesce(started_at, now()),
			attempts = attempts + 1,
			updated_at = now()
		where id = ${scanId}
			and status in ('queued', 'retrying')
		returning id, source_id, provider, attempts, max_attempts
	`;

	return rows[0] ?? null;
}

async function getScanSummary(id: string) {
	const rows = await adminDb
		.select({
			id: scanJobs.id,
			status: scanJobs.status,
			provider: scanJobs.provider,
			createdAt: scanJobs.createdAt,
			errorMessage: scanJobs.errorMessage,
			sourceType: sources.type,
			title: sources.title,
			normalizedUrl: sources.normalizedUrl,
			fileName: sources.fileName,
			riskLevel: analyses.riskLevel,
		})
		.from(scanJobs)
		.innerJoin(sources, eq(scanJobs.sourceId, sources.id))
		.leftJoin(analyses, eq(analyses.scanJobId, scanJobs.id))
		.where(eq(scanJobs.id, id))
		.limit(1);

	const row = rows[0];
	return row ? toDashboardScan(row) : null;
}

async function writeAudit(
	entityType: string,
	entityId: string,
	action: string,
	payload: Record<string, unknown>,
) {
	await adminDb.insert(auditEvents).values({
		entityType,
		entityId,
		action,
		payload,
	});
}

function normalizePageLimit(value?: number) {
	const parsed = Math.floor(Number(value ?? DEFAULT_PAGE_LIMIT));
	if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_PAGE_LIMIT;
	return Math.min(parsed, MAX_PAGE_LIMIT);
}

function normalizeOffsetCursor(value?: string | null) {
	if (!value) return 0;
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 0) return 0;
	return Math.floor(parsed);
}

function toDashboardScan(row: {
	createdAt: Date;
	errorMessage: string | null;
	fileName: string | null;
	id: string;
	normalizedUrl: string | null;
	provider: ProviderName;
	riskLevel: RiskLevel | null;
	sourceType: SourceType;
	status: ScanStatus;
	title: string | null;
}) {
	return {
		id: row.id,
		status: row.status,
		provider: row.provider,
		sourceType: row.sourceType,
		title: row.title ?? row.fileName ?? row.normalizedUrl ?? "Nguồn chưa đặt tên",
		sourceLabel: labelForSource(row.sourceType),
		riskLevel: row.riskLevel ?? "medium",
		progress: progressForStatus(row.status),
		createdAt: row.createdAt.toISOString(),
		// Only meaningful while the scan is still stopped: a message left over
		// from an earlier attempt would misrepresent a run that has since
		// recovered.
		errorMessage:
			row.status === "failed" || row.status === "retrying"
				? row.errorMessage
				: null,
	};
}

function progressForStatus(status: ScanStatus) {
	if (status === "completed") return 100;
	if (status === "running") return 45;
	if (status === "failed") return 0;
	if (status === "retrying") return 25;
	return 0;
}

function labelForSource(type: SourceType) {
	switch (type) {
		case "facebook_group":
			return "Facebook group";
		case "facebook_page":
			return "Facebook page";
		case "facebook_post":
			return "Facebook post";
		case "file":
			return "Tệp";
		case "text":
			return "Văn bản";
		case "social":
			return "Mạng xã hội";
		default:
			return "Website";
	}
}
