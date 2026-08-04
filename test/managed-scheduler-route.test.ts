import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const originalEnv = { ...process.env };
const scanResults: Array<Record<string, unknown>> = [];
const draftResults: Array<Record<string, unknown>> = [];
const heartbeats: Array<{ serviceName: string; metadata: Record<string, unknown> }> = [];

const enqueueDueTrackedSources = mock(async () => ({
	enqueued: 2,
	recovered: 1,
	scans: [{ scanId: "new-scan", sourceId: "source-1" }],
	skipped: 0,
}));
const reconcileFacebookPageSources = mock(async () => ({ reconciled: 3, total: 3 }));
const processNextJob = mock(async () => scanResults.shift() ?? { processed: false });
const processNextAutomatedDraftJob = mock(async () => draftResults.shift() ?? { processed: false });

mock.module("server-only", () => ({}));
mock.module("@/lib/dashboard/intelligence-server", () => ({ reconcileFacebookPageSources }));
mock.module("@/lib/workers/tracked-sources", () => ({ enqueueDueTrackedSources }));
mock.module("@/lib/workers/scans", () => ({
	heartbeat: async (serviceName: string, metadata: Record<string, unknown>) => {
		heartbeats.push({ serviceName, metadata });
	},
	processNextJob,
}));
mock.module("@/lib/workers/draft-automation", () => ({ processNextAutomatedDraftJob }));
mock.module("@/lib/workers/article-publications", () => ({
	processDueArticlePublications: async () => ({ processed: 0 }),
}));
mock.module("@/lib/db/client", () => ({
	adminDb: { select: () => ({ from: async () => [] }) },
}));

function request(token?: string) {
	return new Request("http://localhost/api/cron/scans/run-daily", {
		headers: token ? { Authorization: `Bearer ${token}` } : undefined,
	});
}

beforeEach(() => {
	process.env = { ...originalEnv, CRON_SECRET: "cron-secret", AUTH_LOCAL_BYPASS: "true", NODE_ENV: "development" };
	scanResults.length = 0;
	draftResults.length = 0;
	heartbeats.length = 0;
	enqueueDueTrackedSources.mockClear();
	reconcileFacebookPageSources.mockClear();
	processNextJob.mockClear();
	processNextAutomatedDraftJob.mockClear();
});

afterEach(() => {
	process.env = { ...originalEnv };
});

describe("daily scan orchestrator", () => {
	test("requires the Vercel Cron secret", async () => {
		const { GET } = await import("@/app/api/cron/scans/run-daily/route");
		expect((await GET(request())).status).toBe(401);
	});

	test("reconciles, enqueues, drains scans and automation, then records one heartbeat", async () => {
		scanResults.push({ processed: true, scanId: "existing-scan" }, { processed: false });
		draftResults.push({ processed: true, draftId: "draft-1" }, { processed: false });
		const { GET } = await import("@/app/api/cron/scans/run-daily/route");
		const response = await GET(request("cron-secret"));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			automatedDraftsProcessed: 1,
			enqueued: 2,
			jobKey: "daily-scans",
			processed: 1,
			reconciliation: { reconciled: 3, total: 3 },
			status: "success",
		});
		expect(reconcileFacebookPageSources).toHaveBeenCalledTimes(1);
		expect(enqueueDueTrackedSources).toHaveBeenCalledTimes(1);
		expect(heartbeats).toHaveLength(1);
		expect(heartbeats[0]?.serviceName).toBe("vercel-cron:daily-scans");
	});
});
