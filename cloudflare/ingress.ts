import {timingSafeEqual} from 'node:crypto';
export const publicHosts = new Set(['cybershield35.ttr.gg','cs35.ttr.gg']);
export function restorePublicRequest(request: Request, secret?: string): Request | null {
 const host=request.headers.get('x-cs35-public-host');
 if(!host)return request;
 const supplied=request.headers.get('x-cs35-gateway-secret')??'';
 if(!secret || !publicHosts.has(host) || Buffer.byteLength(secret)!==Buffer.byteLength(supplied) || !timingSafeEqual(Buffer.from(secret),Buffer.from(supplied)))return null;
 const url=new URL(request.url);url.protocol='https:';url.host=host;
 const headers=new Headers(request.headers);
 headers.delete('x-cs35-gateway-secret');headers.delete('x-cs35-public-host');
 headers.set('host',host);headers.set('x-forwarded-host',host);headers.set('x-forwarded-proto','https');
 return new Request(url,new Request(request,{headers}));
}
