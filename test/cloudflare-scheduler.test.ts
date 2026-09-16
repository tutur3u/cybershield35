import {expect,test} from 'bun:test';
import {initialSchedule,nextBoundary,recordRun} from '../cloudflare/scheduler-state';

test('scheduler preserves UTC daily and five-minute boundaries',()=>{
 const now=Date.parse('2026-09-16T23:59:59.500Z');
 expect(nextBoundary('daily-scans',now)).toBe(Date.parse('2026-09-17T00:00:00Z'));
 expect(nextBoundary('process-article-publications',now)).toBe(Date.parse('2026-09-17T00:00:00Z'));
 expect(nextBoundary('process-article-publications',Date.parse('2026-09-17T00:00:00Z'))).toBe(Date.parse('2026-09-17T00:05:00Z'));
});
test('bootstrap verifies maintenance promptly without starting daily collection early',()=>{
 const now=Date.parse('2026-09-16T18:03:00Z');
 expect(initialSchedule('process-article-publications',now).nextRunAt).toBe(now+1000);
 expect(initialSchedule('daily-scans',now).nextRunAt).toBe(Date.parse('2026-09-17T00:00:00Z'));
});
test('failed jobs retain the last success and retry indefinitely with bounded backoff',()=>{
 const now=Date.parse('2026-09-16T18:03:00Z');
 let state=recordRun(initialSchedule('process-article-publications',now),now,null);
 for(let failure=1;failure<=12;failure++){
  state=recordRun(state,now,'Job returned HTTP 503');
  expect(state.failures).toBe(failure);
  expect(state.lastSuccessAt).toBe(now);
  expect(state.nextRunAt-now).toBe(Math.min(300000,30000*2**Math.min(failure-1,4)));
 }
 const recovered=recordRun(state,now+123456,null);
 expect(recovered.failures).toBe(0);expect(recovered.lastError).toBeNull();
 expect(recovered.nextRunAt).toBe(nextBoundary(state.jobKey,now+123456));
});
