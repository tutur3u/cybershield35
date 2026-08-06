import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireAdminSession } from "@/lib/auth/require-admin";
import {
	revalidateDashboardHealth,
	revalidateDashboardIntelligence,
	revalidateDashboardScan,
	revalidateDashboardTrackedSources,
} from "@/lib/dashboard/cache-invalidation";
import { adminDb } from "@/lib/db/client";
import { reconcileFacebookPageSources } from "@/lib/dashboard/intelligence-server";
import { refreshIntelligenceRollupsBestEffort } from "@/lib/dashboard/intelligence-rollups";
import {
	cronHeartbeats,
	managedSchedulerIntegrations,
} from "@/lib/db/schema";
import {
	processDueArticlePublications,
	reclaimStalledPublicationJobs,
} from "@/lib/workers/article-publications";
import { reconcileZaloRemotePresence } from "@/lib/workers/zalo-presence-reconciliation";
import { reassessStoredEvidenceRisk } from "@/lib/workers/evidence-risk";
import {
	heartbeat,
	processNextJob,
	scanCapacityRemaining,
} from "@/lib/workers/scans";
import { processNextAutomatedDraftJob } from "@/lib/workers/draft-automation";
import { enqueueDueTrackedSources } from "@/lib/workers/tracked-sources";
import { logOperation } from "@/lib/operations/telemetry";

const VERCEL_SCHEDULER_PROVIDER = "vercel-cron";
const VERCEL_CRON_SECRET_MISSING = "VERCEL_CRON_SECRET_MISSING";
const LEGACY_PROVIDER = "managed-scheduler";
const DAILY_DRAIN_LIMIT = 500;

export const managedSchedulerJobPatchSchema = z
	.object({
		enabled: z.boolean().optional(),
		schedule: z.string().trim().min(1).max(120).optional(),
		scheduleTimezone: z.string().trim().min(1).max(128).optional(),
	})
	.refine(
		(value) =>
			value.enabled !== undefined ||
			value.schedule !== undefined ||
			value.scheduleTimezone !== undefined,
		{ message: "Provide a managed scheduler job update" },
	)
	.strict();

