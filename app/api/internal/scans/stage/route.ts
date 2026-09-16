import { timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { adminDb } from "@/lib/db/client";
import { scanJobs } from "@/lib/db/schema";
import { isRetryableCollectionError, operatorMessageFor } from "@/lib/providers/errors";
import { analyzeScan, collectEvidence, completeScan, failScan, recordScanClaimed, scoreEvidenceRisk, syncScanTopics } from "@/lib/workers/scan-stages";

const inputSchema = z.object({
 stage:z.enum(["claim","collect","risk","analyze","topics","complete","fail"]),
 scanId:z.string().uuid(), attempt:z.number().int().positive(), startedAtMs:z.number().nonnegative(),
 collected:z.object({credentialSource:z.string().optional(),evidenceCount:z.number().int().nonnegative(),mode:z.string().optional()}).optional(),
 failure:z.object({message:z.string().max(2000),retryable:z.boolean()}).optional(),
});
export async function POST(request: Request) {
 const secret = process.env.CS35_INTERNAL_TOKEN;
 const provided = request.headers.get("authorization")?.replace(/^Bearer /, "");
 if (!secret || !provided || Buffer.byteLength(secret)!==Buffer.byteLength(provided) || !timingSafeEqual(Buffer.from(secret),Buffer.from(provided))) return Response.json({error:"Unauthorized"},{status:401});
 const parsed = inputSchema.safeParse(await request.json().catch(()=>null));
 if (!parsed.success) return Response.json({error:"Invalid stage payload"},{status:400});
 const input=parsed.data;
 const [job] = await adminDb.select().from(scanJobs).where(and(eq(scanJobs.id,input.scanId),eq(scanJobs.attempts,input.attempt))).limit(1);
 // A delayed step from an old attempt must never overwrite a newer run.
 if(!job) return Response.json({error:"Scan attempt is no longer current"},{status:409});
 if(job.status==="completed" && input.stage==="complete") return Response.json({ok:true});
 if(job.status!=="running") return Response.json({error:"Scan is no longer running"},{status:409});
 try {
  let result: unknown;
  const claimed={id:job.id,attempts:job.attempts,max_attempts:job.maxAttempts,provider:job.provider,source_id:job.sourceId};
  switch(input.stage){
   case "claim": result=await recordScanClaimed(claimed); break;
   case "collect": result=await collectEvidence(claimed); break;
   case "risk": result=await scoreEvidenceRisk(job.id); break;
   case "analyze": result=await analyzeScan(job.id); break;
   case "topics": result=await syncScanTopics(job.id); break;
   case "complete":
    if(!input.collected) return Response.json({error:"Missing collection result"},{status:400});
    result=await completeScan({...input.collected,scanJobId:job.id,startedAtMs:input.startedAtMs}); break;
   case "fail":
    if(!input.failure) return Response.json({error:"Missing failure result"},{status:400});
    result=await failScan({attempts:job.attempts,maxAttempts:job.maxAttempts,error:new Error(input.failure.message),retryable:input.failure.retryable,scanJobId:job.id,startedAtMs:input.startedAtMs}); break;
  }
  return Response.json({result:result??null});
 } catch(error){
  const retryable=input.stage!=="collect" || isRetryableCollectionError(error);
  return Response.json({error:operatorMessageFor(error),retryable},{status:retryable?503:422});
 }
}
