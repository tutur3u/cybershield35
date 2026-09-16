const publicHosts=new Set(['cybershield35.ttr.gg','cs35.ttr.gg']);
const gateway = {
 async fetch(request:Request,env:{CS35_GATEWAY_SECRET:string}):Promise<Response>{
  const url=new URL(request.url);
  if(!publicHosts.has(url.hostname)||!env.CS35_GATEWAY_SECRET)return new Response('Forbidden',{status:403});
  const headers=new Headers(request.headers);
  headers.set('x-cs35-public-host',url.hostname);
  headers.set('x-cs35-gateway-secret',env.CS35_GATEWAY_SECRET);
  url.hostname='cs35-production.tuturuuu-e89.workers.dev';
  headers.set('host',url.hostname);
  // Preserve cookies, streaming bodies, redirects and Set-Cookie verbatim.
  return fetch(new Request(url,new Request(request,{headers,redirect:'manual'})));
 }
};

export default gateway;