export const managedSchedulerExecutionsQuerySchema = z.object({
	jobKey: z.string().trim().min(1).max(128).optional(),
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

type ManagedSchedulerExecutionStatus = {
	durationMs: number | null;
	endedAt: string | null;
	error: string | null;
	httpStatus: number | null;
	id: string;
	jobId: string | null;
	jobKey: string;
	jobName: string;
	response: string | null;
	source: "manual" | "scheduled";
	startedAt: string | null;
	status: string;
};

type ManagedSchedulerJobStatus = {
	active: boolean;
	failureCount: number;
	isOverdue?: boolean;
	jobId: string | null;
	jobKey: string;
	lastExecution: ManagedSchedulerExecutionStatus | null;
	lastRunAt: string | null;
	lastStatus: string | null;
	lockedByDeployment?: boolean;
	name: string;
	nextRunAt: string | null;
	overdueReason: string | null;
	overdueSince: string | null;
	remoteStatusUnknown?: boolean;
	schedule: string;
	scheduleDescription: string;
	scheduleTimezone: string;
};

type ManagedSchedulerStatus = {
	adminRecoveryHref?: string;
	adminRecoveryReason?: string;
	approvalHref?: string;
	approvalReason?: string;
	code?: string;
	configured: boolean;
	enabled: boolean;
	error?: string;
	generatedAt?: string | null;
	jobs: ManagedSchedulerJobStatus[];
	localStorageReady: boolean;
	missingApprovalItems?: string[];
	remoteConfigured?: boolean;
	remoteStatusAvailable?: boolean;
	schedulerProvider: typeof VERCEL_SCHEDULER_PROVIDER;
	setupDisabled: boolean;
	setupDisabledReason?: string;
	setupOrigin?: string;
	serverNow?: string | null;
	tokenLastFour: string | null;
	updatedAt: string | null;
	upstreamStatus?: number;
};

type CronJobDefinition = {
	jobKey: "daily-scans" | "process-article-publications";
	legacyServiceName: string;
	name: string;
	schedule: string;
	scheduleDescription: string;
	serviceName: string;
};

type CronExecutionResult = {
	execution: ManagedSchedulerExecutionStatus;
	payload: Record<string, unknown>;
	statusCode: number;
};

const VERCEL_CRON_JOBS: CronJobDefinition[] = [
	{
		jobKey: "daily-scans",
		legacyServiceName: "managed-scheduler:daily-scans",
		name: "Quét nguồn hằng ngày",
		schedule: "0 0 * * *",
		scheduleDescription: "Hằng ngày lúc 00:00 UTC",
		serviceName: "vercel-cron:daily-scans",
	},
	{
		jobKey: "process-article-publications",
		legacyServiceName: "managed-scheduler:process-article-publications",
		name: "Xuất bản bài viết Zalo OA",
		schedule: "*/5 * * * *",
		scheduleDescription: "Mỗi 5 phút",
		serviceName: "vercel-cron:process-article-publications",
	},
];

export async function getManagedSchedulerStatus(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return json({ error: auth.error }, { status: auth.status });

	return json(await buildVercelSchedulerStatus(), {
		setCookie: auth.setCookie,
	});
}

export async function setupManagedScheduler(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return json({ error: auth.error }, { status: auth.status });

	return json(await buildVercelSchedulerStatus(), {
		setCookie: auth.setCookie,
	});
}

export async function proxyManagedSchedulerRequest(
	request: Request,
	input: {
		body?: unknown;
		method: "PATCH" | "POST";
		path: string;
	},
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return json({ error: auth.error }, { status: auth.status });

	const runNowMatch = /^jobs\/([^/]+)\/run-now$/u.exec(input.path);
	if (input.method === "POST" && runNowMatch?.[1]) {
		return runSchedulerJobResponse(runNowMatch[1], "manual", auth.setCookie);
	}

	if (input.method === "PATCH" && /^jobs\/([^/]+)$/u.test(input.path)) {
		return json(
			{
				code: "VERCEL_CRON_DEPLOYMENT_MANAGED",
				error:
					"Vercel Cron schedules are managed in vercel.json. Change the schedule in code and redeploy.",
			},
			{ setCookie: auth.setCookie, status: 409 },
		);
	}

	return json({ error: "Unknown Vercel Cron scheduler action" }, {
		setCookie: auth.setCookie,
		status: 404,
	});
}

export async function proxyManagedSchedulerRead(
	request: Request,
	input: {
		path: string;
	},
) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) return json({ error: auth.error }, { status: auth.status });

	const allExecutionsMatch = /^executions\?(.*)$/u.exec(input.path);
	if (allExecutionsMatch) {
		const searchParams = new URLSearchParams(allExecutionsMatch[1]);
		return json(await buildVercelCronExecutions(searchParams), {
			setCookie: auth.setCookie,
		});
	}

	const jobExecutionsMatch = /^jobs\/([^/]+)\/executions\?(.*)$/u.exec(
		input.path,
	);
	if (jobExecutionsMatch?.[1]) {
		const searchParams = new URLSearchParams(jobExecutionsMatch[2] ?? "");
		searchParams.set("jobKey", jobExecutionsMatch[1]);
		return json(await buildVercelCronExecutions(searchParams), {
			setCookie: auth.setCookie,
		});
	}

	return json({ error: "Unknown Vercel Cron scheduler read" }, {
		setCookie: auth.setCookie,
		status: 404,
	});
}

export async function runVercelCronRoute(request: Request, jobKey: string) {
	if (!verifyVercelCronRequest(request)) {
		return json({ error: "Unauthorized" }, { status: 401 });
	}

	return runSchedulerJobResponse(jobKey, "scheduled");
}

export async function runLegacyManagedSchedulerRoute(
	request: Request,
	jobKey: string,
) {
	if (!(await verifyManagedSchedulerRequest(request))) {
		return json({ error: "Forbidden" }, { status: 403 });
	}

	return runSchedulerJobResponse(jobKey, "scheduled");
}

export async function verifyManagedSchedulerRequest(request: Request) {
	const token = bearerToken(request);
	if (!token) return false;

	const local = await getLegacyLocalIntegration().catch(() => null);
	if (!local?.enabled) return false;

	return safeEqual(hashSchedulerToken(token), local.tokenHash);
}

