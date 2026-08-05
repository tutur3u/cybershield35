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
const reconcileFacebookPageSources = mock(async () => ({
	linked: 0,
	tracked: 0,
}));
const reassessStoredEvidenceRisk = mock(async () => ({ scored: 0, updated: 0 }));
const refreshIntelligenceRollupsBestEffort = mock(async () => undefined);

mock.module("server-only", () => ({}));

mock.module("@/lib/workers/tracked-sources", () => ({
	enqueueDueTrackedSources,
	// The daily job's dependency graph reaches these; stubbing the whole module
	// means every export it might pull in has to exist.
	ensureFacebookPageTracked: mock(async () => ({ sourceId: "source-1" })),
	enqueueTrackedSourceScan: mock(async () => ({ scanId: "scan-manual" })),
	listTrackedSources: mock(async () => []),
}));

mock.module("@/lib/dashboard/intelligence-facebook-pages", () => ({
	facebookUsernameFromEvidence: () => null,
	listIntelligenceFacebookPages: mock(async () => []),
	reconcileFacebookPageSources,
}));

mock.module("@/lib/workers/evidence-risk", () => ({
	reassessStoredEvidenceRisk,
}));

mock.module("@/lib/dashboard/intelligence-rollups", () => ({
	refreshIntelligenceRollupsBestEffort,
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
	reconcileFacebookPageSources.mockClear();
	reassessStoredEvidenceRisk.mockClear();
	refreshIntelligenceRollupsBestEffort.mockClear();
	globalThis.fetch = mock(() => {
		throw new Error("cron pipeline e2e must not call external fetch");
	}) as unknown as typeof fetch;
});

afterEach(() => {
	process.env = { ...originalEnv };
	globalThis.fetch = originalFetch;
});

describe("Vercel Cron scan pipeline e2e", () => {
	test("the daily job enqueues, drains and reports through status and history", async () => {
		const { GET: dailyGET } = await import(
			"@/app/api/cron/scans/run-daily/route"
		);
		const { GET: statusGET } = await import("@/app/api/workspace/cron/route");
		const { GET: executionsGET } = await import(
			"@/app/api/workspace/cron/executions/route"
		);

		const dailyResponse = await dailyGET(
			authorizedCronRequest("/api/cron/scans/run-daily"),
		);
		const dailyBody = (await dailyResponse.json()) as Record<string, unknown>;
		const statusResponse = await statusGET(localRequest("/api/workspace/cron"));
		const statusBody = (await statusResponse.json()) as Record<string, unknown>;
		const executionsResponse = await executionsGET(
			localRequest("/api/workspace/cron/executions?page=1&pageSize=10"),
		);
		const executionsBody =
			(await executionsResponse.json()) as Record<string, unknown>;

		expect(dailyResponse.status).toBe(200);
		// One job now does the whole pass: enqueue what is due, then drain the
		// queue it just filled. The two used to be separate routes, so this asserts
		// they still happen together rather than leaving scans queued until the
		// next tick.
		expect(dailyBody).toMatchObject({
			enqueued: 2,
			jobKey: "daily-scans",
			processed: 2,
			recovered: 1,
			// Deduped: each scan is both enqueued and drained in the same pass, so
			// the raw collection lists it twice.
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
					jobKey: "daily-scans",
					lastStatus: "success",
				}),
			]),
		);
		expect(executionsResponse.status).toBe(200);
		expect(executionsBody.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					jobKey: "daily-scans",
					source: "scheduled",
					status: "success",
				}),
			]),
		);
		expect(enqueueDueTrackedSources).toHaveBeenCalledTimes(1);
		// Two queued scans plus the call that reports the queue is empty.
		expect(processNextJob).toHaveBeenCalledTimes(3);
		expect(processNextAutomatedDraftJob).toHaveBeenCalledTimes(1);
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	test("an unauthorized caller cannot trigger the daily job", async () => {
		const { GET: dailyGET } = await import(
			"@/app/api/cron/scans/run-daily/route"
		);

		const response = await dailyGET(localRequest("/api/cron/scans/run-daily"));

		expect(response.status).toBe(401);
		expect(enqueueDueTrackedSources).not.toHaveBeenCalled();
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
