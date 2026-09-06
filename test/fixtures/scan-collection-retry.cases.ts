import { beforeEach, expect, mock, test } from "bun:test";

const reads: unknown[][] = [];
const writes: Array<Record<string, unknown>> = [];
const runProvider = mock(async () => ({
  provider: "apify_facebook_posts" as const,
  mode: "live" as const,
  credentialSource: "server" as const,
  raw: { runId: "paid-run" },
  evidence: [],
}));
const transaction = mock(async (fn: (db: unknown) => Promise<unknown>) =>
  fn(db),
);
const db = {
  select: () => {
    const rows = reads.shift() ?? [];
    const query = {
      from: () => query,
      where: () => query,
      orderBy: () => query,
      limit: async () => rows,
      then: (resolve: (rows: unknown[]) => unknown) =>
        Promise.resolve(rows).then(resolve),
    };
    return query;
  },
  insert: () => ({
    values: () => ({ returning: async () => [{ id: "new-run" }] }),
  }),
  update: () => ({
    set: (value: Record<string, unknown>) => {
      writes.push(value);
      return { where: async () => undefined };
    },
  }),
  transaction,
};
mock.module("server-only", () => ({}));
mock.module("@/lib/db/client", () => ({ adminDb: db }));
mock.module("@/lib/providers", () => ({ runProvider }));
mock.module("@/lib/operations/telemetry", () => ({
  recordScanEvent: async () => undefined,
  logOperation: () => undefined,
}));
mock.module("@/lib/dashboard/intelligence-rollups", () => ({
  refreshIntelligenceRollupsBestEffort: async () => undefined,
}));
mock.module("@/lib/llm/generation", () => ({
  analyzeEvidence: async () => undefined,
}));
mock.module("@/lib/workers/evidence-risk", () => ({
  classifyPersistedEvidenceRisk: async () => undefined,
}));
mock.module("@/lib/workers/topics", () => ({
  syncTopicsForScan: async () => undefined,
}));
const { collectEvidence } = await import("@/lib/workers/scan-stages");
const job = {
  id: "scan",
  source_id: "source",
  provider: "apify_facebook_posts" as const,
  attempts: 2,
  max_attempts: 3,
};
beforeEach(() => {
  reads.length = 0;
  writes.length = 0;
  runProvider.mockClear();
  transaction.mockClear();
});

test("analysis retry reuses older completed collection with persisted evidence", async () => {
  reads.push([{ id: "old-run", output: {} }], [{ id: "evidence" }]);
  expect(await collectEvidence(job)).toMatchObject({ evidenceCount: 1 });
  expect(runProvider).not.toHaveBeenCalled();
});

test("successful empty checkpoint does not repeat a paid empty search", async () => {
  reads.push([{ id: "old-run", output: { collectionPersisted: true } }], []);
  expect(await collectEvidence(job)).toMatchObject({ evidenceCount: 0 });
  expect(runProvider).not.toHaveBeenCalled();
});

test("incomplete legacy collection is not mistaken for saved evidence", async () => {
  reads.push(
    [{ id: "old-run", output: {} }],
    [],
    [{ id: "source", originalInput: "https://example.com" }],
  );
  await collectEvidence(job);
  expect(runProvider).toHaveBeenCalledTimes(1);
  expect(transaction).toHaveBeenCalledTimes(1);
  expect(writes).toContainEqual(
    expect.objectContaining({
      status: "completed",
      output: { runId: "paid-run", collectionPersisted: true },
    }),
  );
});
