import test from 'node:test';
import assert from 'node:assert/strict';
import {createP0LinkFlow} from './link-flow.cp048.mjs';
const now=Date.parse('2026-11-23T02:00:00.000Z');
const code='ABCD-EFGH-JKLM',expiry=now+300_000;
const reply=(status,data,headers={'content-type':'application/json; charset=utf-8'})=>new Response(JSON.stringify(data),{status,headers});
const issued=()=>reply(201,{status:'issued',code,expiresAt:expiry});
const poll=status=>reply(200,{status,expiresAt:expiry});
const redeemed=()=>reply(200,{status:'redeemed',expiresAt:now+28_800_000});
function rig(overrides={}){
 const calls=[],queue=[],changes=[];
 const fetcher=async(url,opts)=>{calls.push({url,opts});if(!queue.length)throw Error('NO_QUEUED_RESPONSE');const x=queue.shift();return typeof x==='function'?x():x};
 const flow=createP0LinkFlow({fetcher,clock:()=>now,onChange:x=>changes.push(x),onLinked:overrides.onLinked??(async()=>true),timeoutMs:overrides.timeoutMs??100});
 return {flow,calls,queue,changes};
}
test('CP048 full challenge > pending > private confirmation > redeem > independent session check',async()=>{
 const x=rig();x.queue.push(issued(),poll('pending'),poll('awaiting_confirmation'),poll('approved'),redeemed());
 assert.equal(await x.flow.start(),true);assert.equal(x.flow.getState().code,code);
 for(const name of ['pending','awaiting_confirmation','approved']){assert.equal(await x.flow.check(),true);assert.equal(x.flow.getState().phase,name)}
 assert.equal(await x.flow.redeem(),true);assert.equal(x.flow.getState().phase,'linked');assert.equal(x.flow.getState().code,null);
 assert.deepEqual(x.calls.map(z=>[z.url,z.opts.method]),[['/v1/link/start','POST'],['/v1/link/status','GET'],['/v1/link/status','GET'],['/v1/link/status','GET'],['/v1/link/redeem','POST']]);
 for(const {url,opts} of x.calls){assert.equal(opts.credentials,'same-origin');assert.equal(opts.cache,'no-store');assert.equal(opts.redirect,'error');assert.equal(opts.body,undefined);assert.deepEqual(opts.headers,{Accept:'application/json'});assert.ok(!url.includes('?'))}
});
test('CP048 never treats HTTP 200 redeemed as authenticated without follow-up own read',async()=>{
 const x=rig({onLinked:async()=>false});x.queue.push(issued(),poll('approved'),redeemed());
 await x.flow.start();await x.flow.check();assert.equal(await x.flow.redeem(),false);
 assert.equal(x.flow.getState().phase,'error');assert.equal(x.flow.getState().code,null);
});
test('CP048 challenge and status state cannot be forged from arbitrary JSON fields',async()=>{
 for(const wrong of [
  {status:'issued',code:'ABCD-EFGH-JKLM',expiresAt:expiry,actorId:'PRIVATE'},
  {status:'issued',code:'OOOO-OOOO-OOOO',expiresAt:expiry},
  {status:'issued',code,expiresAt:now+1_000_000},
  {status:'issued',code,expiresAt:'tomorrow'},
  {status:'approved',code,expiresAt:expiry}
 ]){const x=rig();x.queue.push(reply(201,wrong));assert.equal(await x.flow.start(),false);assert.equal(x.flow.getState().code,null)}
});
test('CP048 expiring challenge clears code, does not call redeem',async()=>{
 let time=now;const calls=[];const flow=createP0LinkFlow({clock:()=>time,fetcher:async(url)=>{calls.push(url);return issued()}});
 await flow.start();assert.equal(flow.getState().phase,'issued');time=expiry+1;
 assert.equal(await flow.check(),false);assert.equal(flow.getState().phase,'expired');assert.equal(flow.getState().code,null);assert.deepEqual(calls,['/v1/link/start']);
});
test('CP048 status expiry cannot drift, identity fields may not appear',async()=>{
 const x=rig();x.queue.push(issued(),poll('approved'));
 await x.flow.start();assert.equal(await x.flow.check(),true);assert.equal(x.flow.getState().phase,'approved');
 const y=rig();y.queue.push(issued(),reply(200,{status:'approved',expiresAt:expiry+1}));await y.flow.start();assert.equal(await y.flow.check(),false);assert.equal(y.flow.getState().code,null);
 const z=rig();z.queue.push(issued(),reply(200,{status:'approved',expiresAt:expiry,session:'private'}));await z.flow.start();assert.equal(await z.flow.check(),true);assert.equal(z.flow.getState().phase,'expired');
});
test('CP048 cancel revokes challenge and scrubs code before request completes',async()=>{
 const x=rig();x.queue.push(issued(),reply(200,{status:'cancelled'}));
 await x.flow.start();const task=x.flow.cancel();assert.equal(x.flow.getState().code,null);assert.equal(await task,true);
 assert.equal(x.flow.getState().phase,'cancelled');assert.equal(await x.flow.redeem(),false);
});
test('CP048 cancel does not claim server confirmation on network error',async()=>{
 const x=rig();x.queue.push(issued());await x.flow.start();assert.equal(await x.flow.cancel(),false);
 assert.equal(x.flow.getState().phase,'error');assert.equal(x.flow.getState().code,null);
 assert.match(x.flow.getState().message,/não confirmado/);
});
test('CP048 blocks parallel start/redeem requests and wrong phase operations',async()=>{
 const x=rig();x.queue.push(issued());assert.equal(await x.flow.redeem(),false);const task=x.flow.start();assert.equal(await x.flow.start(),false);assert.equal(await task,true);assert.equal(await x.flow.redeem(),false);assert.equal(x.calls.length,1);
});
test('CP048 fails closed for invalid MIME and streaming content exceeding 2 KiB',async()=>{
 for(const response of [reply(201,{status:'issued',code,expiresAt:expiry},{'content-type':'text/html'}),reply(201,{status:'issued',code,expiresAt:expiry,extra:'x'.repeat(3000)})]){
  const x=rig();x.queue.push(response);assert.equal(await x.flow.start(),false);assert.equal(x.flow.getState().code,null)
 }
});
test('CP048 timeout and destroy cannot resurrect private challenge code on late delivery',async()=>{
 const x=rig({timeoutMs:15});let done;const delayed=new Promise(resolve=>done=resolve);
 x.queue.push(()=>delayed);const task=x.flow.start();assert.equal(await task,false);assert.equal(x.flow.getState().code,null);done(issued());await new Promise(resolve=>setTimeout(resolve,2));assert.equal(x.flow.getState().code,null);
 const y=rig();let late;const latePromise=new Promise(resolve=>late=resolve);y.queue.push(()=>latePromise);const pending=y.flow.start();y.flow.destroy();late(issued());await pending;assert.equal(y.flow.getState().code,null);
});
test('CP048 429 clearly stays rate limited; no guessing player or recording token',async()=>{
 const x=rig();x.queue.push(reply(429,{status:'rate_limited'}));assert.equal(await x.flow.start(),true);
 assert.equal(x.flow.getState().phase,'rate_limited');assert.equal(x.flow.getState().code,null);
 assert.equal(JSON.stringify(x.flow.getState()).includes('sessionToken'),false);
});
test('CP048 rate-limited user can retry after external rate window',async()=>{
 const x=rig();x.queue.push(reply(429,{status:'rate_limited'}),issued());
 await x.flow.start();assert.equal(x.flow.getState().phase,'rate_limited');
 assert.equal(await x.flow.start(),true);assert.equal(x.flow.getState().phase,'issued');
});
test('CP048 local reset after logout clears redeemed state and allows new challenge',async()=>{
 const x=rig();x.queue.push(issued(),poll('approved'),redeemed(),issued());
 await x.flow.start();await x.flow.check();await x.flow.redeem();
 assert.equal(x.flow.getState().phase,'linked');x.flow.reset({notify:false});
 assert.equal(x.flow.getState().phase,'idle');assert.equal(await x.flow.start(),true);
});
