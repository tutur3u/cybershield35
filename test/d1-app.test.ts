import {expect,test} from "bun:test";

test("D1 application integration runs with isolated framework mocks", async () => {
 const child=Bun.spawn([process.execPath,"test","./test/d1-app.integration.ts"],{stdout:"pipe",stderr:"pipe"});
 const [status,stdout,stderr]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
 if(status!==0) throw new Error(stdout+stderr);
 expect(status).toBe(0);
},30000);