export function json(
	body: unknown,
	options: { setCookie?: string | null; status?: number } = {},
) {
	const headers = new Headers({ "Cache-Control": "no-store" });
	if (options.setCookie) headers.set("Set-Cookie", options.setCookie);
	return Response.json(body, { headers, status: options.status });
}

async function runSchedulerJobResponse(
	jobKey: string,
	source: "manual" | "scheduled",
	setCookie?: string | null,
) {
	const job = findVercelCronJob(jobKey);
	if (!job) {
		return json({ error: "Unknown Vercel Cron job" }, { setCookie, status: 404 });
	}

	const result = await runVercelSchedulerJob(job, source);
	const scanIds = Array.isArray(result.payload.scanIds)
		? result.payload.scanIds.filter(
				(scanId): scanId is string => typeof scanId === "string",
			)
		: [];
	revalidateSchedulerDashboardCaches(job.jobKey, scanIds);
	return json(
		{
			...result.payload,
			execution: result.execution,
			jobKey: job.jobKey,
			provider: VERCEL_SCHEDULER_PROVIDER,
			status: result.execution.status,
		},
		{ setCookie, status: result.statusCode },
	);
}

function revalidateSchedulerDashboardCaches(jobKey: string, scanIds: string[]) {
	try {
		for (const scanId of scanIds) revalidateDashboardScan(scanId);
		if (jobKey === "daily-scans") {
			revalidateDashboardTrackedSources();
			revalidateDashboardIntelligence();
		}
		revalidateDashboardHealth();
	} catch (error) {
		// Direct worker/unit-test execution has no Next.js static-generation store.
		// Route-handler execution does, so cache invalidation still remains strict there.
		if (
			error instanceof Error &&
			error.message.includes("static generation store missing")
		) {
			return;
		}
		throw error;
	}
}

async function runVercelSchedulerJob(
	job: CronJobDefinition,
	source: "manual" | "scheduled",
): Promise<CronExecutionResult> {
	const startedAt = new Date();
	let payload: Record<string, unknown> = {};
	let status: ManagedSchedulerExecutionStatus["status"] = "success";
	let statusCode = 200;
	let error: string | null = null;
	logOperation("scheduler_job_started", {
		jobKey: job.jobKey,
		source,
	});

	try {
		payload = await executeVercelCronJob(job);
	} catch (caught) {
		status = "failed";
		statusCode = 500;
		error = safeCronError(caught);
		payload = { error };
	}

	const endedAt = new Date();
	logOperation(
		"scheduler_job_completed",
		{
			durationMs: endedAt.getTime() - startedAt.getTime(),
			jobKey: job.jobKey,
			source,
			status,
		},
		status === "failed" ? "error" : "info",
	);
	const execution: ManagedSchedulerExecutionStatus = {
		durationMs: endedAt.getTime() - startedAt.getTime(),
		endedAt: endedAt.toISOString(),
		error,
		httpStatus: statusCode,
		id: `${job.jobKey}:${startedAt.toISOString()}`,
		jobId: null,
		jobKey: job.jobKey,
		jobName: job.name,
		response: JSON.stringify(payload).slice(0, 2000),
		source,
		startedAt: startedAt.toISOString(),
		status,
	};

	const heartbeatError = await writeSchedulerHeartbeat(job, execution, source);
	if (heartbeatError) {
		payload.heartbeatError = heartbeatError;
		if (status === "success") {
			status = "failed";
			statusCode = 500;
			error = heartbeatError;
			execution.error = error;
			execution.httpStatus = statusCode;
			execution.status = status;
		}
		execution.response = JSON.stringify(payload).slice(0, 2000);
	}

	return { execution, payload, statusCode };
}

async function writeSchedulerHeartbeat(
	job: CronJobDefinition,
	execution: ManagedSchedulerExecutionStatus,
	source: "manual" | "scheduled",
) {
	try {
		await heartbeat(job.serviceName, {
			jobKey: job.jobKey,
			lastExecution: execution,
			provider: VERCEL_SCHEDULER_PROVIDER,
			schedule: job.schedule,
			source,
		});
		return null;
	} catch (error) {
		return safeCronError(error);
	}
}

