import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { buildManagedSchedulerApprovalUrl } from "@/lib/auth/scope-approval";
import { getTuturuuuWebAppUrl } from "@/lib/auth/login-link";
import {
	buildTuturuuuApiUrl,
	getBearerForPlatformRequest,
	sanitizeAuthError,
} from "@/lib/auth/tuturuuu-session";
import { adminDb } from "@/lib/db/client";
import {
	managedSchedulerIntegrations,
	type ManagedSchedulerIntegrationRow,
} from "@/lib/db/schema";

const PROVIDER = "managed-scheduler";
const LOCAL_SCHEDULER_STORAGE_NOT_READY =
	"LOCAL_SCHEDULER_STORAGE_NOT_READY";
const LOCAL_SCHEDULER_STORAGE_MESSAGE =
	"Managed scheduler storage is not ready. Run bun db:migrate, then restart the app.";
const TUTURUUU_CRON_RUNNER_RECOVERY_PATH =
	"/vi/internal/infrastructure/monitoring/cron?focus=cron-runner";
const APPROVAL_REQUIRED_CODES = new Set([
	"CRON_APPROVAL_REQUIRED",
	"MANAGED_CRON_APPROVAL_REQUIRED",
	"MANAGED_CRON_DOMAIN_NOT_APPROVED",
	"SCOPE_APPROVAL_REQUIRED",
]);
const MANAGED_CRON_INFRA_BLOCKED_CODES = new Set([
	"MANAGED_CRON_DATABASE_UNAVAILABLE",
	"MANAGED_CRON_JOB_UPDATE_FAILED",
	"MANAGED_CRON_RUN_NOW_FAILED",
	"MANAGED_CRON_SCHEMA_NOT_READY",
	"MANAGED_CRON_SETUP_FAILED",
	"MANAGED_CRON_STATUS_CHECK_FAILED",
	"MANAGED_CRON_UNAVAILABLE",
]);
const SCOPE_NOT_ALLOWED_ERROR = "Requested scope is not allowed for this app";

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
	name: string;
	nextRunAt: string | null;
	overdueReason: string | null;
	overdueSince: string | null;
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
	setupDisabled: boolean;
	setupDisabledReason?: string;
	setupOrigin?: string;
	serverNow?: string | null;
	tokenLastFour: string | null;
	updatedAt: string | null;
	upstreamStatus?: number;
};

type LocalIntegrationState =
	| { kind: "ready"; row: ManagedSchedulerIntegrationRow | null }
	| { kind: "not_ready" };

export async function getManagedSchedulerStatus(request: Request) {
	try {
		const auth = await getBearerForPlatformRequest(request);
		const localState = await getLocalIntegrationState();
		if (localState.kind === "not_ready") {
			return json(localSchedulerStorageNotReadyStatus(), {
				setCookie: auth.setCookie,
			});
		}

		const response = await fetch(buildManagedSchedulerUrl(""), {
			cache: "no-store",
			headers: { Authorization: auth.authorization },
			method: "GET",
		});
		const upstream = await readUpstreamSchedulerResponse(response);
		const body = normalizeUpstreamSchedulerBody({
			body: upstream.body,
			operation: "status",
			request,
			response,
		});
		const approvalHref = approvalHrefForResponse({ body, request, response });
		const setupOrigin = setupOriginForResponse({ body, request });

		return json(
			normalizeSchedulerStatus({
				approvalHref,
				blocked: !response.ok,
				local: localState.row,
				remote: body,
				setupOrigin,
				upstreamStatus: upstream.status,
			}),
			{
				setCookie: auth.setCookie,
				status: 200,
			},
		);
	} catch (error) {
		const safe = sanitizeAuthError(error);
		const schedulerBody = authSchedulerStatusBody(safe, request);
		if (schedulerBody) return json(schedulerBody);
		return json(authErrorBody(safe, request), { status: safe.status });
	}
}

