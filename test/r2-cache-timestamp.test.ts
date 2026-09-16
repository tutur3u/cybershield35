import {expect,test} from "bun:test";
import {withGenerationTime} from "../lib/cache/r2-incremental-cache";

test("a delayed R2 upload keeps the timestamp from before tag invalidation",async()=>{
 let stored: unknown;
 const adapter={
  get:async()=>stored ? {value:stored,lastModified:Date.now()+60_000}:null,
  set:async(_key:string,value:unknown)=>{stored=value;},
  delete:async()=>{stored=undefined;},
 };
 const cache=withGenerationTime(adapter as Parameters<typeof withGenerationTime>[0]);
 expect(await cache.get("missing","fetch")).toBeNull();
 const before=Date.now();
 await cache.set("key",{kind:"FETCH",data:{headers:{},body:"value",url:"https://example.test"},revalidate:30},"fetch");
 const invalidatedAt=Date.now()+1;
 const entry=await cache.get("key","fetch");
 expect(entry!.lastModified).toBeGreaterThanOrEqual(before);
 expect(entry!.lastModified).toBeLessThan(invalidatedAt);
 await cache.delete("key");
 expect(await cache.get("key","fetch")).toBeNull();
});