/**
 * Starts as many queued scans as the concurrency cap allows.
 *
 * Stops at the cap rather than at the request's time budget: a durable run
 * returns as soon as it starts, so the loop is no longer self-limiting and the
 * queue depth would otherwise land on the provider all at once.
 */
async function drainScanQueue() {
	const capacity = Math.min(DAILY_DRAIN_LIMIT, await scanCapacityRemaining());
	const scanIds: string[] = [];
	let failed = 0;
	let processed = 0;

	for (let index = 0; index < capacity; index += 1) {
		const result = await processNextJob();
		if (!result.processed) break;

		processed += 1;
		if ("scanId" in result && result.scanId) scanIds.push(result.scanId);
		if ("error" in result && result.error) failed += 1;
	}

	return { capacity, failed, processed, scanIds };
}

async function executeVercelCronJob(job: CronJobDefinition) {
	if (job.jobKey === "process-article-publications") {
		// Before draining: a job left locked by a killed request blocks its article
		// from every path, and nothing else would ever release it.
		const reclaimed = await reclaimStalledPublicationJobs().catch(() => 0);
		const publications = await processDueArticlePublications(5);
		// Runs alongside the queue rather than on its own schedule: a pointer to a
		// draft that is no longer on the OA is exactly what the queue's own
		// removals leave behind, so the check belongs next to them.
		const presence = await reconcileZaloRemotePresence({ limit: 25 }).catch(
			() => null,
		);
		// Scans now run as durable workflows, so the daily job can only start as
		// many as the concurrency cap allows and the rest wait. This tick is what
		// keeps them moving — without it a capped queue would sit until tomorrow.
		const scans = await drainScanQueue();
		return { ...publications, reclaimed, remotePresence: presence, scans };
	}

	const reconciliation = await reconcileFacebookPageSources();
	const riskReassessment = await reassessStoredEvidenceRisk();
	const enqueued = await enqueueDueTrackedSources();

	const scanIds = enqueued.scans.map((scan) => scan.scanId);
	const automatedDraftIds: string[] = [];
	let failed = 0;
	let processed = 0;

	const drained = await drainScanQueue();
	scanIds.push(...drained.scanIds);
	processed += drained.processed;
	failed += drained.failed;

	let automatedDraftsProcessed = 0;
	for (let index = 0; index < DAILY_DRAIN_LIMIT; index += 1) {
		const result = await processNextAutomatedDraftJob();
		if (!result.processed) break;
		automatedDraftsProcessed += 1;
		if ("draftId" in result && result.draftId) {
			automatedDraftIds.push(result.draftId);
		}
		if ("error" in result && result.error) failed += 1;
	}

	await refreshIntelligenceRollupsBestEffort("daily-orchestrator");

	return {
		automatedDraftIds,
		automatedDraftsProcessed,
		enqueued: enqueued.enqueued,
		failed,
		processed,
		reconciliation,
		riskReassessment,
		recovered: enqueued.recovered,
		// A scan this run enqueued and then drained appears from both stages, so
		// the raw list double-counts it and the response reads as twice the work.
		scanIds: [...new Set(scanIds)],
		skipped: enqueued.skipped,
	};
}

async function buildVercelSchedulerStatus(): Promise<ManagedSchedulerStatus> {
	const rows = await adminDb.select().from(cronHeartbeats);
	const now = new Date();
	const cronSecretReady = Boolean(process.env.CRON_SECRET?.trim());
	const jobs = VERCEL_CRON_JOBS.map((job) => {
		const row = latestHeartbeatRow(rows, job);
		return toVercelCronJobStatus(job, row, now);
	});
	const latestRun = jobs
		.map((job) => job.lastRunAt)
		.filter((value): value is string => Boolean(value))
		.sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;

	return {
		...(cronSecretReady
			? {}
			: {
					code: VERCEL_CRON_SECRET_MISSING,
					error:
						"Set CRON_SECRET in Vercel project environment variables so Vercel Cron can authenticate scheduled invocations.",
					setupDisabledReason:
						"Set CRON_SECRET in Vercel project environment variables so Vercel Cron can authenticate scheduled invocations.",
				}),
		configured: true,
		enabled: cronSecretReady,
		generatedAt: now.toISOString(),
		jobs,
		localStorageReady: true,
		remoteConfigured: true,
		remoteStatusAvailable: true,
		schedulerProvider: VERCEL_SCHEDULER_PROVIDER,
		serverNow: now.toISOString(),
		setupDisabled: !cronSecretReady,
		tokenLastFour: null,
		updatedAt: latestRun,
	};
}

