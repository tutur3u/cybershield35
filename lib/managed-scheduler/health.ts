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

export function nextRunForSchedule(schedule: string, from: Date) {
	const next = new Date(from.getTime());
	next.setUTCSeconds(0, 0);

	if (schedule === "*/5 * * * *" || schedule === "*/30 * * * *") {
        const interval = schedule === "*/5 * * * *" ? 5 : 30;
		const minutes = next.getUTCMinutes();
		const remainder = minutes % interval;
		next.setUTCMinutes(minutes + (remainder === 0 ? interval : interval - remainder));
		return next;
	}

	if (schedule === "0 0 * * *") {
		next.setUTCHours(0, 0, 0, 0);
		if (next.getTime() <= from.getTime()) {
			next.setUTCDate(next.getUTCDate() + 1);
		}
		return next;
	}

	next.setUTCMinutes(0, 0, 0);
	next.setUTCHours(next.getUTCHours() + 1);
	return next;
}
