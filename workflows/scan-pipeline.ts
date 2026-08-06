import { FatalError } from "workflow";

import { isRetryableCollectionError } from "@/lib/providers/errors";
import {
	analyzeScan,
	collectEvidence,
	completeScan,
	failScan,
	recordScanClaimed,
	scoreEvidenceRisk,
	syncScanTopics,
	type ClaimedScanJob,
} from "@/lib/workers/scan-stages";

/**
 * The scan pipeline as a durable workflow.
 *
 * A scan waits on somebody else's crawler and then on two model calls. Run
 * inside one request that is a race against the function timeout: the whole
 * pipeline had to fit in the budget, so a slow provider took the analysis down
 * with it, and a crash lost everything back to the queue.
 *
 * As a workflow each stage is its own durable step. The orchestrator holds no
 * compute while a step runs, so the pipeline's length is no longer bounded by a
 * single function's duration; a step that fails is retried on its own rather
 * than re-running the provider call that already succeeded; and every step's
 * input, output and timing is recorded, so a stuck scan can be read rather than
 * guessed at.
 *
 * The stages themselves live in `lib/workers/scan-stages.ts` and know nothing
 * about workflows — the same functions run straight through when a run cannot
 * be started, which is what keeps this migration reversible.
 */
export async function scanPipelineWorkflow(job: ClaimedScanJob) {
	"use workflow";

	const startedAtMs = await stampStart();

	try {
		await claimStep(job);
		const collected = await collectStep(job);
		await riskStep(job.id);
		await analysisStep(job.id);
		await topicsStep(job.id);
		await completeStep({
			credentialSource: collected.credentialSource,
			evidenceCount: collected.evidenceCount,
			mode: collected.mode,
			scanJobId: job.id,
			startedAtMs,
		});
		return { evidenceCount: collected.evidenceCount, scanId: job.id };
	} catch (error) {
		const outcome = await failStep({
			attempts: job.attempts,
			maxAttempts: job.max_attempts,
			message: error instanceof Error ? error.message : String(error),
			retryable: !(error instanceof FatalError),
			scanJobId: job.id,
			startedAtMs,
		});
		return { error: outcome.message, scanId: job.id };
	}
}

/**
 * The clock has to be read inside a step.
 *
 * A workflow body is replayed to rebuild its state, so anything that changes
 * between replays has to be recorded once and read back — otherwise the
 * reported duration would be measured from whenever the last replay happened.
 */
async function stampStart() {
	"use step";
	return Date.now();
}

async function claimStep(job: ClaimedScanJob) {
	"use step";
	await recordScanClaimed(job);
}

/**
 * Collection is the stage worth retrying on its own: it is the slowest, it
 * depends on an external crawler, and everything after it is cheap by
 * comparison.
 *
 * A terminal fault is re-thrown as FatalError so it does not spend the retry
 * budget. Retrying an exhausted account quota cannot succeed, and leaves every
 * scan sitting in a state that reads like recovery in progress.
 */
async function collectStep(job: ClaimedScanJob) {
	"use step";
	try {
		return await collectEvidence(job);
	} catch (error) {
		if (!isRetryableCollectionError(error)) {
			throw new FatalError(
				error instanceof Error ? error.message : String(error),
			);
		}
		throw error;
	}
}

async function riskStep(scanJobId: string) {
	"use step";
	return scoreEvidenceRisk(scanJobId);
}

async function analysisStep(scanJobId: string) {
	"use step";
	return analyzeScan(scanJobId);
}

async function topicsStep(scanJobId: string) {
	"use step";
	return syncScanTopics(scanJobId);
}

async function completeStep(input: {
	credentialSource?: string;
	evidenceCount: number;
	mode?: string;
	scanJobId: string;
	startedAtMs: number;
}) {
	"use step";
	await completeScan(input);
}

/**
 * Records the failure the same way the in-request path does.
 *
 * The retry decision arrives as a flag rather than the error itself: an error
 * does not survive the step boundary intact, and `failScan` only needs to know
 * whether another attempt is worth scheduling.
 */
async function failStep(input: {
	attempts: number;
	maxAttempts: number;
	message: string;
	retryable: boolean;
	scanJobId: string;
	startedAtMs: number;
}) {
	"use step";
	return failScan({
		attempts: input.attempts,
		error: new Error(input.message),
		maxAttempts: input.maxAttempts,
		retryable: input.retryable,
		scanJobId: input.scanJobId,
		startedAtMs: input.startedAtMs,
	});
}
