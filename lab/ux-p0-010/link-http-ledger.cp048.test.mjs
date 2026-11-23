import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {IdentityLedger} from '../cp014/identity.mjs';
import {createSessionHandler} from '../cp014/session-gateway.mjs';
import {createP0NativeHttpHandler,createCP014Resolver} from '../../integration/p0/secure-native-read.cp046.mjs';
import {createP0LinkFlow} from './link-flow.cp048.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const REF_A='a'.repeat(64),REF_B='b'.repeat(64);
const ORIGIN='https://portal.example.test';
const makeProfile=level=>({playerData:{level,health:{value:2,max:5},experience:{value:1,max:3},money:level,badges:[],missions:{gems:0,campaignProgression:2},rank:{rank:-1,unranked:true,numberOfPlayers:1,score:0},effect:{healed:true,timeLeft:-100,effect:'none',hasTimeDisplay:false},kingChallengeTier:0,privateActorId:'NEVER_COPY'}});
const startRig=async()=>{
 const ledger=new IdentityLedger({pepper:Buffer.alloc(32,0x49)});
 const bindings=new Map([[REF_A,{actor:A,epoch:1}],[REF_B,{actor:B,epoch:1}]]);
 ledger.observeBinding({ref:REF_A,actor:A,epoch:1});ledger.observeBinding({ref:REF_B,actor:B,epoch:1});
 const authority={readBinding:async ref=>bindings.get(ref)??null};
 const session=createSessionHandler({ledger,authority,repo:{},rateScopeFor:async()=>REF_A,origin:ORIGIN});
 const read=createP0NativeHttpHandler({resolveFreshSession:createCP014Resolver({ledger,authority}),readNativeOwn:async({actorId,section,signal})=>{
  if(signal.aborted)throw Error('ABORTED');return {actorId,state:'ready',packet:makeProfile(actorId===A?12:77)};
 }});
 const server=http.createServer((req,res)=>(req.url?.startsWith('/v1/me/')?read:session)(req,res));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const client=(expectedLevel=12)=>{
  let cookies=new Map(),seen=[],httpHeaders=[];
  const fetcher=async(path,opts={})=>{
   seen.push({path,opts});const headers={...(opts.headers||{})};
   if(cookies.size)headers.Cookie=[...cookies].map(([k,v])=>k+'='+v).join('; ');
   if(opts.method==='POST')headers.Origin=ORIGIN;
   const r=await fetch(base+path,{method:opts.method,headers,signal:opts.signal,redirect:'manual'});
   for(const c of r.headers.getSetCookie()){
    httpHeaders.push(c);
    const match=c.match(/^(__Host-crownicles_(?:link|session))=([^;]*)/);
    if(match){if(/;\s*Max-Age=0\b/i.test(c))cookies.delete(match[1]);else cookies.set(match[1],match[2]);}
   }
   return r;
  };
  const ownRead=async()=>{
   const r=await fetcher('/v1/me/profile',{method:'GET',headers:{Accept:'application/json'}});
   if(r.status!==200)return false;const body=await r.json();return body.state==='ready'&&body.data.level===expectedLevel;
  };
  return {fetcher,ownRead,seen,cookies,httpHeaders};
 };
 const close=async()=>{await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));ledger.close()};
 return {ledger,bindings,client,close};
};
const CONTEXT={channel:'private',verified:true,ref:REF_A,actor:A,epoch:1,confirmed:true};
async function approve(ledger,code){const p=ledger.prepareApproval(code,CONTEXT);assert.equal(p.status,'confirm');assert.equal(ledger.confirmApproval(p.approvalNonce,CONTEXT).status,'approved');}

