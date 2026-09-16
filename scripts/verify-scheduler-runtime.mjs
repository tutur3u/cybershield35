import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const requireWrangler=createRequire(import.meta.resolve('wrangler'));
const {Miniflare,convertV4MiniflareOptions}=await import(requireWrangler.resolve('miniflare'));
const {build}=await import(requireWrangler.resolve('esbuild'));
const bundle=await build({entryPoints:['cloudflare/scheduler.ts'],bundle:true,write:false,format:'esm',platform:'node',external:['cloudflare:workers','node:crypto'],target:'es2022'});
let calls=0;
const runtime=new Miniflare(convertV4MiniflareOptions({workers:[{name:"scheduler",modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-15',compatibilityFlags:['nodejs_compat'],bindings:{CRON_SECRET:'local-scheduler-test'},durableObjects:{JOBS:{className:'ScheduledJob',useSQLite:true}},serviceBindings:{APP:async(request)=>{
 assert.equal(request.headers.get('authorization'),'Bearer local-scheduler-test');
 assert.equal(new URL(request.url).pathname,'/api/cron/articles/process-publication-queue');
 calls++;
 return new Response('{}',{status:calls===1?503:200});
}}}]}));
const headers={authorization:'Bearer local-scheduler-test'};
async function status(){const r=await runtime.dispatchFetch('http://localhost/status',{headers});assert.equal(r.status,200);return r.json();}
try {
 assert.equal((await runtime.dispatchFetch('http://localhost/start',{method:'POST'})).status,401);
 const start=await runtime.dispatchFetch('http://localhost/start',{method:'POST',headers});assert.equal(start.status,200);
 const first=await start.json();
 const again=await runtime.dispatchFetch('http://localhost/start',{method:'POST',headers});
 assert.deepEqual(await again.json(),first);
 const deadline=Date.now()+45_000;
 let failureObserved=false,recovered=false;
 while(Date.now()<deadline){
  const state=await status();const job=state['process-article-publications'];
  if(job.state.failures===1){failureObserved=true;assert.equal(job.state.lastError,'Job returned HTTP 503');assert.ok(job.alarmAt>Date.now());}
  if(job.state.lastSuccessAt){recovered=true;assert.equal(job.state.failures,0);assert.ok(job.alarmAt>Date.now());assert.equal(state['daily-scans'].state.lastSuccessAt,null);break;}
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 assert.ok(failureObserved,'The real alarm must persist a failed request');
 assert.ok(recovered,'A later automatic alarm must retry successfully');
 assert.equal(calls,2);
 console.log('Scheduler runtime passed: authenticated control, idempotent bootstrap, real alarms, persisted failure, automatic retry and next-run persistence.');
}finally{await runtime.dispose();}
