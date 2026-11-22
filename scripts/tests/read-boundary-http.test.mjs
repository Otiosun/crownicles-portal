import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {createPortalReadBoundary as createStrictBoundary} from '../../integration/gateway/read-boundary.mjs';
const createPortalReadBoundary=opts=>createStrictBoundary({...opts,allowUnboundMockSubjects:true});

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
  const controller=new AbortController();
  // A server response close before writableEnded indicates the client left.
  // Do not use IncomingMessage close, which may mean a completed request.
  res.once('close',()=>{if(!res.writableEnded)controller.abort();});
  const result=await handle({method:req.method,url:req.url,headers:req.headers,
   rawHeaders:req.rawHeaders,signal:controller.signal});
  if(res.destroyed)return; // never write after a client disconnect
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

test('HTTP duplicate Authorization fields cannot be laundered through Node header normalization',async()=>{
 await httpHarness(async({base,seen})=>{
  const u=new URL(base);
  const r=await new Promise((resolve,reject)=>{
   const req=http.request({host:'127.0.0.1',port:u.port,path,method:'GET',headers:{Authorization:['Bearer A','Bearer B']}},res=>{
    let body='';res.on('data',part=>body+=part);res.on('end',()=>resolve({status:res.statusCode,body}));
   });req.on('error',reject);req.end();
  });
  assert.equal(r.status,400);assert.deepEqual(JSON.parse(r.body),{state:'unavailable'});assert.equal(seen.length,0);
 });
});

test('real TCP client disconnect propagates abort to the pending snapshot',async()=>{
 let onReadStarted,onReadCancelled;
 const started=new Promise(resolve=>{onReadStarted=resolve;});
 const cancelled=new Promise(resolve=>{onReadCancelled=resolve;});
 const handle=createPortalReadBoundary({
  resolveVerifiedSubject:async()=>A,
  readSnapshot:({signal})=>{
   if(signal.aborted)onReadCancelled();
   else signal.addEventListener('abort',()=>onReadCancelled(),{once:true});
   onReadStarted();
   return new Promise(()=>{});
  }
 });
 const server=http.createServer(async(req,res)=>{
  const controller=new AbortController();
  res.once('close',()=>{if(!res.writableEnded)controller.abort();});
  const response=await handle({method:req.method,url:req.url,headers:req.headers,
   rawHeaders:req.rawHeaders,signal:controller.signal});
  if(!res.destroyed){res.writeHead(response.status,response.headers);res.end(response.body);}
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const port=server.address().port;
 const client=http.request({hostname:'127.0.0.1',port,path,method:'GET',headers:{Authorization:'Bearer opaque'}});
 client.on('error',()=>{});
 try {
  client.end();
  await started;
  client.destroy();
  let timer;try {
   await Promise.race([cancelled,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('NO_DISCONNECT')),700);})]);
  }finally{clearTimeout(timer);}
 } finally {
  client.destroy();
  await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
 }
});
