import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { buildManagedSchedulerApprovalUrl } from "@/lib/auth/scope-approval";
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
const APPROVAL_REQUIRED_CODES = new Set([
	"CRON_APPROVAL_REQUIRED",
	"MANAGED_CRON_APPROVAL_REQUIRED",
	"MANAGED_CRON_DOMAIN_NOT_APPROVED",
	"SCOPE_APPROVAL_REQUIRED",
]);
const SCOPE_NOT_ALLOWED_ERROR = "Requested scope is not allowed for this app";

export const managedSchedulerJobPatchSchema = z
	.object({
		enabled: z.boolean(),
	})
	.strict();

type ManagedSchedulerJobStatus = {
	active: boolean;
	failureCount: number;
	jobKey: string;
	lastRunAt: string | null;
	lastStatus: string | null;
	name: string;
	nextRunAt: string | null;
	schedule: string;
};

type ManagedSchedulerStatus = {
	approvalHref?: string;
	configured: boolean;
	enabled: boolean;
	jobs: ManagedSchedulerJobStatus[];
	tokenLastFour: string | null;
	updatedAt: string | null;
};

export async function getManagedSchedulerStatus(request: Request) {
	try {
		const auth = await getBearerForPlatformRequest(request);
		const response = await fetch(buildManagedSchedulerUrl(""), {
			cache: "no-store",
			headers: { Authorization: auth.authorization },
			method: "GET",
		});
		const body = await response.json().catch(() => null);
		const local = await getLocalIntegration();
		const approvalHref = approvalHrefForResponse({ body, request, response });

		return json(
			normalizeSchedulerStatus({
				approvalHref,
				local,
				remote: body,
			}),
			{
				setCookie: auth.setCookie,
				status: response.ok || approvalHref ? 200 : response.status,
			},
		);
	} catch (error) {
		const safe = sanitizeAuthError(error);
		return json({ error: safe.message }, { status: safe.status });
	}
}

export async function setupManagedScheduler(request: Request) {
	try {
		const auth = await getBearerForPlatformRequest(request);
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
		const body = await response.json().catch(() => null);

		if (!response.ok) {
			const local = await getLocalIntegration();
			return json(
				normalizeSchedulerStatus({
					approvalHref: approvalHrefForResponse({ body, request, response }),
					local,
					remote: body,
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
		const safe = sanitizeAuthError(error);
		return json({ error: safe.message }, { status: safe.status });
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
		const body = await response.json().catch(() => null);

		return json(body ?? fallbackBody(response.status), {
			setCookie: auth.setCookie,
			status: response.status,
		});
	} catch (error) {
		const safe = sanitizeAuthError(error);
		return json({ error: safe.message }, { status: safe.status });
	}
}

export async function verifyManagedSchedulerRequest(request: Request) {
	const token = bearerToken(request);
	if (!token) return false;

	const local = await getLocalIntegration();
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
	local,
	remote,
}: {
	approvalHref?: string;
	local: ManagedSchedulerIntegrationRow | null;
	remote: unknown;
}): ManagedSchedulerStatus {
	const remoteRecord =
		remote && typeof remote === "object" ? (remote as Record<string, unknown>) : {};
	const jobs = Array.isArray(remoteRecord.jobs)
		? remoteRecord.jobs.map(normalizeJob).filter(isSchedulerJobStatus)
		: [];

	return {
		...(approvalHref ? { approvalHref } : {}),
		configured: Boolean(local) && remoteRecord.configured !== false,
		enabled: Boolean(local?.enabled) && remoteRecord.enabled !== false,
		jobs,
		tokenLastFour: local?.tokenLastFour ?? null,
		updatedAt: local?.updatedAt?.toISOString() ?? null,
	};
}

function normalizeJob(value: unknown): ManagedSchedulerJobStatus | null {
	if (!value || typeof value !== "object") return null;
	const row = value as Record<string, unknown>;
	const jobKey = cleanString(row.jobKey ?? row.job_key ?? row.key);
	if (!jobKey) return null;

	return {
		active: row.active !== false,
		failureCount: Number(row.failureCount ?? row.failure_count ?? 0),
		jobKey,
		lastRunAt: cleanString(row.lastRunAt ?? row.last_run_at),
		lastStatus: cleanString(row.lastStatus ?? row.last_status),
		name: cleanString(row.name) ?? jobKey,
		nextRunAt: cleanString(row.nextRunAt ?? row.next_run_at),
		schedule: cleanString(row.schedule) ?? "",
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
	return buildManagedSchedulerApprovalUrl({
		appBaseUrl,
		origin: appBaseUrl,
	});
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
