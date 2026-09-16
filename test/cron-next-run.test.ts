import {expect,test} from 'bun:test';
import {nextRunForSchedule} from '../lib/managed-scheduler/health';
test('publication schedule advances to the next five-minute UTC boundary',()=>{
 expect(nextRunForSchedule('*/5 * * * *',new Date('2026-09-16T16:47:31Z')).toISOString()).toBe('2026-09-16T16:50:00.000Z');
 expect(nextRunForSchedule('*/5 * * * *',new Date('2026-09-16T16:55:00Z')).toISOString()).toBe('2026-09-16T17:00:00.000Z');
 expect(nextRunForSchedule('0 0 * * *',new Date('2026-09-16T16:55:00Z')).toISOString()).toBe('2026-09-17T00:00:00.000Z');
});
