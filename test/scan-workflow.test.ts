import {describe,expect,test} from "bun:test";
import {readFileSync} from "node:fs";
const read=(file:string)=>readFileSync(file,"utf8");
describe("Cloudflare scan durability",()=>{
 const workflow=read("workflows/scan-pipeline.ts"),scans=read("lib/workers/scans.ts"),route=read("app/api/internal/scans/stage/route.ts");
 test("all pipeline stages have durable checkpoints",()=>{
  expect(workflow).toContain("extends WorkflowEntrypoint");
  for(const stage of ["claim","collect","risk","analyze","topics","complete","record-failure"]) expect(workflow).toContain(`step.do("${stage}"`);
  expect(JSON.parse(read("wrangler.jsonc")).workflows[0].class_name).toBe("ScanPipeline");
 });
 test("each step authenticates and rejects stale scan attempts",()=>{
  expect(route).toContain("timingSafeEqual");
  expect(route).toContain("eq(scanJobs.attempts,input.attempt)");
  expect(route).toContain('job.status!=="running"');
  expect(workflow).toContain("scanId:job.id,attempt:job.attempts");
 });
 test("terminal collection failures stop retries",()=>{
  expect(route).toContain('input.stage!=="collect" || isRetryableCollectionError(error)');
  expect(workflow).toContain("throw new NonRetryableError");
  expect(workflow).toContain("retryable:!(error instanceof NonRetryableError)");
 });
 test("uncertain creation resolves the deterministic instance without duplicate inline collection",()=>{
  expect(scans).toContain('`scan-${claimed.id}-${claimed.attempts}`');
  expect(scans).toContain("await (await binding.get(id)).status()");
  expect(scans).not.toContain("processClaimedJobInline");
 });
 test("queue capacity and stale-lock recovery remain enabled",()=>{
  expect(scans).toContain("export const MAX_CONCURRENT_SCAN_RUNS");
  expect(scans).toContain("export async function reclaimStalledScans()");
  const scheduler=read("lib/managed-scheduler/server.ts");
  expect(scheduler).toContain("await scanCapacityRemaining()");
  expect(scheduler).toContain("const scans = await drainScanQueue();");
 });
});
