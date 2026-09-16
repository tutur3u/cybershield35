import {expect,test} from 'bun:test';
import {restorePublicRequest} from '../cloudflare/ingress';
test('cross-account ingress preserves canonical host, cookies, query and request body',async()=>{
 const request=new Request('https://cs35-production.tuturuuu-e89.workers.dev/api/example?q=1',{method:'POST',headers:{cookie:'session=example','x-cs35-public-host':'cybershield35.ttr.gg','x-cs35-gateway-secret':'test-secret'},body:'streamed content'});
 const restored=restorePublicRequest(request,'test-secret')!;
 expect(restored.url).toBe('https://cybershield35.ttr.gg/api/example?q=1');
 expect(restored.headers.get('cookie')).toBe('session=example');
 expect(restored.headers.get('x-cs35-gateway-secret')).toBeNull();
 expect(await restored.text()).toBe('streamed content');
});
test('ingress rejects spoofed hosts and credentials while retaining direct Worker requests',()=>{
 for(const [host,secret] of [['cybershield35.ttr.gg','wrong'],['attacker.test','test-secret']])expect(restorePublicRequest(new Request('https://origin.test/',{headers:{'x-cs35-public-host':host!,'x-cs35-gateway-secret':secret!}}),'test-secret')).toBeNull();
 const direct=new Request('https://origin.test/');expect(restorePublicRequest(direct)).toBe(direct);
});
