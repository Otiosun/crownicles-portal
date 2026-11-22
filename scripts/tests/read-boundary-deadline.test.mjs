import test from 'node:test';
import assert from 'node:assert/strict';
import {createPortalReadBoundary,READ_BOUNDARY_POLICY} from '../../integration/gateway/read-boundary.mjs';

const A='11111111-1111-4111-8111-111111111111';
const req={method:'GET',url:'/api/portal/v1/read?sections=pet',headers:{authorization:'Bearer opaque'}};
const success=()=>({state:'ready',version:1,sections:{pet:{state:'absent'}}});
const defaults={resolveVerifiedSubject:async()=>A,readSnapshot:async()=>success()};
const parse=r=>JSON.parse(r.body);

test('default deadlines are bounded and documented as response deadlines',()=>{
 assert.equal(READ_BOUNDARY_POLICY.defaultAuthTimeoutMs,2500);
 assert.equal(READ_BOUNDARY_POLICY.defaultReadTimeoutMs,5000);
 assert.equal(READ_BOUNDARY_POLICY.maxTimeoutMs,30000);
});
test('reject invalid or unbounded budgets before creating a handler',()=>{
 for(const t of [0,-1,1.5,NaN,Infinity,30001,'500',null]){
  for(const key of ['authTimeoutMs','readTimeoutMs']){
    assert.throws(()=>createPortalReadBoundary({...defaults,[key]:t}),RangeError,String(t)+key);
  }
 }
});
test('valid custom short deadlines are accepted and retain success semantics',async()=>{
 const handler=createPortalReadBoundary({...defaults,authTimeoutMs:80,readTimeoutMs:80});
 const r=await handler(req);
 assert.equal(r.status,200);
 assert.deepEqual(parse(r),success());
});
test('a session verifier that never settles produces a bounded 401 and gets aborted',async()=>{
 let authSignal;
 const handler=createPortalReadBoundary({...defaults,authTimeoutMs:25,
  resolveVerifiedSubject:(_credentials,{signal})=>{authSignal=signal;return new Promise(()=>{});},
  readSnapshot:()=>{throw Error('should not be called');}
 });
 const started=Date.now(),r=await handler(req);
 assert.equal(r.status,401);assert.deepEqual(parse(r),{state:'unavailable'});
 assert.equal(authSignal.aborted,true);
 assert.ok(Date.now()-started<900);
});
test('a snapshot that never settles produces a bounded 503 and gets aborted',async()=>{
 let readSignal;
 const handler=createPortalReadBoundary({...defaults,readTimeoutMs:25,
  readSnapshot:({signal})=>{readSignal=signal;return new Promise(()=>{});}
 });
 const started=Date.now(),r=await handler(req);
 assert.equal(r.status,503);assert.deepEqual(parse(r),{state:'unavailable'});
 assert.equal(readSignal.aborted,true);
 assert.ok(Date.now()-started<900);
});
test('aborted work resolving after timeout cannot change a response or leak a later completion',async()=>{
 let resolveLater,signal;
 const handler=createPortalReadBoundary({...defaults,readTimeoutMs:25,
  readSnapshot:context=>{signal=context.signal;return new Promise(resolve=>{resolveLater=resolve;});}
 });
 const first=await handler(req);
 assert.equal(first.status,503);assert.equal(signal.aborted,true);
 resolveLater({state:'ready',version:1,sections:{pet:{state:'ready',packet:{pet:{typeId:7,nickname:'SHOULD_NOT_APPEAR',rarity:1,sex:'F',loveLevel:0,force:0}}}}});
 await Promise.resolve();
 assert.deepEqual(parse(first),{state:'unavailable'});
 assert.ok(!first.body.includes('SHOULD_NOT_APPEAR'));
});
test('successful integration receives a live AbortSignal in each trust stage',async()=>{
 let authSignal,readSignal;
 const handler=createPortalReadBoundary({
  resolveVerifiedSubject:async(_credentials,{signal})=>{authSignal=signal;return A;},
  readSnapshot:async({signal})=>{readSignal=signal;return success();}
 });
 const r=await handler(req);assert.equal(r.status,200);
 assert.ok(authSignal instanceof AbortSignal);
 assert.ok(readSignal instanceof AbortSignal);
 assert.equal(authSignal.aborted,false);
 assert.equal(readSignal.aborted,false);
});
test('auth timeout is isolated per request and does not poison the next session',async()=>{
 let n=0;
 const handler=createPortalReadBoundary({...defaults,authTimeoutMs:25,
  resolveVerifiedSubject:async()=>{n++;if(n===1)return new Promise(()=>{});return A;}
 });
 assert.equal((await handler(req)).status,401);
 assert.equal((await handler(req)).status,200);
 assert.equal(n,2);
});
test('read timeout is isolated per request and does not poison the next read',async()=>{
 let n=0;
 const handler=createPortalReadBoundary({...defaults,readTimeoutMs:25,
  readSnapshot:async()=>{n++;if(n===1)return new Promise(()=>{});return success();}
 });
 assert.equal((await handler(req)).status,503);
 assert.equal((await handler(req)).status,200);
 assert.equal(n,2);
});
