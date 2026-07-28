import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

type HeartbeatRow = {
	lastSeenAt: Date;
	metadata: Record<string, unknown>;
	serviceName: string;
};

const heartbeatRows: HeartbeatRow[] = [];
const legacyIntegrationRows: Array<{
	enabled: boolean;
	tokenHash: string;
	tokenLastFour: string;
}> = [];
const processResults: Array<Record<string, unknown>> = [];
let heartbeatFailure: Error | null = null;

const processNextJob = mock(async () => processResults.shift() ?? { processed: false });
const enqueueDueTrackedSources = mock(async () => ({
	enqueued: 1,
	recovered: 0,
	recoveredSources: [],
	scans: [{ scanId: "scan-1", sourceId: "source-1" }],
	skipped: 0,
	skippedSources: [],
}));

mock.module("server-only", () => ({}));

mock.module("@/lib/db/client", () => ({
	adminDb: {
		insert: () => ({
			values: (value: HeartbeatRow) => ({
				onConflictDoUpdate: async () => {
					upsertHeartbeat(value.serviceName, value.metadata, value.lastSeenAt);
				},
			}),
		}),
		select: () => ({
			from: () => {
				const result = Promise.resolve(heartbeatRows) as Promise<HeartbeatRow[]> & {
					where: () => { limit: () => Promise<typeof legacyIntegrationRows> };
				};
				result.where = () => ({
					limit: async () => legacyIntegrationRows,
				});
				return result;
			},
		}),
	},
}));

mock.module("@/lib/workers/scans", () => ({
	heartbeat: async (
		serviceName = "worker",
		metadata: Record<string, unknown> = {},
	) => {
		if (heartbeatFailure) throw heartbeatFailure;
		upsertHeartbeat(serviceName, metadata);
	},
	processNextJob,
}));

mock.module("@/lib/workers/tracked-sources", () => ({
	enqueueDueTrackedSources,
}));

mock.module("@/lib/workers/article-publications", () => ({
	processDueArticlePublications: async () => ({ processed: 0 }),
}));

mock.module("@/lib/workers/draft-automation", () => ({
	processNextAutomatedDraftJob: async () => ({ processed: false }),
}));

function upsertHeartbeat(
	serviceName: string,
	metadata: Record<string, unknown>,
	lastSeenAt = new Date(),
) {
	const existing = heartbeatRows.find((row) => row.serviceName === serviceName);
	if (existing) {
		existing.lastSeenAt = lastSeenAt;
		existing.metadata = metadata;
		return;
	}

	heartbeatRows.push({ lastSeenAt, metadata, serviceName });
}

function localRequest(path: string, init: RequestInit = {}) {
	return new Request(`http://localhost:3000${path}`, init);
}

function authorizedCronRequest(path: string, token = "cron-secret") {
	return localRequest(path, {
		headers: { Authorization: `Bearer ${token}` },
		method: "GET",
	});
}

beforeEach(() => {
	process.env = {
		...originalEnv,
		AUTH_LOCAL_BYPASS: "true",
		CYBERSHIELD35_APP_ID: "cybershield35",
		CYBERSHIELD35_APP_SECRET: "app-secret",
		CYBERSHIELD35_SESSION_SECRET:
			"test-secret-for-cybershield35-session-cookie",
		NODE_ENV: "development",
	};
	delete process.env.CRON_SECRET;
	heartbeatRows.length = 0;
	legacyIntegrationRows.length = 0;
	processResults.length = 0;
	heartbeatFailure = null;
	processNextJob.mockClear();
	enqueueDueTrackedSources.mockClear();
	globalThis.fetch = mock(() => {
		throw new Error("managed scheduler route tests must not call fetch");
	}) as unknown as typeof fetch;
});

afterEach(() => {
	process.env = { ...originalEnv };
	globalThis.fetch = originalFetch;
});

