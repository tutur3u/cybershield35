import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import type { ClaimedScanJob } from "../lib/workers/scan-stages";

type Collection = { credentialSource?: string; evidenceCount: number; mode?: string };
export class ScanPipeline extends WorkflowEntrypoint<CloudflareEnv, ClaimedScanJob> {
 async run(event: WorkflowEvent<ClaimedScanJob>, step: WorkflowStep) {
  const job=event.payload;
  const startedAtMs=event.timestamp.getTime();
  const stage = async <T>(name:string, extra:Record<string,unknown>={}):Promise<T> => {
   if(!this.env.WORKER_SELF_REFERENCE) throw new NonRetryableError("Worker service binding is missing");
   if(!this.env.CS35_INTERNAL_TOKEN) throw new NonRetryableError("Internal workflow credential is missing");
   const response=await this.env.WORKER_SELF_REFERENCE.fetch("https://cs35.internal/api/internal/scans/stage",{
    method:"POST",headers:{authorization:`Bearer ${this.env.CS35_INTERNAL_TOKEN}`,"content-type":"application/json"},
    body:JSON.stringify({stage:name,scanId:job.id,attempt:job.attempts,startedAtMs,...extra}),
   });
   const body=await response.json() as {result:T;error?:string};
   if(!response.ok){
    if(response.status<500) throw new NonRetryableError(body.error??`Stage rejected (${response.status})`);
    throw new Error(body.error??`Stage failed (${response.status})`);
   }
   return body.result;
  };
  const options={retries:{limit:2,delay:"10 seconds" as const,backoff:"exponential" as const},timeout:"15 minutes" as const};
  try {
   await step.do("claim",options,async()=>{await stage("claim");return null;});
   const collected=await step.do("collect",options,()=>stage<Collection>("collect"));
   await step.do("risk",options,async()=>{await stage("risk");return null;});
   await step.do("analyze",options,async()=>{await stage("analyze");return null;});
   await step.do("topics",options,async()=>{await stage("topics");return null;});
   await step.do("complete",options,async()=>{await stage("complete",{collected});return null;});
   return {scanId:job.id,evidenceCount:collected.evidenceCount};
  } catch(error) {
   await step.do("record-failure",options,async()=>{await stage("fail",{failure:{message:(error instanceof Error?error.message:String(error)).slice(0,2000),retryable:!(error instanceof NonRetryableError)}});return null;});
   throw error;
  }
 }
}
