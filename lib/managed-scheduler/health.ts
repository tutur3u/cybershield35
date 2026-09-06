/** Allow scheduling jitter without treating a missed cadence as healthy forever. */
export function cronOverdueWindowMs(schedule: string) {
  if (schedule === "0 0 * * *") return 30 * 60 * 60_000;
  if (schedule === "*/5 * * * *") return 15 * 60_000;
  return 75 * 60_000;
}