export async function setupManagedScheduler(request: Request) {
	try {
		const auth = await getBearerForPlatformRequest(request);
		const localState = await getLocalIntegrationState();
		if (localState.kind === "not_ready") {
			return json(localSchedulerStorageNotReadyStatus(), {
				setCookie: auth.setCookie,
				status: 503,
			});
		}

		const appOrigin = getPublicAppOrigin(request);
		const token = generateSchedulerToken();
		const response = await fetch(buildManagedSchedulerUrl("setup"), {
			body: JSON.stringify({
				callbackBaseUrl: appOrigin,
				origin: appOrigin,
				token,
			}),
			cache: "no-store",
			headers: {
				Authorization: auth.authorization,
				"Content-Type": "application/json",
			},
			method: "POST",
		});
		const upstream = await readUpstreamSchedulerResponse(response);
		const body = normalizeUpstreamSchedulerBody({
			body: upstream.body,
			operation: "setup",
			request,
			response,
		});

		if (!response.ok) {
			return json(
				normalizeSchedulerStatus({
					approvalHref: approvalHrefForResponse({ body, request, response }),
					blocked: true,
					local: localState.row,
					remote: body,
					setupOrigin: setupOriginForResponse({ body, request }),
					upstreamStatus: upstream.status,
				}),
				{ setCookie: auth.setCookie, status: response.status },
			);
		}

		const local = await saveLocalIntegration({
			enabled: true,
			metadata: sanitizeSetupMetadata(body),
			token,
		});

		return json(
			normalizeSchedulerStatus({
				local,
				remote: body,
			}),
			{ setCookie: auth.setCookie },
		);
	} catch (error) {
		if (isMissingManagedSchedulerStorageError(error)) {
			return json(localSchedulerStorageNotReadyStatus(), { status: 503 });
		}

		const safe = sanitizeAuthError(error);
		const schedulerBody = authSchedulerStatusBody(safe, request);
		if (schedulerBody) return json(schedulerBody, { status: safe.status });
		return json(authErrorBody(safe, request), { status: safe.status });
	}
}

export async function proxyManagedSchedulerRequest(
	request: Request,
	input: {
		body?: unknown;
		method: "PATCH" | "POST";
		path: string;
	},
) {
	try {
		const auth = await getBearerForPlatformRequest(request);
		const localState = await getLocalIntegrationState();
		if (localState.kind === "not_ready") {
			return json(localSchedulerStorageNotReadyStatus(), {
				setCookie: auth.setCookie,
				status: 503,
			});
		}

		const response = await fetch(buildManagedSchedulerUrl(input.path), {
			body: input.body === undefined ? undefined : JSON.stringify(input.body),
			cache: "no-store",
			headers: {
				Authorization: auth.authorization,
				...(input.body === undefined
					? {}
					: { "Content-Type": "application/json" }),
			},
			method: input.method,
		});
		const upstream = await readUpstreamSchedulerResponse(response);

		return json(upstream.body ?? fallbackBody(response.status), {
			setCookie: auth.setCookie,
			status: response.status,
		});
	} catch (error) {
		const safe = sanitizeAuthError(error);
		return json(authErrorBody(safe, request), { status: safe.status });
	}
}

export async function proxyManagedSchedulerRead(
	request: Request,
	input: {
		path: string;
	},
) {
	try {
		const auth = await getBearerForPlatformRequest(request);
		const localState = await getLocalIntegrationState();
		if (localState.kind === "not_ready") {
			return json(localSchedulerStorageNotReadyStatus(), {
				setCookie: auth.setCookie,
				status: 503,
			});
		}

		const response = await fetch(buildManagedSchedulerUrl(input.path), {
			cache: "no-store",
			headers: {
				Accept: "application/json",
				Authorization: auth.authorization,
			},
			method: "GET",
		});
		const upstream = await readUpstreamSchedulerResponse(response);

		return json(upstream.body ?? fallbackBody(response.status), {
			setCookie: auth.setCookie,
			status: response.status,
		});
	} catch (error) {
		const safe = sanitizeAuthError(error);
		return json(authErrorBody(safe, request), { status: safe.status });
	}
}

