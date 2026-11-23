import test from 'node:test';
import assert from 'node:assert/strict';
import {createP0NativeReadGateway,createP0NativeLabServer,createCP014Resolver,CP046_COOKIE} from './secure-native-read.cp046.mjs';
import {initialState,transition} from '../../lab/ux-p0-003/machine.mjs';
import {startRead,finishRead} from './response-bridge.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const REF_A='a'.repeat(64),REF_B='b'.repeat(64);
const TOK_A='A'.repeat(43),TOK_B='B'.repeat(43),INVALID='X'.repeat(43);
const now=Date.parse('2026-11-22T23:00:00Z');
const attr=()=>({baseValue:2,upgradeValue:0,maxValue:10});
const main=(category,id=0)=>({id,rarity:1,itemCategory:category,itemLevel:0,attack:attr(),defense:attr(),speed:attr(),internal:'dont-copy'});
const support=(category,id=0)=>({id,rarity:1,itemCategory:category,nature:1,power:1,maxPower:3,internal:'dont-copy'});
const inventory=(money=0)=>({foundPlayer:true,keycloakId:'PRIVATE_ACTOR',data:{weapon:main(0,0),armor:main(1),potion:support(2),object:support(3),backupWeapons:[{slot:1,display:main(0,money===0?7:9)}],backupArmors:[],backupPotions:[],backupObjects:[],slots:{weapons:2,armors:1,potions:1,objects:1},materials:[],plants:{seed:1,maxPlantSlots:3,plantSlots:[{slot:0,plantId:10}],linkedToHomeStorage:false}}});
const profile=money=>({keycloakId:'PRIVATE_ACTOR',playerData:{level:1,health:{value:2,max:10},experience:{value:1,max:10},money,badges:[],missions:{gems:0,campaignProgression:1},rank:{rank:-1,unranked:true,numberOfPlayers:0,score:0},effect:{healed:false,timeLeft:-1,effect:'none',hasTimeDisplay:false},kingChallengeTier:0,phone:'DONOTLEAK'}});
const proof=(actorId,ref=REF_A)=>({actorId,bindingRef:ref,bindingEpoch:1,expiresAt:now+600_000});
const raw=(cookie=()=>`${CP046_COOKIE}=${TOK_A}`)=>{let c=cookie();return {url:'/v1/me/profile',method:'GET',headers:{cookie:c},rawHeaders:['Host','127.0.0.1','Cookie',c]}};
function rig(){
 const users=new Map([[TOK_A,proof(A)],[TOK_B,proof(B,REF_B)]]),reads=[];
 const sessions=[];
 const resolveFreshSession=async ({token,phase,signal})=>{sessions.push([token,phase]);if(signal.aborted)return null;return users.get(token)??null};
 const readNativeOwn=async({actorId,section,signal})=>{reads.push([actorId,section]);if(signal.aborted)throw Error('abort');return {actorId,state:'ready',packet:section==='profile'?profile(actorId===A?123:777):inventory(actorId===A?0:1)};};
 return {users,reads,sessions,resolveFreshSession,readNativeOwn};
}
const make=(o=rig())=>createP0NativeReadGateway({...o,clock:()=>now});
const cookie=(token)=>`${CP046_COOKIE}=${token}`;
const req=(path,token=TOK_A)=>({url:path,method:'GET',headers:{cookie:cookie(token)},rawHeaders:['Host','127.0.0.1','Cookie',cookie(token)]});

