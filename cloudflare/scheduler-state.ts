export const scheduledJobs = {
  'daily-scans': { path: '/api/cron/scans/run-daily', intervalMs: 86_400_000 },
  'process-article-publications': { path: '/api/cron/articles/process-publication-queue', intervalMs: 300_000 },
} as const;
export type ScheduledJobKey = keyof typeof scheduledJobs;
export type SchedulerState = {
  jobKey: ScheduledJobKey;
  nextRunAt: number;
  failures: number;
  lastSuccessAt: number | null;
  lastError: string | null;
};
export function nextBoundary(jobKey: ScheduledJobKey, now: number) {
  const interval = scheduledJobs[jobKey].intervalMs;
  return (Math.floor(now / interval) + 1) * interval;
}
export function initialSchedule(jobKey: ScheduledJobKey, now: number): SchedulerState {
  return { jobKey, nextRunAt: jobKey === 'daily-scans' ? nextBoundary(jobKey, now) : now + 1000, failures: 0, lastSuccessAt: null, lastError: null };
}
export function recordRun(state: SchedulerState, now: number, error: string | null): SchedulerState {
  if (!error) return { ...state, nextRunAt: nextBoundary(state.jobKey, now), failures: 0, lastSuccessAt: now, lastError: null };
  const failures = state.failures + 1;
  return { ...state, failures, lastError: error, nextRunAt: now + Math.min(300_000, 30_000 * 2 ** Math.min(failures - 1, 4)) };
}