export async function verifyManagedSchedulerRequest(request: Request) {
	const token = bearerToken(request);
	if (!token) return false;

	const localState = await getLocalIntegrationState();
	if (localState.kind === "not_ready" || !localState.row?.enabled) return false;

	return safeEqual(hashSchedulerToken(token), localState.row.tokenHash);
}

export function json(
	body: unknown,
	options: { setCookie?: string | null; status?: number } = {},
) {
	const headers = new Headers({ "Cache-Control": "no-store" });
	if (options.setCookie) headers.set("Set-Cookie", options.setCookie);
	return Response.json(body, { headers, status: options.status });
}

function buildManagedSchedulerUrl(path: string) {
	const workspaceId = process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID?.trim();
	if (!workspaceId) {
		throw new Error("Missing workspace configuration");
	}

	const suffix = path.replace(/^\/+/u, "");
	return buildTuturuuuApiUrl(
		`workspaces/${encodeURIComponent(workspaceId)}/external-apps/cron${
			suffix ? `/${suffix}` : ""
		}`,
	);
}

function normalizeSchedulerStatus({
	approvalHref,
	blocked = false,
	local,
	remote,
	setupOrigin,
	upstreamStatus,
}: {
	approvalHref?: string;
	blocked?: boolean;
	local: ManagedSchedulerIntegrationRow | null;
	remote: unknown;
	setupOrigin?: string;
	upstreamStatus?: number;
}): ManagedSchedulerStatus {
	const remoteRecord =
		remote && typeof remote === "object" ? (remote as Record<string, unknown>) : {};
	const code = cleanString(remoteRecord.code) ?? undefined;
	const remoteError = cleanString(remoteRecord.error ?? remoteRecord.message);
	const error =
		remoteError ??
		(blocked && !approvalHref ? "Managed scheduler request failed" : undefined);
	const missingApprovalItems = normalizeMissingApprovalItems(
		remoteRecord.missing ?? remoteRecord.missingApprovalItems,
	);
	const approvalReason = approvalReasonFromRemote(remoteRecord, error ?? undefined);
	const setupDisabledReason =
		cleanString(remoteRecord.setupDisabledReason) ??
		setupDisabledReasonForApproval({
			approvalHref,
			blocked,
			missingApprovalItems,
			setupOrigin,
		});
	const normalizedUpstreamStatus =
		normalizeUpstreamStatus(remoteRecord.upstreamStatus) ?? upstreamStatus;
	const adminRecoveryHref = adminRecoveryHrefForRemote({
		approvalHref,
		code,
		remoteRecord,
		setupDisabledReason,
		upstreamStatus: normalizedUpstreamStatus,
	});
	const adminRecoveryReason =
		adminRecoveryHref ?
			cleanString(remoteRecord.adminRecoveryReason) ??
			setupDisabledReason ??
			error
		: undefined;
	const jobs = Array.isArray(remoteRecord.jobs)
		? remoteRecord.jobs.map(normalizeJob).filter(isSchedulerJobStatus)
		: [];
	const generatedAt = cleanString(remoteRecord.generatedAt);
	const serverNow = cleanString(remoteRecord.serverNow);

	return {
		...(adminRecoveryHref ? { adminRecoveryHref } : {}),
		...(adminRecoveryReason ? { adminRecoveryReason } : {}),
		...(approvalHref ? { approvalHref } : {}),
		...(approvalReason ? { approvalReason } : {}),
		...(code ? { code } : {}),
		...(error ? { error } : {}),
		...(generatedAt ? { generatedAt } : {}),
		...(missingApprovalItems.length > 0 ? { missingApprovalItems } : {}),
		...(setupDisabledReason ? { setupDisabledReason } : {}),
		...(setupOrigin ? { setupOrigin } : {}),
		...(serverNow ? { serverNow } : {}),
		...(normalizedUpstreamStatus ? { upstreamStatus: normalizedUpstreamStatus } : {}),
		configured: Boolean(local) && remoteRecord.configured !== false,
		enabled: Boolean(local?.enabled) && remoteRecord.enabled !== false,
		jobs,
		localStorageReady: true,
		setupDisabled:
			!approvalHref &&
			(blocked || Boolean(error) || Boolean(setupDisabledReason)),
		tokenLastFour: local?.tokenLastFour ?? null,
		updatedAt: local?.updatedAt?.toISOString() ?? null,
	};
}