describe("managed scheduler Vercel Cron routes", () => {
	test("returns local Vercel Cron status without calling Tuturuuu", async () => {
		upsertHeartbeat(
			"vercel-cron:process-queue",
			{
				jobKey: "process-queue",
				lastExecution: {
					durationMs: 123,
					id: "process-queue:2026-07-03T00:00:00.000Z",
					jobKey: "process-queue",
					jobName: "Managed scheduler process queue",
					source: "scheduled",
					startedAt: "2026-07-03T00:00:00.000Z",
					status: "success",
				},
				provider: "vercel-cron",
			},
			new Date("2026-07-03T00:00:00.000Z"),
		);

		const { GET } = await import("@/app/api/workspace/cron/route");
		const response = await GET(localRequest("/api/workspace/cron"));
		const body = (await response.json()) as Record<string, unknown>;
		const jobs = body.jobs as Array<Record<string, unknown>>;

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			code: "VERCEL_CRON_SECRET_MISSING",
			configured: true,
			enabled: false,
			localStorageReady: true,
			remoteConfigured: true,
			remoteStatusAvailable: true,
			schedulerProvider: "vercel-cron",
			setupDisabled: true,
		});
		expect(jobs).toHaveLength(3);
		expect(jobs[0]).toMatchObject({
			jobKey: "process-queue",
			lockedByDeployment: true,
			schedule: "*/30 * * * *",
			scheduleTimezone: "UTC",
		});
		expect(jobs[1]).toMatchObject({
			jobKey: "enqueue-tracked-sources",
			lockedByDeployment: true,
			schedule: "0 0 * * *",
			scheduleTimezone: "UTC",
		});
		expect(jobs[2]).toMatchObject({
			jobKey: "process-article-publications",
			lockedByDeployment: true,
			schedule: "*/5 * * * *",
			scheduleTimezone: "UTC",
		});
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	test("setup returns the same Vercel Cron status because schedules are deployment-managed", async () => {
		process.env.CRON_SECRET = "cron-secret";

		const { POST } = await import("@/app/api/workspace/cron/setup/route");
		const response = await POST(
			localRequest("/api/workspace/cron/setup", { method: "POST" }),
		);
		const body = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			configured: true,
			enabled: true,
			schedulerProvider: "vercel-cron",
			setupDisabled: false,
		});
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	test("requires CRON_SECRET bearer auth for scheduled Vercel cron invocations", async () => {
		process.env.CRON_SECRET = "cron-secret";

		const { GET } = await import("@/app/api/cron/scans/process-queue/route");
		const denied = await GET(localRequest("/api/cron/scans/process-queue"));
		processResults.push({ processed: true, scanId: "scan-1" });
		processResults.push({ processed: false });
		const allowed = await GET(
			authorizedCronRequest("/api/cron/scans/process-queue"),
		);
		const body = (await allowed.json()) as Record<string, unknown>;

		expect(denied.status).toBe(401);
		expect(allowed.status).toBe(200);
		expect(body).toMatchObject({
			jobKey: "process-queue",
			processed: 1,
			provider: "vercel-cron",
			status: "success",
		});
		expect(processNextJob).toHaveBeenCalledTimes(2);
		expect(
			heartbeatRows.find((row) => row.serviceName === "vercel-cron:process-queue"),
		).toBeDefined();
	});

	test("runs enqueue tracked sources from Vercel cron and records safe execution metadata", async () => {
		process.env.CRON_SECRET = "cron-secret";

		const { GET } = await import(
			"@/app/api/cron/scans/enqueue-tracked-sources/route"
		);
		const response = await GET(
			authorizedCronRequest("/api/cron/scans/enqueue-tracked-sources"),
		);
		const body = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			enqueued: 1,
			jobKey: "enqueue-tracked-sources",
			provider: "vercel-cron",
			recovered: 0,
			status: "success",
		});
		expect(enqueueDueTrackedSources).toHaveBeenCalledTimes(1);
		expect(JSON.stringify(heartbeatRows)).toContain("enqueue-tracked-sources");
	});

	test("reports stale tracked-source recovery metadata from enqueue cron", async () => {
		process.env.CRON_SECRET = "cron-secret";
		enqueueDueTrackedSources.mockImplementationOnce(async () => ({
			enqueued: 1,
			recovered: 1,
			recoveredSources: [
				{
					reason: "stale_active_scan",
					sourceId: "source-1",
					staleScanId: "old-scan",
				},
			],
			scans: [{ scanId: "scan-2", sourceId: "source-1" }],
			skipped: 0,
			skippedSources: [],
		}));

		const { GET } = await import(
			"@/app/api/cron/scans/enqueue-tracked-sources/route"
		);
		const response = await GET(
			authorizedCronRequest("/api/cron/scans/enqueue-tracked-sources"),
		);
		const body = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			enqueued: 1,
			jobKey: "enqueue-tracked-sources",
			provider: "vercel-cron",
			recovered: 1,
			status: "success",
		});
		expect(String((body.execution as Record<string, unknown>).response)).not.toContain(
			"old-scan",
		);
	});

	test("allows manual process and queue run-now through the admin route", async () => {
		processResults.push({ processed: true, scanId: "scan-1" });
		processResults.push({ processed: false });

		const { POST } = await import(
			"@/app/api/workspace/cron/jobs/[jobKey]/run-now/route"
		);
		const processResponse = await POST(
			localRequest("/api/workspace/cron/jobs/process-queue/run-now", {
				method: "POST",
			}),
			{ params: Promise.resolve({ jobKey: "process-queue" }) },
		);
		const processBody = (await processResponse.json()) as Record<string, unknown>;
		const queueResponse = await POST(
			localRequest(
				"/api/workspace/cron/jobs/enqueue-tracked-sources/run-now",
				{ method: "POST" },
			),
			{ params: Promise.resolve({ jobKey: "enqueue-tracked-sources" }) },
		);
		const queueBody = (await queueResponse.json()) as Record<string, unknown>;

		expect(processResponse.status).toBe(200);
		expect(processBody).toMatchObject({
			jobKey: "process-queue",
			processed: 1,
			provider: "vercel-cron",
			status: "success",
		});
		expect(processBody.execution).toMatchObject({
			jobKey: "process-queue",
			source: "manual",
			status: "success",
		});
		expect(queueResponse.status).toBe(200);
		expect(queueBody).toMatchObject({
			enqueued: 1,
			jobKey: "enqueue-tracked-sources",
			provider: "vercel-cron",
			status: "success",
		});
		expect(queueBody.execution).toMatchObject({
			jobKey: "enqueue-tracked-sources",
			source: "manual",
			status: "success",
		});
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	test("process queue drains at most the configured batch size", async () => {
		process.env.CRON_SECRET = "cron-secret";
		processResults.push({ processed: true, scanId: "scan-1" });
		processResults.push({ processed: true, scanId: "scan-2" });
		processResults.push({ processed: true, scanId: "scan-3" });
		processResults.push({ processed: true, scanId: "scan-4" });

		const { GET } = await import("@/app/api/cron/scans/process-queue/route");
		const response = await GET(
			authorizedCronRequest("/api/cron/scans/process-queue"),
		);
		const body = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			failed: 0,
			processed: 3,
			scanIds: ["scan-1", "scan-2", "scan-3"],
		});
		expect(processNextJob).toHaveBeenCalledTimes(3);
	});

	test("sanitizes database connect timeouts from cron work failures", async () => {
		process.env.CRON_SECRET = "cron-secret";
		processNextJob.mockImplementationOnce(async () => {
			throw new Error("write CONNECT_TIMEOUT undefined:undefined");
		});

		const { GET } = await import("@/app/api/cron/scans/process-queue/route");
		const response = await GET(
			authorizedCronRequest("/api/cron/scans/process-queue"),
		);
		const body = (await response.json()) as Record<string, unknown>;
		const serialized = JSON.stringify(body);

		expect(response.status).toBe(500);
		expect(body).toMatchObject({
			error:
				"Cron job failed because the database connection is unavailable or timed out.",
			jobKey: "process-queue",
			provider: "vercel-cron",
			status: "failed",
		});
		expect(serialized).not.toContain("CONNECT_TIMEOUT undefined");
		expect(serialized).not.toContain("Failed query");
		expect(serialized).not.toContain("insert into");
	});

	test("returns sanitized failure when cron heartbeat cannot be recorded", async () => {
		process.env.CRON_SECRET = "cron-secret";
		heartbeatFailure = new Error(
			'Failed query: insert into "cron_heartbeats" values (...) write CONNECT_TIMEOUT undefined:undefined',
		);

		const { GET } = await import("@/app/api/cron/scans/process-queue/route");
		const response = await GET(
			authorizedCronRequest("/api/cron/scans/process-queue"),
		);
		const body = (await response.json()) as Record<string, unknown>;
		const serialized = JSON.stringify(body);

		expect(response.status).toBe(500);
		expect(body).toMatchObject({
			heartbeatError:
				"Cron job failed because the database connection is unavailable or timed out.",
			jobKey: "process-queue",
			provider: "vercel-cron",
			status: "failed",
		});
		expect(serialized).not.toContain("CONNECT_TIMEOUT undefined");
		expect(serialized).not.toContain("Failed query");
		expect(serialized).not.toContain("insert into");
		expect(heartbeatRows).toHaveLength(0);
	});

	test("rejects schedule edits because Vercel Cron schedules live in vercel.json", async () => {
		const { PATCH } = await import(
			"@/app/api/workspace/cron/jobs/[jobKey]/route"
		);
		const response = await PATCH(
			localRequest("/api/workspace/cron/jobs/process-queue", {
				body: JSON.stringify({
					schedule: "0 9 * * *",
					scheduleTimezone: "Asia/Ho_Chi_Minh",
				}),
				method: "PATCH",
			}),
			{ params: Promise.resolve({ jobKey: "process-queue" }) },
		);
		const body = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(409);
		expect(body).toMatchObject({
			code: "VERCEL_CRON_DEPLOYMENT_MANAGED",
		});
		expect(String(body.error)).toContain("vercel.json");
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	test("returns heartbeat-backed execution history", async () => {
		upsertHeartbeat(
			"vercel-cron:process-queue",
			{
				lastExecution: {
					durationMs: 456,
					id: "execution-1",
					jobKey: "process-queue",
					jobName: "Managed scheduler process queue",
					source: "manual",
					startedAt: "2026-07-03T02:00:00.000Z",
					status: "success",
				},
				provider: "vercel-cron",
			},
			new Date("2026-07-03T02:00:00.000Z"),
		);

		const { GET } = await import(
			"@/app/api/workspace/cron/jobs/[jobKey]/executions/route"
		);
		const response = await GET(
			localRequest(
				"/api/workspace/cron/jobs/process-queue/executions?page=1&pageSize=25",
			),
			{ params: Promise.resolve({ jobKey: "process-queue" }) },
		);
		const body = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			page: 1,
			pageSize: 25,
			total: 1,
		});
		expect(body.items).toEqual([
			expect.objectContaining({
				durationMs: 456,
				id: "execution-1",
				jobKey: "process-queue",
				source: "manual",
				status: "success",
			}),
		]);
	});
});
