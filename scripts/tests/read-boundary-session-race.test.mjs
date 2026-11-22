import test from 'node:test';
import assert from 'node:assert/strict';
import {createPortalReadBoundary as createStrictBoundary} from '../../integration/gateway/read-boundary.mjs';
const createPortalReadBoundary=opts=>createStrictBoundary({...opts,allowUnboundMockSubjects:true});
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const request={method:'GET',url:'/api/portal/v1/read?sections=pet',headers:{cookie:'__Host-crownicles_session=opaque'}};
const snapshot={state:'ready',version:1,sections:{pet:{state:'absent'}}};
const payload=r=>JSON.parse(r.body);

test('revocation while SQL runs must prevent ready payload escaping',async()=>{
 let active=true,authCalls=0;
 const handle=createPortalReadBoundary({
  resolveVerifiedSubject:async()=>{authCalls++;return active?A:null;},
  readSnapshot:async()=>{active=false;return snapshot;}
 });
 const response=await handle(request);
 assert.equal(response.status,401);
 assert.deepEqual(payload(response),{state:'unavailable'});
 assert.equal(authCalls,2);
});

test('switch from A to B after read prevents stale A data escaping',async()=>{
 let actor=A;
 const handle=createPortalReadBoundary({
  resolveVerifiedSubject:async()=>actor,
  readSnapshot:async()=>{actor=B;return snapshot;}
 });
 assert.equal((await handle(request)).status,401);
});

test('same actor with replaced binding epoch is rejected',async()=>{
 let epoch=5;
 const handle=createPortalReadBoundary({
  resolveVerifiedSubject:async()=>({actor:A,bindingRef:'b1',bindingEpoch:epoch}),
  readSnapshot:async()=>{epoch=6;return snapshot;}
 });
 const response=await handle(request);
 assert.equal(response.status,401);
 assert.deepEqual(payload(response),{state:'unavailable'});
});

test('unchanged bound session returns 200 and proof never reaches the reader',async()=>{
 let verifications=0,context;
 const handle=createPortalReadBoundary({
  resolveVerifiedSubject:async(_cred,{phase})=>{verifications++;assert.ok(['before-read','after-read'].includes(phase));return {actor:A,bindingRef:'bound-opaqueref',bindingEpoch:9};},
  readSnapshot:async v=>{context=v;return snapshot;}
 });
 const response=await handle(request);
 assert.equal(response.status,200);
 assert.equal(verifications,2);
 assert.equal(context.actor,A);
 assert.equal(context.bindingRef,undefined);
 assert.equal(context.bindingEpoch,undefined);
 assert.equal(response.body.includes('bound-opaqueref'),false);
});

test('same actor with replaced binding reference is denied',async()=>{
 let bindingRef='session-older';
 const handle=createPortalReadBoundary({
  resolveVerifiedSubject:async()=>({actor:A,bindingRef,bindingEpoch:3}),
  readSnapshot:async()=>{bindingRef='session-newer';return snapshot;}
 });
 assert.equal((await handle(request)).status,401);
});

test('session proof switching from bound to legacy after SQL is denied',async()=>{
 let bound=true;
 const handle=createPortalReadBoundary({
  resolveVerifiedSubject:async()=>bound?{actor:A,bindingRef:'session1',bindingEpoch:0}:A,
  readSnapshot:async()=>{bound=false;return snapshot;}
 });
 assert.equal((await handle(request)).status,401);
});

test('invalid bound metadata fails closed before any database read',async()=>{
 let reads=0;
 for(const proof of [
  {actor:A,bindingRef:'',bindingEpoch:2},
  {actor:A,bindingRef:'ref',bindingEpoch:-1},
  {actor:A,bindingRef:'ref',bindingEpoch:1.1},
  {actor:A,bindingRef:'ref',bindingEpoch:'2'},
  {actor:A,bindingRef:'ref\nSECRET',bindingEpoch:1},
  {actor:A,bindingRef:'ref',bindingEpoch:1,extra:'secret',actorId:B},
 ]){
  const handle=createPortalReadBoundary({resolveVerifiedSubject:async()=>proof,
   readSnapshot:async()=>{reads++;return snapshot;}});
  const result=await handle(request);
  assert.equal(result.status,proof.extra?200:401);
 }
 assert.equal(reads,1);
});