function adminRecoveryHrefForRemote({
	approvalHref,
	code,
	remoteRecord,
	setupDisabledReason,
	upstreamStatus,
}: {
	approvalHref?: string;
	code?: string;
	remoteRecord: Record<string, unknown>;
	setupDisabledReason?: string;
	upstreamStatus?: number;
}) {
	if (approvalHref) return undefined;

	const remoteHref = safeTuturuuuCronRecoveryHref(remoteRecord.adminRecoveryHref);
	if (remoteHref) return remoteHref;

	if (
		!isInfraBlockedManagedCronState({
			code,
			setupDisabledReason,
			upstreamStatus,
		})
	) {
		return undefined;
	}

	return buildFallbackTuturuuuCronRecoveryHref();
}

function isInfraBlockedManagedCronState({
	code,
	setupDisabledReason,
	upstreamStatus,
}: {
	code?: string;
	setupDisabledReason?: string;
	upstreamStatus?: number;
}) {
	if (code && MANAGED_CRON_INFRA_BLOCKED_CODES.has(code)) return true;
	if (typeof upstreamStatus === "number" && upstreamStatus >= 500) return true;
	return Boolean(
		setupDisabledReason && /managed cron|managed scheduler/iu.test(setupDisabledReason),
	);
}

function safeTuturuuuCronRecoveryHref(value: unknown) {
	const href = cleanString(value);
	if (!href) return undefined;

	try {
		const webAppUrl = getTuturuuuWebAppUrl();
		const parsed = new URL(href, webAppUrl);
		const allowedOrigin = new URL(webAppUrl).origin;
		if (parsed.origin !== allowedOrigin) return undefined;
		if (!parsed.pathname.endsWith("/internal/infrastructure/monitoring/cron")) {
			return undefined;
		}
		return parsed.toString();
	} catch {
		return undefined;
	}
}

function buildFallbackTuturuuuCronRecoveryHref() {
	const url = new URL(TUTURUUU_CRON_RUNNER_RECOVERY_PATH, getTuturuuuWebAppUrl());
	return url.toString();
}

function normalizeJob(value: unknown): ManagedSchedulerJobStatus | null {
	if (!value || typeof value !== "object") return null;
	const row = value as Record<string, unknown>;
	const jobKey = cleanString(row.jobKey ?? row.job_key ?? row.key);
	if (!jobKey) return null;

	return {
		active: row.active !== false,
		failureCount: Number(row.failureCount ?? row.failure_count ?? 0),
		isOverdue: row.isOverdue === true || row.is_overdue === true,
		jobId: cleanString(row.jobId ?? row.job_id),
		jobKey,
		lastExecution: normalizeExecution(row.lastExecution ?? row.last_execution),
		lastRunAt: cleanString(row.lastRunAt ?? row.last_run_at),
		lastStatus: cleanString(row.lastStatus ?? row.last_status),
		name: cleanString(row.name) ?? jobKey,
		nextRunAt: cleanString(row.nextRunAt ?? row.next_run_at),
		overdueReason: cleanString(row.overdueReason ?? row.overdue_reason),
		overdueSince: cleanString(row.overdueSince ?? row.overdue_since),
		schedule: cleanString(row.schedule) ?? "",
		scheduleDescription: cleanString(row.scheduleDescription) ?? "",
		scheduleTimezone: cleanString(row.scheduleTimezone) ?? "UTC",
	};
}

