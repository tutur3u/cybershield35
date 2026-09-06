import { expect, test } from "bun:test";
import { cronOverdueWindowMs } from "@/lib/managed-scheduler/health";

test("five-minute cron stays healthy between scheduled runs but detects missed runs", () => {
  expect(5 * 60_000 < cronOverdueWindowMs("*/5 * * * *")).toBe(true);
  expect(20 * 60_000 > cronOverdueWindowMs("*/5 * * * *")).toBe(true);
});

test("daily cron allows the next scheduled run and flags a missed day", () => {
  expect(24 * 60 * 60_000 < cronOverdueWindowMs("0 0 * * *")).toBe(true);
  expect(31 * 60 * 60_000 > cronOverdueWindowMs("0 0 * * *")).toBe(true);
});