test('expired or invalidated proof on recheck prevents response despite successful SQL',async()=>{
 let step=0;
 const handle=createPortalReadBoundary({
  resolveVerifiedSubject:async()=>++step===1?{actor:A,bindingRef:'b',bindingEpoch:2}:null,
  readSnapshot:async()=>snapshot
 });
 assert.equal((await handle(request)).status,401);
 assert.equal(step,2);
});

test('recheck exception contains no secrets or previous projected data',async()=>{
 let step=0;
 const handle=createPortalReadBoundary({
  resolveVerifiedSubject:async()=>++step===1?A:Promise.reject(Error('SECRET_AUTH_DIAGNOSTIC')),
  readSnapshot:async()=>({state:'ready',version:1,sections:{pet:{state:'absent',secret:'PRIVATE_PET_ROW'}}})
 });
 const result=await handle(request);
 assert.equal(result.status,401);
 assert.deepEqual(payload(result),{state:'unavailable'});
 assert.equal(result.body.includes('SECRET_'),false);
 assert.equal(result.body.includes('PRIVATE_'),false);
});

test('recheck timeout is bounded and aborts its distinct signal',async()=>{
 let step=0,afterSignal;
 const handle=createPortalReadBoundary({authTimeoutMs:25,
  resolveVerifiedSubject:async(_c,{signal})=>{step++;if(step===1)return A;afterSignal=signal;return new Promise(()=>{});},
  readSnapshot:async()=>snapshot
 });
 const at=Date.now(),result=await handle(request);
 assert.equal(result.status,401);
 assert.equal(step,2);
 assert.equal(afterSignal.aborted,true);
 assert.ok(Date.now()-at<1200);
});

test('client disconnect during recheck aborts verification and fails with 503',async()=>{
 const connection=new AbortController();
 let step=0,onRecheck,afterSignal;
 const recheckStarted=new Promise(r=>{onRecheck=r;});
 const handle=createPortalReadBoundary({authTimeoutMs:500,
  resolveVerifiedSubject:async(_credentials,{signal})=>{
   if(++step===1)return A;
   afterSignal=signal;onRecheck();return new Promise(()=>{});
  },readSnapshot:async()=>snapshot});
 const responsePending=handle({...request,signal:connection.signal});
 await recheckStarted;connection.abort();
 const result=await responsePending;
 assert.equal(result.status,503);
 assert.equal(afterSignal.aborted,true);
 assert.deepEqual(payload(result),{state:'unavailable'});
});

test('disconnect after reading prevents ready response',async()=>{
 const controller=new AbortController();
 let step=0;
 const handle=createPortalReadBoundary({
  resolveVerifiedSubject:async()=>{step++;return A;},
  readSnapshot:async()=>{controller.abort();return snapshot;}
 });
 const response=await handle({...request,signal:controller.signal});
 assert.equal(response.status,503);
 assert.ok(step===1||step===2);
});

test('upper and lowercase UUID strings refer to the same actor for mocks',async()=>{
 let step=0;
 const handle=createPortalReadBoundary({
  resolveVerifiedSubject:async()=>++step===1?A.toUpperCase():A,
  readSnapshot:async({actor})=>{assert.equal(actor,A);return snapshot;}
 });
 assert.equal((await handle(request)).status,200);
});

test('hostile proof getter fails closed rather than escaping the handler',async()=>{
 const hostile={get actor(){throw Error('HOSTILE_GETTER');},bindingRef:'x',bindingEpoch:0};
 const handler=createPortalReadBoundary({resolveVerifiedSubject:async()=>hostile,readSnapshot:async()=>snapshot});
 const response=await handler(request);
 assert.equal(response.status,401);
 assert.deepEqual(payload(response),{state:'unavailable'});
});

test('default factory rejects bare actor UUID even from a trusted resolver',async()=>{
 let reads=0;
 const strict=createStrictBoundary({resolveVerifiedSubject:async()=>A,
  readSnapshot:async()=>{reads++;return snapshot;}});
 assert.equal((await strict(request)).status,401);
 assert.equal(reads,0);
});

test('default factory accepts stable bound epoch and rechecks it twice',async()=>{
 let count=0;
 const strict=createStrictBoundary({
  resolveVerifiedSubject:async()=>{count++;return {actor:A,bindingRef:'binding-01',bindingEpoch:19};},
  readSnapshot:async()=>snapshot
 });
 assert.equal((await strict(request)).status,200);
 assert.equal(count,2);
});