function normalizeExecution(value: unknown): ManagedSchedulerExecutionStatus | null {
	if (!value || typeof value !== "object") return null;
	const row = value as Record<string, unknown>;
	const id = cleanString(row.id);
	const jobKey = cleanString(row.jobKey ?? row.job_key);
	if (!id && !jobKey) return null;

	return {
		durationMs: normalizeNullableNumber(row.durationMs ?? row.duration_ms),
		endedAt: cleanString(row.endedAt ?? row.endTime ?? row.end_time),
		error: cleanString(row.error),
		httpStatus: normalizeNullableNumber(row.httpStatus ?? row.http_status),
		id: id ?? "",
		jobId: cleanString(row.jobId ?? row.job_id),
		jobKey: jobKey ?? "",
		jobName: cleanString(row.jobName ?? row.name) ?? jobKey ?? "",
		response: cleanString(row.response),
		source: row.source === "manual" ? "manual" : "scheduled",
		startedAt: cleanString(row.startedAt ?? row.startTime ?? row.start_time),
		status: cleanString(row.status) ?? "unknown",
	};
}

function isSchedulerJobStatus(
	value: ManagedSchedulerJobStatus | null,
): value is ManagedSchedulerJobStatus {
	return value !== null;
}

async function getLocalIntegration() {
	const [row] = await adminDb
		.select()
		.from(managedSchedulerIntegrations)
		.where(eq(managedSchedulerIntegrations.provider, PROVIDER))
		.limit(1);

	return row ?? null;
}

async function getLocalIntegrationState(): Promise<LocalIntegrationState> {
	try {
		return { kind: "ready", row: await getLocalIntegration() };
	} catch (error) {
		if (isMissingManagedSchedulerStorageError(error)) {
			return { kind: "not_ready" };
		}
		throw error;
	}
}

async function saveLocalIntegration({
	enabled,
	metadata,
	token,
}: {
	enabled: boolean;
	metadata: Record<string, unknown>;
	token: string;
}) {
	const [row] = await adminDb
		.insert(managedSchedulerIntegrations)
		.values({
			enabled,
			provider: PROVIDER,
			setupMetadata: metadata,
			tokenHash: hashSchedulerToken(token),
			tokenLastFour: token.slice(-4),
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: managedSchedulerIntegrations.provider,
			set: {
				enabled,
				setupMetadata: metadata,
				tokenHash: hashSchedulerToken(token),
				tokenLastFour: token.slice(-4),
				updatedAt: new Date(),
			},
		})
		.returning();

	if (!row) throw new Error("Failed to save managed scheduler setup");
	return row;
}

function localSchedulerStorageNotReadyStatus(): ManagedSchedulerStatus {
	return {
		code: LOCAL_SCHEDULER_STORAGE_NOT_READY,
		configured: false,
		enabled: false,
		error: LOCAL_SCHEDULER_STORAGE_MESSAGE,
		jobs: [],
		localStorageReady: false,
		setupDisabled: true,
		tokenLastFour: null,
		updatedAt: null,
	};
}

function isMissingManagedSchedulerStorageError(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	const record = error as Record<string, unknown>;
	const code = cleanString(record.code);
	const message =
		error instanceof Error ? error.message : cleanString(record.message) ?? "";

	if (code === "42P01" && /managed_scheduler_integrations/u.test(message)) {
		return true;
	}
	if (
		/managed_scheduler_integrations/u.test(message) &&
		/(does not exist|relation|Failed query)/iu.test(message)
	) {
		return true;
	}

	return isMissingManagedSchedulerStorageError(record.cause);
}

function authErrorBody(
	safe: { message: string; status: number },
	request: Request,
) {
	const approvalHref =
		needsApproval(safe.status, { error: safe.message }) ?
			approvalHrefForResponse({
				body: { error: safe.message },
				request,
				response: new Response(null, { status: safe.status }),
			})
		: undefined;

	return {
		error: safe.message,
		...(approvalHref ? { approvalHref } : {}),
	};
}