async function buildVercelCronExecutions(searchParams: URLSearchParams) {
	const parsed = managedSchedulerExecutionsQuerySchema.parse(
		Object.fromEntries(searchParams.entries()),
	);
	const rows = await adminDb.select().from(cronHeartbeats);
	const items = VERCEL_CRON_JOBS.map((job) =>
		executionFromHeartbeat(latestHeartbeatRow(rows, job), job),
	).filter(isExecutionStatus);
	const filtered = parsed.jobKey
		? items.filter((item) => item.jobKey === parsed.jobKey)
		: items;
	const offset = (parsed.page - 1) * parsed.pageSize;
	const pageItems = filtered
		.sort((left, right) => Date.parse(right.startedAt ?? "") - Date.parse(left.startedAt ?? ""))
		.slice(offset, offset + parsed.pageSize);
	const pageCount = Math.max(1, Math.ceil(filtered.length / parsed.pageSize));

	return {
		hasNextPage: parsed.page < pageCount,
		hasPreviousPage: parsed.page > 1,
		items: pageItems,
		page: parsed.page,
		pageCount,
		pageSize: parsed.pageSize,
		total: filtered.length,
	};
}

function toVercelCronJobStatus(
	job: CronJobDefinition,
	row: { lastSeenAt: Date; metadata: Record<string, unknown> } | null,
	now: Date,
): ManagedSchedulerJobStatus {
	const lastExecution = executionFromHeartbeat(row, job);
	const lastRunAt = lastExecution?.startedAt ?? row?.lastSeenAt.toISOString() ?? null;
	const nextRunAt = nextRunForSchedule(job.schedule, now).toISOString();
	const overdueSince =
		row && now.getTime() - row.lastSeenAt.getTime() > overdueWindowMs(job.schedule)
			? row.lastSeenAt.toISOString()
			: null;

	return {
		active: true,
		failureCount: lastExecution?.status === "failed" ? 1 : 0,
		isOverdue: Boolean(overdueSince),
		jobId: null,
		jobKey: job.jobKey,
		lastExecution,
		lastRunAt,
		lastStatus: lastExecution?.status ?? null,
		lockedByDeployment: true,
		name: job.name,
		nextRunAt,
		overdueReason: overdueSince
			? "No Vercel Cron heartbeat was recorded inside the expected window."
			: null,
		overdueSince,
		schedule: job.schedule,
		scheduleDescription: job.scheduleDescription,
		scheduleTimezone: "UTC",
	};
}

function latestHeartbeatRow(
	rows: Array<{
		lastSeenAt: Date;
		metadata: Record<string, unknown>;
		serviceName: string;
	}>,
	job: CronJobDefinition,
) {
	const candidates = rows.filter(
		(row) =>
			row.serviceName === job.serviceName ||
			row.serviceName === job.legacyServiceName,
	);
	return candidates.sort(
		(left, right) => right.lastSeenAt.getTime() - left.lastSeenAt.getTime(),
	)[0] ?? null;
}

function executionFromHeartbeat(
	row: { lastSeenAt: Date; metadata: Record<string, unknown> } | null,
	job: CronJobDefinition,
): ManagedSchedulerExecutionStatus | null {
	if (!row) return null;
	const metadata = row.metadata;
	const execution =
		metadata.lastExecution && typeof metadata.lastExecution === "object"
			? normalizeExecution(metadata.lastExecution)
			: null;
	if (execution) return execution;

	return {
		durationMs: null,
		endedAt: row.lastSeenAt.toISOString(),
		error: null,
		httpStatus: 200,
		id: `${job.jobKey}:${row.lastSeenAt.toISOString()}`,
		jobId: null,
		jobKey: job.jobKey,
		jobName: job.name,
		response: null,
		source: metadata.source === "manual" ? "manual" : "scheduled",
		startedAt: row.lastSeenAt.toISOString(),
		status: "success",
	};
}

