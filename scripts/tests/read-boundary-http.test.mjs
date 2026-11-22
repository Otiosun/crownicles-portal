import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {createPortalReadBoundary} from '../../integration/gateway/read-boundary.mjs';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const path='/api/portal/v1/read?sections=pet';
async function httpHarness(run){
 const seen=[];
 const handle=createPortalReadBoundary({
  resolveVerifiedSubject:async({cookie})=>cookie==='session=A'?A:null,
  readSnapshot:async({actor,sections})=>{
   seen.push({actor,sections});
   return {state:'ready',version:1,sections:{pet:{state:'absent',debug:'never_return_this'}}};
  }
 });
 const server=http.createServer(async(req,res)=>{
  const result=await handle(req);
  res.writeHead(result.status,result.headers);res.end(result.body);
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const address=server.address();
 try {return await run({base:'http://127.0.0.1:'+address.port,seen});}
 finally {await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
}

test('HTTP loopback read returns only projected data under resolved session',async()=>{
 await httpHarness(async({base,seen})=>{
  const r=await fetch(base+path,{headers:{cookie:'session=A','X-User-Id':B}});
  assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);
  assert.equal(r.headers.get('access-control-allow-origin'),null);
  const body=await r.text();assert.deepEqual(JSON.parse(body),{state:'ready',version:1,sections:{pet:{state:'absent'}}});
  assert.ok(!body.includes('never_return_this'));assert.ok(!body.includes(B));
  assert.equal(seen.length,1);assert.equal(seen[0].actor,A);
 });
});

test('HTTP loopback denies anonymous, owner-query and write-like methods before DB',async()=>{
 await httpHarness(async({base,seen})=>{
  const anon=await fetch(base+path);assert.equal(anon.status,401);
  const forged=await fetch(base+path+'&actorId='+B,{headers:{cookie:'session=A'}});
  assert.equal(forged.status,400);
  const post=await fetch(base+path,{method:'POST',headers:{cookie:'session=A'},body:'{}'});
  assert.equal(post.status,405);assert.equal(post.headers.get('allow'),'GET');
  assert.equal(seen.length,0);
 });
});

test('HTTP loopback rejects framed GET body without trusting request.body property',async()=>{
 await httpHarness(async({base,seen})=>{
  const u=new URL(base);
  const r=await new Promise((resolve,reject)=>{
   const req=http.request({host:'127.0.0.1',port:u.port,path,method:'GET',headers:{Cookie:'session=A','Content-Length':'2'}},res=>{
    let txt='';res.on('data',x=>txt+=x);res.on('end',()=>resolve({status:res.statusCode,body:txt}));
   });req.on('error',reject);req.end('xx');
  });
  assert.equal(r.status,400);assert.deepEqual(JSON.parse(r.body),{state:'unavailable'});
  assert.equal(seen.length,0);
 });
});