test('CP048 real CP014 SQLite + HTTP private confirmation + CP046 own-profile gate',async()=>{
 const rig=await startRig();try{
  const browser=rig.client();
  const flow=createP0LinkFlow({fetcher:browser.fetcher,onLinked:browser.ownRead});
  assert.equal(await flow.start(),true);assert.match(flow.getState().code,/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal((await browser.fetcher('/v1/me/profile',{method:'GET'})).status,401);
  assert.equal(await flow.check(),true);assert.equal(flow.getState().phase,'pending');
  await approve(rig.ledger,flow.getState().code);
  assert.equal(await flow.check(),true);assert.equal(flow.getState().phase,'approved');
  assert.equal(await flow.redeem(),true);assert.equal(flow.getState().phase,'linked');
  assert.equal(await browser.ownRead(),true);
  assert.ok(browser.httpHeaders.every(v=>/;\s*Secure;\s*HttpOnly;\s*SameSite=Strict/i.test(v)));
  assert.equal(browser.seen.every(x=>x.opts?.credentials==='same-origin'||x.path==='/v1/me/profile'),true);
  assert.equal(browser.seen.every(x=>!x.path.includes('?')&&!('cookie' in (x.opts?.headers||{}))),true);
  assert.equal([...browser.cookies.keys()].includes('__Host-crownicles_session'),true);
  const logout=await browser.fetcher('/v1/session/logout',{method:'POST',headers:{Accept:'application/json'}});
  assert.deepEqual(await logout.json(),{status:'signed_out'});
  assert.equal(await browser.ownRead(),false);
 }finally{await rig.close()}
});

test('CP048 real CP014 ledger: cancelled challenge never redeems',async()=>{
 const rig=await startRig();try{
  const browser=rig.client(),flow=createP0LinkFlow({fetcher:browser.fetcher,onLinked:browser.ownRead});
  await flow.start();const code=flow.getState().code;
  assert.equal(await flow.cancel(),true);assert.equal(flow.getState().code,null);
  const p=rig.ledger.prepareApproval(code,CONTEXT);assert.equal(p.status,'unavailable');
  assert.equal((await browser.fetcher('/v1/me/profile',{method:'GET'})).status,401);
 }finally{await rig.close()}
});

test('CP048 real CP014 ledger: authority rebind after private approval prevents session issue',async()=>{
 const rig=await startRig();try{
  const browser=rig.client(),flow=createP0LinkFlow({fetcher:browser.fetcher,onLinked:browser.ownRead});
  await flow.start();await approve(rig.ledger,flow.getState().code);
  await flow.check();assert.equal(flow.getState().phase,'approved');
  rig.bindings.set(REF_A,{actor:B,epoch:2});rig.ledger.observeBinding({ref:REF_A,actor:B,epoch:2});
  assert.equal(await flow.redeem(),false);assert.equal(flow.getState().phase,'error');
  assert.equal((await browser.fetcher('/v1/me/profile',{method:'GET'})).status,401);
 }finally{await rig.close()}
});


test('CP048 two independent private confirmations never mix own-profile sessions',async()=>{
 const rig=await startRig();try{
  const a=rig.client(12),b=rig.client(77);
  const flowA=createP0LinkFlow({fetcher:a.fetcher,onLinked:a.ownRead});
  const flowB=createP0LinkFlow({fetcher:b.fetcher,onLinked:b.ownRead});
  await flowA.start();await flowB.start();
  const ctxB={channel:'private',verified:true,ref:REF_B,actor:B,epoch:1,confirmed:true};
  const pending=rig.ledger.prepareApproval(flowB.getState().code,ctxB);
  assert.equal(pending.status,'confirm');
  assert.equal(rig.ledger.confirmApproval(pending.approvalNonce,ctxB).status,'approved');
  await approve(rig.ledger,flowA.getState().code);
  await flowA.check();await flowB.check();
  assert.equal(await flowA.redeem(),true);assert.equal(await flowB.redeem(),true);
  assert.equal(await a.ownRead(),true);assert.equal(await b.ownRead(),true);
  const readA=await a.fetcher('/v1/me/profile',{method:'GET'});
  const readB=await b.fetcher('/v1/me/profile',{method:'GET'});
  assert.equal((await readA.json()).data.money,12);
  assert.equal((await readB.json()).data.money,77);
  assert.notEqual(a.cookies.get('__Host-crownicles_session'),b.cookies.get('__Host-crownicles_session'));
 }finally{await rig.close()}
});

test('CP048 CP014 server rejects untrusted browser-only confirmation and replay',async()=>{
 const rig=await startRig();try{
  const browser=rig.client(),flow=createP0LinkFlow({fetcher:browser.fetcher,onLinked:browser.ownRead});
  await flow.start();assert.equal(await flow.redeem(),false);
  assert.equal((await browser.fetcher('/v1/link/redeem',{method:'POST'})).status,401);
  await approve(rig.ledger,flow.getState().code);await flow.check();
  assert.equal(await flow.redeem(),true);
  const replay=await browser.fetcher('/v1/link/redeem',{method:'POST'});
  assert.equal(replay.status,401);
  assert.equal(await browser.ownRead(),true);
 }finally{await rig.close()}
});
