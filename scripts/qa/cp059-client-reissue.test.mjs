/** CP059 frontend behavior when the server refuses to replace a challenge.
 * No cookies, player data, network or UI framework; real CP048 browser flow. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createP0LinkFlow} from '../../lab/ux-p0-010/link-flow.cp048.mjs';
const NOW=1700000000000;
const response=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});

test('CP059 link.start 409 never claims a fresh code nor a cancelled old link',async()=>{
 const flow=createP0LinkFlow({fetcher:async()=>response(409,{status:'unavailable'}),clock:()=>NOW});
 assert.equal(await flow.start(),false);
 const s=flow.getState();assert.equal(s.phase,'error');assert.equal(s.code,null);
 assert.doesNotMatch(s.message,/cancelado no servidor|Sessão confirmada/);
 flow.destroy();
});
test('CP059 retry after 409 can issue a new code after stale cookie was cleared',async()=>{
 let n=0;const flow=createP0LinkFlow({fetcher:async()=>++n===1?
  response(409,{status:'unavailable'}):response(201,{status:'issued',code:'ABCD-EFGH-JKLM',expiresAt:NOW+60000}),clock:()=>NOW});
 assert.equal(await flow.start(),false);assert.equal(flow.getState().phase,'error');
 assert.equal(await flow.start(),true);assert.equal(flow.getState().phase,'issued');
 assert.equal(flow.getState().code,'ABCD-EFGH-JKLM');assert.equal(n,2);
 flow.destroy();
});
test('CP059 429 leaves frontend without invented code or false success',async()=>{
 const flow=createP0LinkFlow({fetcher:async()=>response(429,{status:'rate_limited'}),clock:()=>NOW});
 assert.equal(await flow.start(),true);assert.equal(flow.getState().phase,'rate_limited');
 assert.equal(flow.getState().code,null);flow.destroy();
});
test('CP059 unverified 201 payload must never become a code',async()=>{
 const flow=createP0LinkFlow({fetcher:async()=>response(201,{status:'issued',code:'BAD',expiresAt:NOW+10000}),clock:()=>NOW});
 assert.equal(await flow.start(),false);assert.equal(flow.getState().phase,'error');
 assert.equal(flow.getState().code,null);flow.destroy();
});
