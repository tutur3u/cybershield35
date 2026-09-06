import { describe, expect, test } from "bun:test";
import { isConfirmedApifyCost, readApifyCost } from "@/lib/costs/apify-cost";

const now = new Date("2026-09-06T12:00:00Z");
const run = { startedAt: "2026-08-31T23:59:00Z", finishedAt: "2026-09-01T00:00:00Z", status: "SUCCEEDED", usageTotalUsd: 0.126 };
describe("Apify accounting", () => {
  test("preserves historical dates and reported fractional USD", () => {
    const cost = readApifyCost(run, now);
    expect(cost.amountUsd).toBe(0.126);
    expect(cost.occurredAt).toBe("2026-08-31T23:59:00.000Z");
    expect(isConfirmedApifyCost(cost)).toBe(true);
  });
  test("never treats missing or invalid costs as free", () => {
    for (const usageTotalUsd of [undefined, null, "0.1", NaN, Infinity, -1]) {
      const cost = readApifyCost({ ...run, usageTotalUsd }, now);
      expect(cost.amountUsd).toBeNull();
      expect(cost.status).toBe("pending");
    }
    expect(isConfirmedApifyCost(readApifyCost({...run, usageTotalUsd: 0}, now))).toBe(true);
  });
  test("failed and aborted billable runs are included", () => {
    for (const status of ["FAILED", "ABORTED", "TIMED-OUT"]) {
      expect(readApifyCost({...run, status}, now).status).toBe("confirmed");
    }
  });
  test("waits for terminal settlement instead of freezing preliminary charges", () => {
    expect(readApifyCost({...run, status: "RUNNING"}, now).status).toBe("pending");
    expect(readApifyCost({...run, finishedAt: "2026-09-06T11:59:55Z"}, now).status).toBe("pending");
    expect(readApifyCost({...run, finishedAt: null}, now).status).toBe("pending");
  });
  test("rejects untrusted stored costs and malformed dates at the sync boundary", () => {
    for (const cost of [null, {}, { ...readApifyCost(run, now), amountUsd: Infinity },
      { ...readApifyCost(run, now), occurredAt: "invalid" }, { ...readApifyCost(run, now), source: "estimate" }]) {
      expect(isConfirmedApifyCost(cost)).toBe(false);
    }
  });
});
