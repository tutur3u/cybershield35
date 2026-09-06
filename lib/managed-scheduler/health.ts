/** Allow scheduling jitter without treating a missed cadence as healthy forever. */
export function cronOverdueWindowMs(schedule: string) {
  if (schedule === "0 0 * * *") return 30 * 60 * 60_000;
  if (schedule === "*/5 * * * *") return 15 * 60_000;
  return 75 * 60_000;
}

const LEGACY_SERVICES = new Set([
  "cybershield35-worker",
  "managed-scheduler:enqueue-tracked-sources",
  "managed-scheduler:process-queue",
  "vercel-cron:enqueue-tracked-sources",
  "vercel-cron:process-queue",
]);

/** Recent legacy workers remain visible as healthy while explicitly running. */
export function isHistoricalCronService(serviceName: string, ageSeconds: number) {
  return LEGACY_SERVICES.has(serviceName) && ageSeconds > 30 * 60 * 60;
}
