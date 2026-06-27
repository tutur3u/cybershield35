import { desc, eq } from "drizzle-orm";

import { adminDb, adminSqlClient } from "@/lib/db/client";
import {
	analyses,
	auditEvents,
	counterArgumentDrafts,
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
import { detectSource } from "@/lib/domain/source-detection";
import { analyzeEvidence, generateCounterArgument } from "@/lib/llm/generation";
import { runProvider } from "@/lib/providers";
import {
	runtimeKeySummary,
	runtimeMode,
} from "@/lib/runtime/client-runtime";

type ClaimedJob = {
	id: string;
	source_id: string;
	provider: ProviderName;
	attempts: number;
	max_attempts: number;
};

export type CreateScanInput = {
	input: string;
	fileName?: string;
	mimeType?: string;
	fileText?: string;
	title?: string;
	providerOverride?: ScanProviderOverride;
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

export async function createScan(input: CreateScanInput) {
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
			sourceId: source.id,
			provider,
			status: "queued",
			priority: detection.type.startsWith("facebook") ? 5 : 1,
		})
		.returning();

	if (!job) throw new Error("Failed to create scan job");

	await writeAudit("scan_job", job.id, "created", {
		sourceType: source.type,
		provider: job.provider,
		runtimeMode: runtimeMode(),
		clientKeys: runtimeKeySummary(),
	});

	return { scanId: job.id, status: job.status };
}

export async function listScans() {
	const rows = await adminDb
		.select({
			id: scanJobs.id,
			status: scanJobs.status,
			provider: scanJobs.provider,
			createdAt: scanJobs.createdAt,
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
		.limit(25);

	return rows.map(toDashboardScan);
}

export async function getScanDetail(id: string) {
	const rows = await adminDb
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
		.limit(1);

	const row = rows[0];
	if (!row) return null;

	const [analysis] = await adminDb
		.select()
		.from(analyses)
		.where(eq(analyses.scanJobId, id))
		.limit(1);
	const evidence = await adminDb
		.select({
			author: evidenceItems.author,
			createdAt: evidenceItems.createdAt,
			engagement: evidenceItems.engagement,
			id: evidenceItems.id,
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
		.orderBy(desc(evidenceItems.createdAt));
	const drafts = await adminDb
		.select()
		.from(counterArgumentDrafts)
		.where(eq(counterArgumentDrafts.scanJobId, id))
		.orderBy(desc(counterArgumentDrafts.createdAt));
	const runs = await adminDb
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
		.orderBy(desc(providerRuns.startedAt));
	const audit = await adminDb
		.select({
			action: auditEvents.action,
			createdAt: auditEvents.createdAt,
			id: auditEvents.id,
		})
		.from(auditEvents)
		.where(eq(auditEvents.entityId, id))
		.orderBy(desc(auditEvents.createdAt));

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
	await writeAudit("evidence_item", id, "updated", {});
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
	try {
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

		const result = await runProvider(claimed.provider, source);

		await adminDb
			.update(providerRuns)
			.set({
				status: "completed",
				output: result.raw,
				completedAt: new Date(),
			})
			.where(eq(providerRuns.id, run.id));

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

		const analysis = await analyzeEvidence(
			insertedEvidence.map((item) => ({
				id: item.id,
				quote: item.quote,
				summary: item.summary,
				riskLevel: item.riskLevel,
			})),
		);

		await adminDb
			.insert(analyses)
			.values({
				scanJobId: claimed.id,
				riskLevel: analysis.riskLevel,
				summary: analysis.summary,
				stanceSummary: analysis.stanceSummary,
				topicClusters: analysis.topicClusters,
				claims: analysis.claims,
				riskFlags: analysis.riskFlags,
				sentiment: analysis.sentiment,
			})
			.onConflictDoUpdate({
				target: analyses.scanJobId,
				set: {
					riskLevel: analysis.riskLevel,
					summary: analysis.summary,
					stanceSummary: analysis.stanceSummary,
					topicClusters: analysis.topicClusters,
					claims: analysis.claims,
					riskFlags: analysis.riskFlags,
					sentiment: analysis.sentiment,
				},
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

		return { processed: true, scanId: claimed.id };
	} catch (error) {
		const rawMessage = error instanceof Error ? error.message : String(error);
		const message = rawMessage;
		const nextStatus: ScanStatus =
			claimed.attempts < claimed.max_attempts ? "retrying" : "failed";

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
		return { processed: true, scanId: claimed.id, error: message };
	}
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
		audience: string;
		language: string;
		length: string;
		operatorNotes?: string | null;
	},
) {
	const evidence = await adminDb
		.select()
		.from(evidenceItems)
		.where(eq(evidenceItems.scanJobId, scanId))
		.orderBy(desc(evidenceItems.createdAt))
		.limit(8);

	const output = await generateCounterArgument({
		evidence: evidence.map((item) => ({
			id: item.id,
			quote: item.quote,
			summary: item.summary,
		})),
		...options,
	});

	const [draft] = await adminDb
		.insert(counterArgumentDrafts)
		.values({
			scanJobId: scanId,
			status: "needs_review",
			tone: options.tone,
			audience: options.audience,
			language: options.language,
			length: options.length,
			operatorNotes: options.operatorNotes,
			body: output.body,
			citations: output.citations,
			safetyNotes: output.safetyNotes,
		})
		.returning();

	if (!draft) throw new Error("Failed to generate draft");

	await writeAudit("scan_job", scanId, "counter_argument_generated", {
		draftId: draft.id,
		runtimeMode: runtimeMode(),
		clientKeys: runtimeKeySummary(),
	});

	return draft;
}

export async function reviewDraft(id: string, status: DraftStatus) {
	const [draft] = await adminDb
		.update(counterArgumentDrafts)
		.set({ status, updatedAt: new Date() })
		.where(eq(counterArgumentDrafts.id, id))
		.returning();

	if (!draft) return null;
	await writeAudit("counter_argument_draft", id, "review_status_updated", {
		status,
	});
	return draft;
}

export async function heartbeat(serviceName = "worker") {
	await adminDb
		.insert(cronHeartbeats)
		.values({
			serviceName,
			lastSeenAt: new Date(),
			metadata: { pid: process.pid, updatedAt: new Date().toISOString() },
		})
		.onConflictDoUpdate({
			target: cronHeartbeats.serviceName,
			set: {
				lastSeenAt: new Date(),
				metadata: { pid: process.pid, updatedAt: new Date().toISOString() },
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

function toDashboardScan(row: {
	createdAt: Date;
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