test('CP046 200 profile data projected, no identity, with CP041 bridge accepted',async()=>{
 const rigged=rig(), read=make(rigged);const reply=await read(req('/v1/me/profile'));
 assert.equal(reply.status,200);assert.equal(reply.body.state,'ready');assert.equal(reply.body.data.money,123);
 assert.equal(reply.body.asOf,new Date(now).toISOString());
 assert.equal(JSON.stringify(reply.body).includes('PRIVATE'),false);
 assert.deepEqual(rigged.sessions.map(x=>x[1]),['before-read','after-read']);
 assert.deepEqual(rigged.reads,[[A,'profile']]);
 let state=transition(initialState(),{type:'AUTH_ESTABLISHED'});
 const started=startRead(state,'profile',1);
 state=finishRead(started.state,started.token,reply);
 assert.equal(state.sections.profile.state,'ready');assert.equal(state.sections.profile.data.money,123);
});
test('CP046 projected inventory, active id0, selection and back preserved',async()=>{
 const reply=await make()(req('/v1/me/inventory'));
 assert.equal(reply.status,200);assert.equal(reply.body.data.categories[0].active.id,0);
 let state=transition(initialState(),{type:'AUTH_ESTABLISHED'});
 const start=startRead(state,'inventory',1);state=finishRead(start.state,start.token,reply);
 state=transition(state,{type:'GO_INVENTORY'});
 state=transition(state,{type:'SELECT_ITEM',category:'weapon',slot:0});
 state=transition(state,{type:'OPEN_DETAIL'});
 assert.equal(state.view,'detail');state=transition(state,{type:'BACK'});
 assert.equal(state.focusIntent,'item:weapon:0');
});
test('CP046 no token: 401, reader and resolver never called',async()=>{
 const r=rig(),out=await make(r)({...req('/v1/me/profile'),headers:{},rawHeaders:['Host','127.0.0.1']});
 assert.equal(out.status,401);assert.equal(r.reads.length,0);assert.equal(r.sessions.length,0);
});
test('CP046 unknown session: 401 without reader work',async()=>{const r=rig(),out=await make(r)(req('/v1/me/profile',INVALID));assert.equal(out.status,401);assert.equal(r.reads.length,0)});
test('CP046 per actor and section isolation for concurrent reads',async()=>{
 const r=rig(),read=make(r);
 const replies=await Promise.all(Array.from({length:30},(_,i)=>read(req(i%3===0?'/v1/me/inventory':'/v1/me/profile',i%2?TOK_B:TOK_A))));
 assert.equal(replies.every(x=>x.status===200),true);
 for(let i=0;i<30;i++){
  if(i%3!==0)assert.equal(replies[i].body.data.money,i%2?777:123);
  else assert.equal(replies[i].body.data.categories[0].reserves[0].display.id,i%2?9:7);
  assert.equal(JSON.stringify(replies[i].body).includes('PRIVATE'),false);
 }
});
test('CP046 session revoked during read returns 401 and drops body',async()=>{
 const r=rig(),reader=r.readNativeOwn;
 r.readNativeOwn=async o=>{const v=await reader(o);r.users.delete(TOK_A);return v};
 const out=await make(r)(req('/v1/me/profile'));
 assert.deepEqual(out.body,{state:'unavailable'});assert.equal(out.status,401);
});
test('CP046 same actor but rebind epoch change fails closed after read',async()=>{
 const r=rig(),reader=r.readNativeOwn;
 r.readNativeOwn=async o=>{const v=await reader(o);r.users.set(TOK_A,{...proof(A),bindingEpoch:2});return v};
 const out=await make(r)(req('/v1/me/profile'));assert.equal(out.status,401);
});
test('CP046 same actor but rotated binding reference fails closed',async()=>{
 const r=rig(),reader=r.readNativeOwn;
 r.readNativeOwn=async o=>{const v=await reader(o);r.users.set(TOK_A,proof(A,REF_B));return v};
 const out=await make(r)(req('/v1/me/profile'));assert.equal(out.status,401);
});
test('CP046 actor switch after read is denied',async()=>{
 const r=rig(),reader=r.readNativeOwn;
 r.readNativeOwn=async o=>{const v=await reader(o);r.users.set(TOK_A,proof(B,REF_B));return v};
 const out=await make(r)(req('/v1/me/profile'));assert.equal(out.status,401);
});
test('CP046 stale expiry, nil UUID and unbound UUID are rejected',async()=>{
 const r=rig(),read=make(r);
 for(const x of [undefined, A,{actorId:A}, {...proof(A),expiresAt:now},{...proof(A),actorId:'00000000-0000-0000-0000-000000000000'}]){
  r.users.set(TOK_A,x);
  const out=await read(req('/v1/me/profile'));
  assert.equal(out.status,401);
 }
 assert.equal(r.reads.length,0);
});
test('CP046 mismatched native actor is never sent',async()=>{
 const r=rig();r.readNativeOwn=async()=>({actorId:B,state:'ready',packet:profile(777)});
 const out=await make(r)(req('/v1/me/profile'));assert.equal(out.status,503);assert.equal(JSON.stringify(out.body).includes('777'),false);
});
test('CP046 malformed packet and extra plant ID are unavailable without details',async()=>{
 const r=rig();r.readNativeOwn=async({actorId})=>{const p=inventory();p.data.plants.seed=999;return {actorId,state:'ready',packet:p}};
 const out=await make(r)(req('/v1/me/inventory'));
 assert.deepEqual(out,{status:503,headers:out.headers,body:{state:'unavailable'}});
});
test('CP046 distinct native states retained with no raw packet',async()=>{
 for(const state of ['restricted','not_initialized','unavailable']){
  const r=rig();r.readNativeOwn=async({actorId})=>({actorId,state,packet:profile(99999)});
  const out=await make(r)(req('/v1/me/profile'));
  assert.equal(out.status,200);assert.deepEqual(out.body,{state,asOf:new Date(now).toISOString()});
 }
});
test('CP046 never treats an arbitrary target identifier as allowed path',async()=>{
 const r=rig(),read=make(r);
 for(const url of ['/v1/me/profile?actor='+B,'/v1/me/inventory/other','/v1/me/chest','//v1/me/profile','/v1/me/%70rofile']){
  assert.equal((await read({...req('/v1/me/profile'),url})).status,404,url);
 }
 assert.equal(r.reads.length,0);
});
test('CP046 rejects duplicate cookie, mixed bearer, transfer body, cross-origin',async()=>{
 const r=rig(),read=make(r),base=req('/v1/me/profile');
 const invalid=[
  {...base,headers:{cookie:base.headers.cookie+'; '+base.headers.cookie},rawHeaders:['Cookie',base.headers.cookie+'; '+base.headers.cookie]},
  {...base,rawHeaders:['Cookie',base.headers.cookie,'Cookie',base.headers.cookie]},
  {...base,headers:{...base.headers,authorization:'Bearer abc'},rawHeaders:[...base.rawHeaders,'Authorization','Bearer abc']},
  {...base,headers:{...base.headers,'transfer-encoding':'chunked'},rawHeaders:[...base.rawHeaders,'Transfer-Encoding','chunked']},
  {...base,headers:{...base.headers,'content-length':'10'},rawHeaders:[...base.rawHeaders,'Content-Length','10']},
  {...base,headers:{...base.headers,origin:'https://evil.test'},rawHeaders:[...base.rawHeaders,'Origin','https://evil.test']},
  {...base,headers:{...base.headers,'sec-fetch-site':'cross-site'},rawHeaders:[...base.rawHeaders,'Sec-Fetch-Site','cross-site']}
 ];
 for(const i of invalid){const out=await read(i);assert.ok(out.status===400||out.status===403)}
 assert.equal(r.reads.length,0);
});
test('CP046 GET only (405) and no request body, no cache',async()=>{
 const r=rig(),read=make(r),base=req('/v1/me/profile');
 const post=await read({...base,method:'POST'});assert.equal(post.status,405);assert.equal(post.headers.Allow,'GET');
 const body=await read({...base,body:'hi'});assert.equal(body.status,400);
 const out=await read(base);assert.equal(out.status,200);assert.equal(out.headers['Cache-Control'],'private, no-store');
});
test('CP046 reader crash and second resolver crash never leak exception details',async()=>{
 const r=rig();r.readNativeOwn=async()=>{throw Error('DB_URL_PRIVATE')};
 let out=await make(r)(req('/v1/me/profile'));
 assert.equal(out.status,503);assert.equal(JSON.stringify(out).includes('DB_URL_PRIVATE'),false);
 const r2=rig(),resolver=r2.resolveFreshSession;r2.resolveFreshSession=async arg=>{if(arg.phase==='after-read')throw Error('JWT_PRIVATE');return resolver(arg)};
 out=await make(r2)(req('/v1/me/profile'));assert.equal(out.status,401);assert.equal(JSON.stringify(out).includes('JWT_PRIVATE'),false);
});
test('CP046 auth deadline is bounded and prevents downstream native read',async()=>{
 const r=rig();r.resolveFreshSession=()=>new Promise(()=>{});
 const read=createP0NativeReadGateway({...r,clock:()=>now,authTimeoutMs:15});
 const out=await read(req('/v1/me/profile'));assert.equal(out.status,401);assert.equal(r.reads.length,0);
});
test('CP046 native read deadline bounded (requires cooperative SQL abort)',async()=>{
 const r=rig();r.readNativeOwn=()=>new Promise(()=>{});
 const read=createP0NativeReadGateway({...r,clock:()=>now,readTimeoutMs:15});
 const out=await read(req('/v1/me/profile'));assert.equal(out.status,503);
});
test('CP046 caller abort prevents a read and emits no data',async()=>{
 const r=rig(),controller=new AbortController();controller.abort();
 const out=await make(r)({...req('/v1/me/profile'),signal:controller.signal});
 assert.equal(out.status,503);assert.equal(r.reads.length,0);
});
test('CP046 CP014 authority adapter independently checks current binding twice',async()=>{
 let epoch=1;const ledger={inspectSession:()=>proof(A)};
 const authority={readBinding:async()=>({actor:A,epoch})};
 const resolve=createCP014Resolver({ledger,authority});
 const ctrl=new AbortController();
 assert.equal((await resolve({token:TOK_A,signal:ctrl.signal})).actorId,A);
 epoch=2;assert.equal(await resolve({token:TOK_A,signal:ctrl.signal}),null);
});
test('CP046 real loopback HTTP serves browser JSON, no client-carried target',async()=>{
 const r=rig(),server=createP0NativeLabServer({...r,clock:()=>now});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const address=server.address();const url=`http://127.0.0.1:${address.port}`;
  const responses=await Promise.all(Array.from({length:12},(_,i)=>fetch(url+(i%3===0?'/v1/me/inventory':'/v1/me/profile'),{headers:{Cookie:cookie(i%2?TOK_B:TOK_A)}})));
  for(let i=0;i<responses.length;i++){
   assert.equal(responses[i].status,200);assert.equal(responses[i].headers.get('cache-control'),'private, no-store');
   const payload=await responses[i].json();assert.equal(payload.state,'ready');
   if(i%3!==0)assert.equal(payload.data.money,i%2?777:123);
  }
  const noToken=await fetch(url+'/v1/me/profile');assert.equal(noToken.status,401);
 }finally{await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()))}
});

