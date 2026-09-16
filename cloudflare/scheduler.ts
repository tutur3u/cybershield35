import type { DurableObjectNamespace, DurableObjectState, Fetcher } from '@cloudflare/workers-types';
import { DurableObject } from 'cloudflare:workers';
import { timingSafeEqual } from 'node:crypto';
import { initialSchedule, recordRun, scheduledJobs, type ScheduledJobKey, type SchedulerState } from './scheduler-state';

interface SchedulerEnv {
  JOBS: DurableObjectNamespace<ScheduledJob>;
  APP: Fetcher;
  CRON_SECRET: string;
}

// One coordination object per recurring job; timers never depend on page traffic.
export class ScheduledJob extends DurableObject<SchedulerEnv> {
  constructor(ctx: DurableObjectState, env: SchedulerEnv) {
    super(ctx, env);
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS schedule (id INTEGER PRIMARY KEY CHECK (id = 1), state TEXT NOT NULL)');
  }
  private read(): SchedulerState | null {
    const row = this.ctx.storage.sql.exec<{state: string}>('SELECT state FROM schedule WHERE id = 1').toArray()[0];
    return row ? JSON.parse(row.state) as SchedulerState : null;
  }
  private write(state: SchedulerState) {
    this.ctx.storage.sql.exec('INSERT INTO schedule(id,state) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state', JSON.stringify(state));
  }
  async start(jobKey: ScheduledJobKey) {
    const state = this.read() ?? initialSchedule(jobKey, Date.now());
    if (state.jobKey !== jobKey) throw new Error('Scheduler identity mismatch');
    this.write(state);
    // Repeated deployment/bootstrap must preserve a running timer and retry state.
    if (await this.ctx.storage.getAlarm() === null) await this.ctx.storage.setAlarm(state.nextRunAt);
    return this.status();
  }
  async status() {
    return { state: this.read(), alarmAt: await this.ctx.storage.getAlarm() };
  }
  async alarm() {
    const state = this.read();
    if (!state) return;
    if (state.nextRunAt > Date.now()) {
      await this.ctx.storage.setAlarm(state.nextRunAt);
      return;
    }
    // Preserve a future wakeup even if a runtime interruption happens during I/O.
    await this.ctx.storage.setAlarm(Date.now() + 60_000);
    let error: string | null = null;
    try {
      if (!this.env.CRON_SECRET) throw new Error('Missing scheduler credential');
      const response = await this.env.APP.fetch(`https://cs35.internal${scheduledJobs[state.jobKey].path}`, {
        headers: { authorization: `Bearer ${this.env.CRON_SECRET}` },
        // Workers and browser declarations differ; this value is created in workerd.
        signal: AbortSignal.timeout(600_000) as unknown as import("@cloudflare/workers-types").AbortSignal,
      });
      await response.arrayBuffer();
      if (!response.ok) error = `Job returned HTTP ${response.status}`;
    } catch (caught) {
      error = caught instanceof Error ? caught.name : 'Scheduler request failed';
    }
    const next = recordRun(state, Date.now(), error);
    this.write(next);
    await this.ctx.storage.setAlarm(next.nextRunAt);
    console.log(JSON.stringify({ event: 'scheduled_job_alarm', jobKey: state.jobKey, status: error ? 'failed' : 'success', nextRunAt: next.nextRunAt, error }));
  }
}

const schedulerWorker = {
  async fetch(request: Request, env: SchedulerEnv) {
    const supplied = request.headers.get('authorization') ?? '';
    const expected = `Bearer ${env.CRON_SECRET ?? ''}`;
    if (!env.CRON_SECRET || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
      return new Response('Unauthorized', { status: 401 });
    }
    const path = new URL(request.url).pathname;
    const start = request.method === 'POST' && path === '/start';
    if (!start && !(request.method === 'GET' && path === '/status')) return new Response('Not found', { status: 404 });
    const states = await Promise.all((Object.keys(scheduledJobs) as ScheduledJobKey[]).map(async key => {
      const job = env.JOBS.getByName(key);
      return [key, start ? await job.start(key) : await job.status()] as const;
    }));
    return Response.json(Object.fromEntries(states), { headers: { 'cache-control': 'no-store' } });
  },
};

export default schedulerWorker;
