/** Integration of REAL CP014 IdentityLedger source, copied as an unchanged blob to lab/cp014. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {IdentityLedger} from '../../lab/cp014/identity.mjs';
import {createP0NativeReadGateway,createCP014Resolver,createP0NativeLabServer,CP046_COOKIE} from './secure-native-read.cp046.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const REF_A='a'.repeat(64),REF_B='b'.repeat(64);
const now=Date.parse('2026-11-22T23:00:00Z');
const attr={baseValue:1,upgradeValue:0,maxValue:2};
function native(actorId,section){
 if(section==='profile')return {actorId,state:'ready',packet:{playerData:{level:1,health:{value:1,max:2},experience:{value:0,max:2},money:actorId===A?123:777,badges:[],missions:{gems:0,campaignProgression:0},rank:{rank:-1,unranked:true,numberOfPlayers:0,score:0},effect:{healed:false,timeLeft:-1,effect:'none',hasTimeDisplay:false},kingChallengeTier:0}}};
 return {actorId,state:'ready',packet:{foundPlayer:true,data:{weapon:{id:0,itemCategory:0,rarity:0,itemLevel:0,attack:attr,defense:attr,speed:attr},armor:{id:0,itemCategory:1,rarity:0,itemLevel:0,attack:attr,defense:attr,speed:attr},potion:{id:0,itemCategory:2,rarity:0,nature:0,power:0,maxPower:0},object:{id:0,itemCategory:3,rarity:0,nature:0,power:0,maxPower:0},backupWeapons:[],backupArmors:[],backupPotions:[],backupObjects:[],slots:{weapons:1,armors:1,potions:1,objects:1},materials:[]}}};
}
const approve=(ledger,ref,actor)=>{
 const challenge=ledger.issueChallenge(ref),context={channel:'private',verified:true,ref,actor,epoch:1};
 const preview=ledger.prepareApproval(challenge.code,context);
 assert.equal(preview.status,'confirm');
 assert.equal(ledger.confirmApproval(preview.approvalNonce,{...context,confirmed:true}).status,'approved');
 const redeemed=ledger.redeem(challenge.browserSecret);
 assert.equal(redeemed.status,'redeemed');
 return redeemed.sessionToken;
};
function fixture(t){
 const ledger=new IdentityLedger({pepper:randomBytes(32),clock:()=>now});
 const bindings=new Map([[REF_A,{actor:A,epoch:1}],[REF_B,{actor:B,epoch:1}]]);
 for(const [ref,record] of bindings)ledger.observeBinding({ref,...record});
 t.after(()=>ledger.close());
 const authority={async readBinding(ref){return bindings.get(ref)||null}};
 const tokenA=approve(ledger,REF_A,A),tokenB=approve(ledger,REF_B,B);
 const reads=[],readNativeOwn=async ({actorId,section})=>{reads.push({actorId,section});return native(actorId,section)};
 return {ledger,bindings,tokenA,tokenB,reads,readNativeOwn,
   resolveFreshSession:createCP014Resolver({ledger,authority})};
}
const request=(token,section='profile')=>({url:'/v1/me/'+section,method:'GET',headers:{cookie:`${CP046_COOKIE}=${token}`},rawHeaders:['Host','127.0.0.1','Cookie',`${CP046_COOKIE}=${token}`]});
test('CP046 CP014 real SQLite ledger: private confirmation → minted session → two actor reads',async t=>{
 const f=fixture(t),read=createP0NativeReadGateway({...f,clock:()=>now});
 const [a,b,inv]=await Promise.all([read(request(f.tokenA)),read(request(f.tokenB)),read(request(f.tokenA,'inventory'))]);
 assert.equal(a.status,200);assert.equal(a.body.data.money,123);
 assert.equal(b.status,200);assert.equal(b.body.data.money,777);
 assert.equal(inv.status,200);assert.equal(inv.body.data.categories[0].active.id,0);
 assert.equal(f.reads.length,3);
 for(const r of [a,b,inv]){
  assert.equal(JSON.stringify(r.body).includes(REF_A),false);
  assert.equal(JSON.stringify(r.body).includes('session'),false);
 }
});
test('CP046 CP014 original ledger: revoke during read denies stale body',async t=>{
 const f=fixture(t),query=f.readNativeOwn;
 f.readNativeOwn=async o=>{const r=await query(o);f.ledger.revokeSession(f.tokenA);return r};
 const reply=await createP0NativeReadGateway({...f,clock:()=>now})(request(f.tokenA));
 assert.equal(reply.status,401);assert.deepEqual(reply.body,{state:'unavailable'});
});
test('CP046 CP014 original ledger: external epoch update revokes original session',async t=>{
 const f=fixture(t),read=createP0NativeReadGateway({...f,clock:()=>now});
 f.bindings.set(REF_A,{actor:A,epoch:2});
 assert.equal((await read(request(f.tokenA))).status,401);
 assert.equal((await read(request(f.tokenB))).status,200);
});
test('CP046 CP014 original ledger: same-actor new epoch in ledger invalidates old cookie',async t=>{
 const f=fixture(t),read=createP0NativeReadGateway({...f,clock:()=>now});
 f.ledger.observeBinding({ref:REF_A,actor:A,epoch:2});
 f.bindings.set(REF_A,{actor:A,epoch:2});
 assert.equal((await read(request(f.tokenA))).status,401);
});
test('CP046 CP014 original ledger: HTTP loopback privacy and logout revocation',async t=>{
 const f=fixture(t),server=createP0NativeLabServer({...f,clock:()=>now});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const url='http://127.0.0.1:'+server.address().port+'/v1/me/profile';
  const read=token=>fetch(url,{headers:{Cookie:`${CP046_COOKIE}=${token}`}});
  let response=await read(f.tokenA);assert.equal(response.status,200);
  let p=await response.json();assert.equal(p.data.money,123);
  f.ledger.revokeSession(f.tokenA);
  response=await read(f.tokenA);assert.equal(response.status,401);
  response=await read(f.tokenB);assert.equal(response.status,200);
 }finally{await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
});

test('CP046 actual HTTP → CP045 projection → UX-P0 machine, logout 401 purges both',async t=>{
 const f=fixture(t),server=createP0NativeLabServer({...f,clock:()=>now});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const origin='http://127.0.0.1:'+server.address().port;
  const receive=async (path,token)=>{
   const r=await fetch(origin+'/v1/me/'+path,{headers:{Cookie:`${CP046_COOKIE}=${token}`}});
   return {status:r.status,body:await r.json()};
  };
  const {initialState,transition}=await import('../../lab/ux-p0-003/machine.mjs');
  const {startRead,finishRead}=await import('./response-bridge.mjs');
  let ui=transition(initialState(),{type:'AUTH_ESTABLISHED'});
  for(const section of ['profile','inventory']){
   const q=startRead(ui,section,1);
   ui=finishRead(q.state,q.token,await receive(section,f.tokenA));
   assert.equal(ui.sections[section].state,'ready');
  }
  ui=transition(ui,{type:'GO_INVENTORY'});
  ui=transition(ui,{type:'SELECT_ITEM',category:'weapon',slot:0});
  ui=transition(ui,{type:'OPEN_DETAIL'});
  assert.equal(ui.view,'detail');
  ui=transition(ui,{type:'BACK'});
  assert.equal(ui.focusIntent,'item:weapon:0');
  f.ledger.revokeSession(f.tokenA);
  const q=startRead(ui,'inventory',2);
  ui=finishRead(q.state,q.token,await receive('inventory',f.tokenA));
  assert.equal(ui.authorized,false);
  assert.equal(ui.sections.profile.data,null);
  assert.equal(ui.sections.inventory.data,null);
  assert.equal(ui.selected,null);
 }finally{await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
});

test('CP046 original CP014 HTTP challenge → trusted confirmation → cookie → P0 → logout',async t=>{
 const f=fixture(t);
 const {createSessionHandler}=await import('../../lab/cp014/session-gateway.mjs');
 const {createP0NativeHttpHandler}=await import('./secure-native-read.cp046.mjs');
 const {createServer}=await import('node:http');
 const ORIGIN='https://portal.example.test',RATE_SCOPE='c'.repeat(64);
 const link=createSessionHandler({ledger:f.ledger,authority:{readBinding:async ref=>f.bindings.get(ref)||null},
   repo:{readSnapshot:async()=>{throw Error('OLD_P0_READ_SHOULD_NOT_BE_USED')}},
   rateScopeFor:()=>RATE_SCOPE,origin:ORIGIN,clock:()=>now});
 const p0=createP0NativeHttpHandler({...f,clock:()=>now});
 const server=createServer((req,res)=>{
  if(req.url==='/v1/me/profile'||req.url==='/v1/me/inventory')return p0(req,res);
  return link(req,res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const post=(path,cookie)=>fetch(base+path,{method:'POST',headers:{Origin:ORIGIN,...(cookie?{Cookie:cookie}:{})}});
  const started=await post('/v1/link/start');assert.equal(started.status,201);
  const issued=await started.json();assert.equal(issued.status,'issued');
  const linkCookie=started.headers.get('set-cookie')?.split(';')[0];
  assert.ok(linkCookie?.startsWith('__Host-crownicles_link='));
  const privateCtx={channel:'private',verified:true,ref:REF_A,actor:A,epoch:1};
  const approved=f.ledger.prepareApproval(issued.code,privateCtx);assert.equal(approved.status,'confirm');
  assert.equal(f.ledger.confirmApproval(approved.approvalNonce,{...privateCtx,confirmed:true}).status,'approved');
  const redeemed=await post('/v1/link/redeem',linkCookie);assert.equal(redeemed.status,200);
  const sessionCookie=redeemed.headers.get('set-cookie')?.match(/__Host-crownicles_session=[A-Za-z0-9_-]{43}/)?.[0];
  assert.ok(sessionCookie);
  const receive=async section=>fetch(base+'/v1/me/'+section,{headers:{Cookie:sessionCookie}});
  let response=await receive('profile');assert.equal(response.status,200);
  let payload=await response.json();assert.equal(payload.data.money,123);
  response=await receive('inventory');assert.equal(response.status,200);
  payload=await response.json();assert.equal(payload.data.categories[0].active.id,0);
  assert.equal(f.reads.length,2);
  const logout=await post('/v1/session/logout',sessionCookie);assert.equal(logout.status,200);
  response=await receive('profile');assert.equal(response.status,401);
  assert.equal((await response.json()).state,'unavailable');
 }finally{await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
});