test('CP046 rejects raw Authorization even if an adapter silently discarded normalized header',async()=>{
 const r=rig(),read=make(r),base=req('/v1/me/profile');
 const reply=await read({...base,rawHeaders:[...base.rawHeaders,'Authorization','Bearer X']});
 assert.equal(reply.status,400);assert.equal(r.reads.length,0);
});
test('CP046 rejects raw-versus-normalized Cookie disagreement before selecting a principal',async()=>{
 const r=rig(),read=make(r),base=req('/v1/me/profile');
 const reply=await read({...base,headers:{cookie:cookie(TOK_B)}});
 assert.equal(reply.status,400);assert.equal(r.reads.length,0);
});

test('CP046-LAB native HTTP server must reject implicit wildcard listening',()=>{
 const server=createP0NativeLabServer(rig());
 try{assert.throws(()=>server.listen(0),/CP046_LAB_LOOPBACK_ONLY/)}
 finally{if(server.listening)server.close()}
});
test('CP046-LAB native HTTP server must reject explicit wildcard and Unix-socket listening',()=>{
 const server=createP0NativeLabServer(rig());
 try{
  assert.throws(()=>server.listen(0,'0.0.0.0'),/CP046_LAB_LOOPBACK_ONLY/);
  assert.throws(()=>server.listen({port:0,host:'::'}),/CP046_LAB_LOOPBACK_ONLY/);
  assert.throws(()=>server.listen('/tmp/cp046-lab-should-not-open.sock'),/CP046_LAB_LOOPBACK_ONLY/);
 }finally{if(server.listening)server.close()}
});
test('CP046-LAB explicitly bound IPv4 loopback still works',async()=>{
 const server=createP0NativeLabServer(rig());
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{assert.equal(server.address().address,'127.0.0.1')}finally{await new Promise(resolve=>server.close(resolve))}
});
