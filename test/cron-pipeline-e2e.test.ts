import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

type HeartbeatRow = {
	lastSeenAt: Date;
	metadata: Record<string, unknown>;
	serviceName: string;
};

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
const heartbeatRows: HeartbeatRow[] = [];
const queuedScanIds: string[] = [];

const enqueueDueTrackedSources = mock(async () => {
	queuedScanIds.push("scan-from-cron-1", "scan-from-cron-2");
	return {
		enqueued: 2,
		recovered: 1,
		recoveredSources: [
			{
				reason: "stale_active_scan",
				sourceId: "source-1",
				staleScanId: "old-scan-1",
			},
		],
		scans: [
			{ scanId: "scan-from-cron-1", sourceId: "source-1" },
			{ scanId: "scan-from-cron-2", sourceId: "source-2" },
		],
		skipped: 0,
		skippedSources: [],
	};
});

const processNextJob = mock(async () => {
	const scanId = queuedScanIds.shift();
	if (!scanId) return { processed: false };
	return { processed: true, scanId };
});
const processNextAutomatedDraftJob = mock(async () => ({ processed: false as const }));

mock.module("server-only", () => ({}));

mock.module("@/lib/workers/tracked-sources", () => ({
	enqueueDueTrackedSources,
}));

mock.module("@/lib/workers/scans", () => ({
	heartbeat: async (
		serviceName = "worker",
		metadata: Record<string, unknown> = {},
	) => upsertHeartbeat(serviceName, metadata),
	processNextJob,
}));

mock.module("@/lib/workers/draft-automation", () => ({
	processNextAutomatedDraftJob,
}));

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
			from: async () => heartbeatRows,
		}),
	},
}));

beforeEach(() => {
	process.env = {
		...originalEnv,
		AUTH_LOCAL_BYPASS: "true",
		CRON_SECRET: "cron-secret",
		CYBERSHIELD35_APP_ID: "cybershield35",
		CYBERSHIELD35_APP_SECRET: "app-secret",
		CYBERSHIELD35_SESSION_SECRET:
			"test-secret-for-cybershield35-session-cookie",
		NODE_ENV: "development",
	};
	heartbeatRows.length = 0;
	queuedScanIds.length = 0;
	enqueueDueTrackedSources.mockClear();
	processNextJob.mockClear();
	processNextAutomatedDraftJob.mockClear();
	globalThis.fetch = mock(() => {
		throw new Error("cron pipeline e2e must not call external fetch");
	}) as unknown as typeof fetch;
});

afterEach(() => {
	process.env = { ...originalEnv };
	globalThis.fetch = originalFetch;
});

describe("Vercel Cron scan pipeline e2e", () => {
	test("scheduled enqueue, scheduled process, status, and history stay wired together", async () => {
		const { GET: enqueueGET } = await import(
			"@/app/api/cron/scans/enqueue-tracked-sources/route"
		);
		const { GET: processGET } = await import(
			"@/app/api/cron/scans/process-queue/route"
		);
		const { GET: statusGET } = await import("@/app/api/workspace/cron/route");
		const { GET: executionsGET } = await import(
			"@/app/api/workspace/cron/executions/route"
		);

		const enqueueResponse = await enqueueGET(
			authorizedCronRequest("/api/cron/scans/enqueue-tracked-sources"),
		);
		const enqueueBody = (await enqueueResponse.json()) as Record<string, unknown>;
		const processResponse = await processGET(
			authorizedCronRequest("/api/cron/scans/process-queue"),
		);
		const processBody = (await processResponse.json()) as Record<string, unknown>;
		const statusResponse = await statusGET(localRequest("/api/workspace/cron"));
		const statusBody = (await statusResponse.json()) as Record<string, unknown>;
		const executionsResponse = await executionsGET(
			localRequest("/api/workspace/cron/executions?page=1&pageSize=10"),
		);
		const executionsBody =
			(await executionsResponse.json()) as Record<string, unknown>;

		expect(enqueueResponse.status).toBe(200);
		expect(enqueueBody).toMatchObject({
			enqueued: 2,
			jobKey: "enqueue-tracked-sources",
			recovered: 1,
			status: "success",
		});
		expect(processResponse.status).toBe(200);
		expect(processBody).toMatchObject({
			jobKey: "process-queue",
			processed: 2,
			scanIds: ["scan-from-cron-1", "scan-from-cron-2"],
			status: "success",
		});
		expect(statusResponse.status).toBe(200);
		expect(statusBody).toMatchObject({
			configured: true,
			enabled: true,
			schedulerProvider: "vercel-cron",
			setupDisabled: false,
		});
		expect(statusBody.jobs).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					jobKey: "enqueue-tracked-sources",
					lastStatus: "success",
				}),
				expect.objectContaining({
					jobKey: "process-queue",
					lastStatus: "success",
				}),
			]),
		);
		expect(executionsResponse.status).toBe(200);
		expect(executionsBody.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					jobKey: "enqueue-tracked-sources",
					source: "scheduled",
					status: "success",
				}),
				expect.objectContaining({
					jobKey: "process-queue",
					source: "scheduled",
					status: "success",
				}),
			]),
		);
		expect(enqueueDueTrackedSources).toHaveBeenCalledTimes(1);
		expect(processNextJob).toHaveBeenCalledTimes(3);
		expect(processNextAutomatedDraftJob).toHaveBeenCalledTimes(1);
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});
});

function localRequest(path: string, init: RequestInit = {}) {
	return new Request(`http://localhost:3000${path}`, init);
}

function authorizedCronRequest(path: string) {
	return localRequest(path, {
		headers: { Authorization: "Bearer cron-secret" },
		method: "GET",
	});
}

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