function authSchedulerStatusBody(
	safe: { message: string; status: number },
	request: Request,
): ManagedSchedulerStatus | null {
	const body = authErrorBody(safe, request);
	if (!("approvalHref" in body) || !body.approvalHref) return null;

	return {
		approvalHref: body.approvalHref,
		approvalReason: body.error,
		configured: false,
		enabled: false,
		error: body.error,
		jobs: [],
		localStorageReady: true,
		missingApprovalItems: ["scopes"],
		setupDisabled: false,
		setupOrigin: getPublicAppOrigin(request),
		tokenLastFour: null,
		updatedAt: null,
	};
}

async function readUpstreamSchedulerResponse(response: Response) {
	const text = await response.text().catch(() => "");
	return {
		body: parseJsonBody(text),
		status: response.status,
	};
}

function parseJsonBody(text: string) {
	if (!text.trim()) return null;
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return null;
	}
}

function normalizeUpstreamSchedulerBody({
	body,
	operation,
	request,
	response,
}: {
	body: unknown;
	operation: "setup" | "status";
	request: Request;
	response: Response;
}) {
	if (response.ok) return body;
	if (needsApproval(response.status, body)) {
		return withUpstreamStatus(body, response.status);
	}
	if (
		operation === "setup" &&
		response.status === 403 &&
		!hasExplicitNonApprovalFailure(body)
	) {
		return {
			code: "CRON_APPROVAL_REQUIRED",
			error: "Managed scheduler approval required",
			missing: ["domain"],
			origin: setupOriginForResponse({ body, request }),
			upstreamStatus: response.status,
		};
	}

	const setupDisabledReason = upstreamFailureReason(operation, response.status);
	if (body && typeof body === "object") {
		const record = body as Record<string, unknown>;
		return {
			...record,
			setupDisabledReason:
				cleanString(record.setupDisabledReason) ?? setupDisabledReason,
			upstreamStatus: response.status,
		};
	}

	return {
		error: setupDisabledReason,
		setupDisabledReason,
		upstreamStatus: response.status,
	};
}

function withUpstreamStatus(body: unknown, status: number) {
	if (!body || typeof body !== "object") return body;
	return { ...(body as Record<string, unknown>), upstreamStatus: status };
}

function hasExplicitNonApprovalFailure(body: unknown) {
	if (!body || typeof body !== "object") return false;
	const record = body as Record<string, unknown>;
	const code = cleanString(record.code);
	return Boolean(
		cleanString(record.setupDisabledReason) ||
			(code && !APPROVAL_REQUIRED_CODES.has(code)),
	);
}

function upstreamFailureReason(
	operation: "setup" | "status",
	status: number,
) {
	const label =
		operation === "setup" ? "setup" : "status check";
	return `Tuturuuu managed scheduler ${label} returned HTTP ${status}. Check the Tuturuuu managed-cron API deployment, then retry.`;
}

function approvalHrefForResponse({
	body,
	request,
	response,
}: {
	body: unknown;
	request: Request;
	response: Response;
}) {
	if (!needsApproval(response.status, body)) return undefined;

	const appBaseUrl = getPublicAppOrigin(request);
	const setupOrigin = setupOriginFromBody(body) ?? appBaseUrl;
	if (!isPublicHttpsOrigin(setupOrigin)) return undefined;
	const returnBaseUrl = isPublicHttpsOrigin(appBaseUrl) ? appBaseUrl : setupOrigin;

	return buildManagedSchedulerApprovalUrl({
		appBaseUrl: returnBaseUrl,
		origin: setupOrigin,
	});
}

function setupOriginForResponse({
	body,
	request,
}: {
	body: unknown;
	request: Request;
}) {
	return setupOriginFromBody(body) ?? getPublicAppOrigin(request);
}

function setupOriginFromBody(body: unknown) {
	if (!body || typeof body !== "object") return null;
	const record = body as Record<string, unknown>;
	return cleanString(record.origin ?? record.setupOrigin);
}

function needsApproval(status: number, body: unknown) {
	if (status !== 403) return false;
	if (!body || typeof body !== "object") return false;
	const record = body as Record<string, unknown>;
	const code = cleanString(record.code);
	const error = cleanString(record.error ?? record.message);

	return (
		(code ? APPROVAL_REQUIRED_CODES.has(code) : false) ||
		error === SCOPE_NOT_ALLOWED_ERROR
	);
}