function normalizeExecution(value: unknown): ManagedSchedulerExecutionStatus | null {
	if (!value || typeof value !== "object") return null;
	const row = value as Record<string, unknown>;
	const jobKey = cleanString(row.jobKey ?? row.job_key);
	if (!jobKey) return null;

	return {
		durationMs: normalizeNullableNumber(row.durationMs ?? row.duration_ms),
		endedAt: cleanString(row.endedAt ?? row.endTime ?? row.end_time),
		error: cleanString(row.error),
		httpStatus: normalizeNullableNumber(row.httpStatus ?? row.http_status),
		id: cleanString(row.id) ?? `${jobKey}:${cleanString(row.startedAt) ?? "unknown"}`,
		jobId: cleanString(row.jobId ?? row.job_id),
		jobKey,
		jobName: cleanString(row.jobName ?? row.name) ?? jobKey,
		response: cleanString(row.response),
		source: row.source === "manual" ? "manual" : "scheduled",
		startedAt: cleanString(row.startedAt ?? row.startTime ?? row.start_time),
		status: cleanString(row.status) ?? "unknown",
	};
}

function isExecutionStatus(
	value: ManagedSchedulerExecutionStatus | null,
): value is ManagedSchedulerExecutionStatus {
	return value !== null;
}

async function getLegacyLocalIntegration() {
	const [row] = await adminDb
		.select()
		.from(managedSchedulerIntegrations)
		.where(eq(managedSchedulerIntegrations.provider, LEGACY_PROVIDER))
		.limit(1);

	return row ?? null;
}

function verifyVercelCronRequest(request: Request) {
	const cronSecret = process.env.CRON_SECRET?.trim();
	if (!cronSecret) return false;

	return safeEqual(bearerToken(request) ?? "", cronSecret);
}

function findVercelCronJob(jobKey: string) {
	return VERCEL_CRON_JOBS.find((job) => job.jobKey === jobKey);
}

function nextRunForSchedule(schedule: string, from: Date) {
	const next = new Date(from.getTime());
	next.setUTCSeconds(0, 0);

	if (schedule === "*/30 * * * *") {
		const minutes = next.getUTCMinutes();
		const remainder = minutes % 30;
		next.setUTCMinutes(minutes + (remainder === 0 ? 30 : 30 - remainder));
		return next;
	}

	if (schedule === "0 0 * * *") {
		next.setUTCHours(0, 0, 0, 0);
		if (next.getTime() <= from.getTime()) {
			next.setUTCDate(next.getUTCDate() + 1);
		}
		return next;
	}

	next.setUTCMinutes(0, 0, 0);
	next.setUTCHours(next.getUTCHours() + 1);
	return next;
}

function overdueWindowMs(schedule: string) {
	if (schedule === "0 0 * * *") return 30 * 60 * 60_000;
	return schedule === "*/30 * * * *" ? 75 * 60_000 : 75 * 60_000;
}

function safeCronError(error: unknown) {
	if (!(error instanceof Error)) return "Cron job failed.";
	if (
		/CONNECT_TIMEOUT|connection|connect|timeout|database|postgres|failed query/iu.test(
			error.message,
		)
	) {
		return "Cron job failed because the database connection is unavailable or timed out.";
	}
	if (/token|secret|authorization|cookie/iu.test(error.message)) {
		return "Cron job failed because a required secret or authorization value is unavailable.";
	}
	return error.message.slice(0, 500);
}

function hashSchedulerToken(token: string) {
	return createHash("sha256").update(token).digest("base64url");
}

function bearerToken(request: Request) {
	const header = request.headers.get("authorization") ?? "";
	const match = /^Bearer\s+(.+)$/iu.exec(header.trim());
	return match?.[1]?.trim() ?? null;
}

function safeEqual(value: string, expected: string) {
	const valueBuffer = Buffer.from(value);
	const expectedBuffer = Buffer.from(expected);

	return (
		valueBuffer.length === expectedBuffer.length &&
		timingSafeEqual(valueBuffer, expectedBuffer)
	);
}

function normalizeNullableNumber(value: unknown) {
	if (value == null) return null;
	const number = Number(value);
	return Number.isFinite(number) ? number : null;
}

function cleanString(value: unknown) {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}
