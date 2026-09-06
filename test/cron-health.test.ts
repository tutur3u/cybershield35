import { expect, test } from "bun:test";
import { cronOverdueWindowMs, isHistoricalCronService } from "@/lib/managed-scheduler/health";

test("five-minute cron stays healthy between scheduled runs but detects missed runs", () => {
  expect(5 * 60_000 < cronOverdueWindowMs("*/5 * * * *")).toBe(true);
  expect(20 * 60_000 > cronOverdueWindowMs("*/5 * * * *")).toBe(true);
});

test("daily cron allows the next scheduled run and flags a missed day", () => {
  expect(24 * 60 * 60_000 < cronOverdueWindowMs("0 0 * * *")).toBe(true);
  expect(31 * 60 * 60_000 > cronOverdueWindowMs("0 0 * * *")).toBe(true);
});

test("historical schedulers do not hide current cron outages or recent workers", () => {
  expect(isHistoricalCronService("managed-scheduler:process-queue", 200_000)).toBe(true);
  expect(isHistoricalCronService("cybershield35-worker", 60)).toBe(false);
  expect(isHistoricalCronService("vercel-cron:daily-scans", 200_000)).toBe(false);
  expect(isHistoricalCronService("vercel-cron:process-article-publications", 200_000)).toBe(false);
});