function getPublicAppOrigin(request: Request) {
	const configured = cleanString(process.env.CYBERSHIELD35_PUBLIC_APP_URL);
	if (configured) return new URL(configured).origin;

	const forwardedHost = firstForwarded(request.headers.get("x-forwarded-host"));
	const forwardedProto = firstForwarded(request.headers.get("x-forwarded-proto"));
	if (forwardedHost) {
		return `${forwardedProto || "https"}://${forwardedHost}`;
	}

	return new URL(request.url).origin;
}

function normalizeMissingApprovalItems(value: unknown): string[] {
	if (!Array.isArray(value)) return [];

	const items = new Set<string>();
	for (const item of value) {
		const normalized = cleanString(item)?.toLowerCase();
		if (!normalized) continue;
		if (["domain", "origin", "scopes", "scope", "workspace"].includes(normalized)) {
			items.add(normalized === "scope" ? "scopes" : normalized);
		}
	}

	return [...items].sort();
}

function approvalReasonFromRemote(
	remoteRecord: Record<string, unknown>,
	error?: string,
) {
	const code = cleanString(remoteRecord.code);
	if (code && APPROVAL_REQUIRED_CODES.has(code)) return error ?? code;
	if (error === SCOPE_NOT_ALLOWED_ERROR) return error;
	return undefined;
}

function setupDisabledReasonForApproval({
	approvalHref,
	blocked,
	missingApprovalItems,
	setupOrigin,
}: {
	approvalHref?: string;
	blocked: boolean;
	missingApprovalItems: string[];
	setupOrigin?: string;
}) {
	if (approvalHref || !blocked || missingApprovalItems.length === 0) {
		return undefined;
	}
	if (!setupOrigin || !isPublicHttpsOrigin(setupOrigin)) {
		return "Cấu hình CYBERSHIELD35_PUBLIC_APP_URL bằng URL HTTPS public rồi thử lại để tạo liên kết duyệt managed scheduler.";
	}
	return undefined;
}

function normalizeUpstreamStatus(value: unknown) {
	const status = Number(value);
	return Number.isInteger(status) && status >= 100 && status <= 599
		? status
		: undefined;
}

function isPublicHttpsOrigin(value: string) {
	try {
		const url = new URL(value);
		if (url.protocol !== "https:") return false;
		const hostname = url.hostname.toLowerCase();
		if (
			hostname === "localhost" ||
			hostname === "0.0.0.0" ||
			hostname === "::1" ||
			hostname.endsWith(".localhost") ||
			hostname.endsWith(".local")
		) {
			return false;
		}
		if (isPrivateIpv4(hostname)) return false;
		return true;
	} catch {
		return false;
	}
}

function isPrivateIpv4(hostname: string) {
	const parts = hostname.split(".");
	if (parts.length !== 4) return false;
	const octets = parts.map((part) => Number(part));
	if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
		return false;
	}

	const first = octets[0] ?? -1;
	const second = octets[1] ?? -1;
	return (
		first === 10 ||
		first === 127 ||
		(first === 172 && second >= 16 && second <= 31) ||
		(first === 192 && second === 168)
	);
}

function generateSchedulerToken() {
	return randomBytes(32).toString("base64url");
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

function sanitizeSetupMetadata(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object") return {};
	const metadata = { ...(value as Record<string, unknown>) };

	for (const key of Object.keys(metadata)) {
		if (/token|secret|authorization/iu.test(key)) delete metadata[key];
	}

	return metadata;
}

function fallbackBody(status: number) {
	return status >= 400
		? { error: "Managed scheduler request failed" }
		: { ok: true };
}

function firstForwarded(value: string | null) {
	return value
		?.split(",")
		.map((part) => part.trim())
		.find(Boolean);
}

function cleanString(value: unknown) {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeNullableNumber(value: unknown) {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}
