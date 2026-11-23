import test from 'node:test';
import assert from 'node:assert/strict';
import {createP0BrowserReader} from './browser-reader.cp046.mjs';
import {createP0NativeLabServer,CP046_COOKIE} from './secure-native-read.cp046.mjs';
const asOf='2026-11-22T23:00:00.000Z';
const p=money=>({level:1,health:{value:1,max:5},experience:{value:1,max:5},money,badges:[],
  missions:{gems:0,campaignProgression:0},rank:{rank:-1,unranked:true,numberOfPlayers:0,score:0},
  effect:{healed:false,timeLeft:-1,effect:'none',hasTimeDisplay:false},kingChallengeTier:0});
const reply=(body,status=200,headers={'Content-Type':'application/json; charset=utf-8'})=>new Response(JSON.stringify(body),{status,headers});
const profile=(money)=>reply({state:'ready',asOf,data:p(money)});
const issue=()=>{const updates=[],requests=[];const fetcher=async (url,options)=>{requests.push([url,options]);return profile(7)};
 const ui=createP0BrowserReader({fetcher,onChange:state=>updates.push(state)});
 ui.dispatch({type:'AUTH_ESTABLISHED'});return {ui,updates,requests};};
test('CP046 browser reader uses cookie-only same-origin no-store GET and CP045 DTO guard',async()=>{
 const {ui,updates,requests}=issue();await ui.read('profile');
 assert.equal(ui.getState().sections.profile.state,'ready');assert.equal(ui.getState().sections.profile.data.money,7);
 const [url,options]=requests[0];assert.equal(url,'/v1/me/profile');
 assert.equal(options.credentials,'same-origin');assert.equal(options.method,'GET');assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');
 assert.equal(Object.hasOwn(options.headers,'Cookie'),false);assert.equal(Object.hasOwn(options.headers,'Authorization'),false);
 assert.ok(updates.length>=3);
});
test('CP046 client rejects unknown sections instead of making a network request',async()=>{
 const {ui,requests}=issue();await assert.rejects(ui.read('chest'),/P0_SECTION_REQUIRED/);assert.equal(requests.length,0);
});
test('CP046 client accepts restricted/noninitialized/unavailable without stale data',async()=>{
 for(const domainState of ['restricted','not_initialized','unavailable']){
  const ui=createP0BrowserReader({fetcher:async()=>reply({state:domainState,asOf})});
  ui.dispatch({type:'AUTH_ESTABLISHED'});await ui.read('profile');
  assert.equal(ui.getState().sections.profile.state,domainState);assert.equal(ui.getState().sections.profile.data,null);
 }
});
test('CP046 client 401 purges both sections and invalidates epoch',async()=>{
 let n=0;const ui=createP0BrowserReader({fetcher:async()=>++n===1?profile(7):reply({state:'unavailable'},401)});
 ui.dispatch({type:'AUTH_ESTABLISHED'});await ui.read('profile');assert.equal(ui.getState().sections.profile.data.money,7);
 await ui.read('inventory');assert.equal(ui.getState().authorized,false);assert.equal(ui.getState().sections.profile.data,null);
 assert.equal(ui.getState().epoch,2);
});
test('CP046 client superseded ready is ignored even if it arrives late',async()=>{
 const resolvers=[];const ui=createP0BrowserReader({fetcher:()=>new Promise(resolve=>resolvers.push(resolve))});
 ui.dispatch({type:'AUTH_ESTABLISHED'});
 const old=ui.read('profile'),newer=ui.read('profile');
 assert.equal(resolvers.length,2);
 resolvers[1](profile(2));await newer;
 resolvers[0](profile(999));await old;
 assert.equal(ui.getState().sections.profile.data.money,2);
});
test('CP046 client superseded same-epoch 401 revokes even after newer ready',async()=>{
 const resolvers=[];const ui=createP0BrowserReader({fetcher:()=>new Promise(resolve=>resolvers.push(resolve))});
 ui.dispatch({type:'AUTH_ESTABLISHED'});
 const old=ui.read('profile'),newer=ui.read('profile');
 resolvers[1](profile(2));await newer;
 resolvers[0](reply({error:'unauthorized'},401));await old;
 assert.equal(ui.getState().authorized,false);assert.equal(ui.getState().sections.profile.data,null);
});
test('CP046 client logout aborts old fetches and old session data cannot reappear',async()=>{
 let resolve;const ui=createP0BrowserReader({fetcher:()=>new Promise(r=>{resolve=r})});
 ui.dispatch({type:'AUTH_ESTABLISHED'});
 const work=ui.read('profile');ui.dispatch({type:'LOGOUT'});resolve(profile(999));await work;
 assert.equal(ui.getState().authorized,false);assert.equal(ui.getState().sections.profile.data,null);
});
test('CP046 client rejects invalid response MIME, broken JSON and oversized body',async()=>{
 for(const response of [
   reply({state:'ready',asOf,data:p(1)},200,{'content-type':'text/plain'}),
   new Response('{invalid-json',{headers:{'content-type':'application/json'}}),
   new Response('X'.repeat(128*1024+5),{headers:{'content-type':'application/json'}}),
   new Response(new Uint8Array([0xff,0xfe]),{headers:{'content-type':'application/json'}})
 ]){
  const ui=createP0BrowserReader({fetcher:async()=>response});ui.dispatch({type:'AUTH_ESTABLISHED'});
  await ui.read('profile');assert.equal(ui.getState().sections.profile.state,'unavailable');assert.equal(ui.getState().sections.profile.data,null);
 }
});
test('CP046 browser reader rejects invalid nested DTO without copying private secrets',async()=>{
 const bad=p(7);bad.sessionToken='DO_NOT_COPY';
 const ui=createP0BrowserReader({fetcher:async()=>reply({state:'ready',asOf,data:bad})});
 ui.dispatch({type:'AUTH_ESTABLISHED'});await ui.read('profile');
 assert.equal(ui.getState().sections.profile.state,'unavailable');
 assert.equal(JSON.stringify(ui.getState()).includes('DO_NOT_COPY'),false);
});
test('CP046 browser reader consumes actual localhost HTTP gateway (Node injected test cookie only)',async()=>{
 const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',token='A'.repeat(43),ref='a'.repeat(64);
 const expiresAt=Date.now()+100000; // fixed session expiry: CP046 rejects a changed proof
 const server=createP0NativeLabServer({
  resolveFreshSession:async()=>({actorId:A,bindingRef:ref,bindingEpoch:1,expiresAt}),
  readNativeOwn:async ({actorId})=>({actorId,state:'ready',packet:{playerData:{
   level:2,health:{value:2,max:3},experience:{value:1,max:5},money:42,badges:[],
   missions:{gems:0,campaignProgression:0},rank:{rank:-1,unranked:true,numberOfPlayers:0,score:0},
   effect:{healed:false,timeLeft:0,effect:'none',hasTimeDisplay:false},kingChallengeTier:0}}})
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const origin='http://127.0.0.1:'+server.address().port;
  const ui=createP0BrowserReader({fetcher:(url,options)=>fetch(origin+url,{...options,headers:{...options.headers,Cookie:`${CP046_COOKIE}=${token}`}})});
  ui.dispatch({type:'AUTH_ESTABLISHED'});await ui.read('profile');
  assert.equal(ui.getState().sections.profile.state,'ready');assert.equal(ui.getState().sections.profile.data.money,42);
 }finally{await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
});
