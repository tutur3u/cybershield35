import { Database } from "bun:sqlite";
import { afterAll, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { D1Database } from "@cloudflare/workers-types";
import { createD1Client } from "../lib/db/d1-client";
import { createD1Sql } from "../lib/db/d1-sql";
import { createD1StagingSchema } from "../lib/db/d1-migration";
import * as schema from "../lib/db/schema.d1";

// Real SQLite SQL and transactions behind the D1 interface. Complemented by
// scripts/verify-d1-runtime.ts against workerd's native D1 implementation.
const sqlite = new Database(":memory:");
sqlite.exec("PRAGMA foreign_keys=ON");
sqlite.exec(createD1StagingSchema());
for (const file of ["0001_revisions.sql", "0002_attachment_search.sql"]) sqlite.exec(readFileSync(`drizzle-d1/${file}`, "utf8"));
class Statement {
 constructor(readonly text: string, readonly params: unknown[] = []) {}
 bind(...params: unknown[]) { if (params.length > 100) throw new Error("D1 parameter limit exceeded"); return new Statement(this.text, params); }
 result() { return {success:true,results:sqlite.query(this.text).all(...this.params as never[]),meta:{}}; }
 async all() { return this.result(); }
 async run() { return this.result(); }
 async raw() { return sqlite.query(this.text).values(...this.params as never[]); }
 async first() { return (await this.all()).results[0] ?? null; }
}
const binding = {
 prepare: (sql: string) => new Statement(sql),
 batch: async (statements: Statement[]) => sqlite.transaction(() => statements.map(statement => statement.result()))(),
} as unknown as D1Database;
const adminDb = createD1Client(binding);
const adminSqlClient = createD1Sql(() => binding);
mock.module("server-only", () => ({}));
mock.module("next/cache", () => ({unstable_cache: <T>(fn: T) => fn, cacheLife() {}, cacheTag() {}, revalidateTag() {}, updateTag() {}, revalidatePath() {}}));
mock.module("../lib/db/client", () => ({adminDb, adminSqlClient}));
afterAll(() => sqlite.close());

const sourceId = crypto.randomUUID(), scanId = crypto.randomUUID(), evidenceId = crypto.randomUUID();
test("native D1 application fixture", async () => {
 await adminDb.insert(schema.sources).values({id:sourceId,type:"text",originalInput:"Kiểm tra dữ liệu"});
 await adminDb.insert(schema.scanJobs).values({id:scanId,sourceId,provider:"local_text",status:"completed"});
 await adminDb.insert(schema.evidenceItems).values({id:evidenceId,scanJobId:scanId,sourceId,provider:"local_text",quote:"Nội dung Tiếng Việt #AnToan",summary:"Thông tin kiểm chứng",author:"@TrangTin",sourceLabel:"Trang tin",riskLevel:"high",metadata:{riskCategories:["misinformation"]},engagement:{likes:2,comments:3}});
 expect((await adminDb.select().from(schema.evidenceItems))).toHaveLength(1);
});
test("rollups rebuild atomically using native SQL", async () => {
 const {refreshIntelligenceRollups} = await import("../lib/dashboard/intelligence-rollups");
 await refreshIntelligenceRollups("d1-test");
 await refreshIntelligenceRollups("d1-test-repeat");
 expect((await adminDb.select().from(schema.intelligenceSourceRollups))[0]?.evidenceCount).toBe(1);
});
test("analytics queries and Vietnamese search execute on SQLite", async () => {
 const {getIntelligenceAnalytics, getIntelligenceEvidenceSample} = await import("../lib/dashboard/intelligence-analytics");
 expect(await getIntelligenceAnalytics()).toBeDefined();
 expect(await getIntelligenceEvidenceSample()).toBeDefined();
 const {listIntelligenceEvidence, listIntelligenceTopics, listIntelligenceClaims, listIntelligenceSources, listIntelligenceActivity} = await import("../lib/dashboard/intelligence-server");
 for(const read of [listIntelligenceEvidence,listIntelligenceTopics,listIntelligenceClaims,listIntelligenceSources,listIntelligenceActivity]) expect(await read({})).toBeDefined();
});
test("billing overview uses SQLite JSON and month buckets", async () => {
 const {getProviderCostOverview} = await import("../lib/costs/server");
 const result = await getProviderCostOverview();
 expect(result.accountStorageReady).toBe(true);
});

test("timeline, operations and pipeline reads use native D1", async () => {
 const {listTimeline, getTimelinePostById, getTimelineHead} = await import("../lib/dashboard/timeline-server");
 expect(await listTimeline({})).toBeDefined();
 expect(await getTimelinePostById(evidenceId)).toBeDefined();
 expect(await getTimelineHead({})).toBeDefined();
 const {getTimelineFacets} = await import("../lib/dashboard/timeline-facets");
 expect(await getTimelineFacets({})).toBeDefined();
 const {getOperationsOverview} = await import("../lib/operations/server");
 expect(await getOperationsOverview()).toBeDefined();
 const {getWorkflowPipeline} = await import("../lib/dashboard/pipeline-server");
 expect(await getWorkflowPipeline()).toBeDefined();
 const {listIntelligenceFacebookPages} = await import("../lib/dashboard/intelligence-facebook-pages");
 expect(await listIntelligenceFacebookPages()).toBeDefined();
});
test("article edits persist versions and delete cascades", async () => {
 const {createArticle, updateArticle, deleteLocalArticle} = await import("../lib/articles/store");
 const actor = {id:crypto.randomUUID(),displayName:"Migration test"};
 const article = await createArticle({title:"Nội dung kiểm chứng",author:"CS35",description:"Bài kiểm tra",blocks:[{id:crypto.randomUUID(),type:"text",content:"Nội dung đủ để kiểm tra"}],commentsEnabled:true,coverUrl:null}, actor);
 expect(article.title).toBe("Nội dung kiểm chứng");
 const updated = await updateArticle(article.id,{title:"Đã cập nhật"},actor);
 expect(updated?.title).toBe("Đã cập nhật");
 expect((await adminDb.select().from(schema.articleVersions))).toHaveLength(2);
 await deleteLocalArticle(article.id,actor);
 expect((await adminDb.select().from(schema.articleVersions))).toHaveLength(0);
});

test("article search executes the parameterized Unicode query",async()=>{
 const {listArticlesPage}=await import("../lib/articles/store");
 expect((await listArticlesPage({limit:10,query:"__no_matching_article__"})).items).toHaveLength(0);
});

test("literal search handles long Vietnamese text and wildcard characters",async()=>{
 const {containsInsensitive}=await import("../lib/db/sqlite-search");
 const text="TIẾNG VIỆT ".repeat(12)+"__%[*]?";
 await adminDb.insert(schema.sources).values({type:"text",originalInput:text});
 expect(await adminDb.select().from(schema.sources).where(containsInsensitive(schema.sources.originalInput,text.toLowerCase()))).toHaveLength(1);
 expect(await adminDb.select().from(schema.sources).where(containsInsensitive(schema.sources.originalInput,"__%[*]?"))).toHaveLength(1);
});
test("duplicate attributed provider runs count once in billing",async()=>{
 const {getProviderCostOverview}=await import("../lib/costs/server");
 for(const amountUsd of [0.1,0.2]) await adminDb.insert(schema.providerRuns).values({scanJobId:scanId,provider:"apify_facebook_posts",status:"completed",output:{runId:"one-billable-run",cost:{status:"confirmed",amountUsd,occurredAt:"2026-09-01T00:00:00Z"}}});
 const result=await getProviderCostOverview();
 expect(result.months[0]?.runs).toBe(1);
 expect(result.months[0]?.confirmed).toBe(1);
});
test("internal scan route rejects missing credentials and stale attempts",async()=>{
 const {POST}=await import("../app/api/internal/scans/stage/route");
 const old=process.env.CS35_INTERNAL_TOKEN;process.env.CS35_INTERNAL_TOKEN="integration-only-secret";
 try {
  expect((await POST(new Request("http://localhost/api/internal/scans/stage",{method:"POST"}))).status).toBe(401);
  const response=await POST(new Request("http://localhost/api/internal/scans/stage",{method:"POST",headers:{authorization:"Bearer integration-only-secret","content-type":"application/json"},body:JSON.stringify({scanId,stage:"collect",attempt:99,startedAtMs:Date.now()})}));
  expect(response.status).toBe(409);
 } finally {if(old===undefined)delete process.env.CS35_INTERNAL_TOKEN;else process.env.CS35_INTERNAL_TOKEN=old;}
});


test("finalized attachments with no processing lock extract text while active claims stay exclusive", async () => {
 const text = "Synthetic attachment verification: CS35-CF-ATTACH-1709";
 let reads = 0;
 mock.module("../lib/chat/tuturuuu-drive", () => ({
  createTuturuuuDriveReadUrl: async () => { reads++; return {signedUrl:`data:text/plain,${encodeURIComponent(text)}`}; },
  deleteTuturuuuDriveObject: async () => ({deleted:true}),
 }));
 const {processChatAttachment} = await import("../lib/chat/attachments");
 const conversationId = crypto.randomUUID();
 await adminDb.insert(schema.chatConversations).values({id:conversationId,ownerUserId:crypto.randomUUID(),ownerDisplayName:"QA",title:"Attachment claim test"});
 const id = crypto.randomUUID(), activeId = crypto.randomUUID();
 for (const [attachmentId, lockedAt] of [[id,null],[activeId,new Date()]] as const) {
  await adminDb.insert(schema.chatAttachments).values({id:attachmentId,conversationId,drivePath:"qa.txt",storageProvider:"r2",fileName:"qa.txt",contentType:"text/plain",sizeBytes:new TextEncoder().encode(text).length,status:"processing",lockedAt});
 }
 await processChatAttachment(id,"test-token");
 await processChatAttachment(activeId,"test-token");
 expect(reads).toBe(1);
 const ready = sqlite.query("SELECT status,locked_at FROM chat_attachments WHERE id=?").get(id) as {status:string,locked_at:null};
 expect(ready).toEqual({status:"ready",locked_at:null});
 expect(sqlite.query("SELECT content FROM chat_attachment_chunks WHERE attachment_id=?").get(id)).toEqual({content:text});
});
