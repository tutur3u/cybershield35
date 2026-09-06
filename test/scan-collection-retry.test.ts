import { expect, test } from "bun:test";

test("collection retry checkpoints prevent repeat provider calls", () => {
  // Bun module mocks are process-global; keep DB/provider doubles isolated
  // from the scheduler suites that import the same modules.
  const result = Bun.spawnSync(
    [
      process.execPath,
      "test",
      "./test/fixtures/scan-collection-retry.cases.ts",
    ],
    {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  expect(result.exitCode, new TextDecoder().decode(result.stderr)).toBe(0);
});
