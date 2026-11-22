import test from 'node:test';
import assert from 'node:assert/strict';
import {createPortalReadBoundary,READ_BOUNDARY_POLICY} from '../../integration/gateway/read-boundary.mjs';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const url='/api/portal/v1/read?sections=pet,garden';
const absent=names=>({state:'ready',version:1,sections:Object.fromEntries(names.map(n=>[n,{state:'absent'}]))});
const req=(overrides={})=>({method:'GET',url,headers:{cookie:'session=opaque-test'},...overrides});
const make=(patch={})=>{
 const seen={auth:[],read:[]};
 const handle=createPortalReadBoundary({
  resolveVerifiedSubject: async credentials=>{seen.auth.push(credentials);return A;},
  readSnapshot:async context=>{seen.read.push(context);return absent(context.sections);},
  ...patch
 });
 return {handle,seen};
};
const body=res=>JSON.parse(res.body);

test('policy exposes stable exact route and canonical section allowlist',()=>{
 assert.equal(READ_BOUNDARY_POLICY.path,'/api/portal/v1/read');
 assert.deepEqual([...READ_BOUNDARY_POLICY.sections],['property','chest','garden','pet','pantry']);
 assert.ok(Object.isFrozen(READ_BOUNDARY_POLICY.sections));
});
test('constructor refuses missing or noncallable trust boundaries',()=>{
 for(const arg of [undefined,{}, {readSnapshot:()=>{}},{resolveVerifiedSubject:()=>{}},{resolveVerifiedSubject:true,readSnapshot:()=>{}}]){
  assert.throws(()=>createPortalReadBoundary(arg),/VERIFIED_SESSION/);
 }
});
test('valid request reads exact selected sections under authenticated subject',async()=>{
 const {handle,seen}=make();const r=await handle(req());
 assert.equal(r.status,200);assert.equal(body(r).state,'ready');
 assert.deepEqual(Object.keys(body(r).sections),['pet','garden']);
 assert.equal(seen.auth.length,1);assert.equal(seen.read.length,1);
 assert.equal(seen.read[0].actor,A);assert.deepEqual(seen.read[0].sections,['pet','garden']);
 assert.ok(Object.isFrozen(seen.read[0]));assert.ok(Object.isFrozen(seen.read[0].sections));
 assert.ok(seen.read[0].now instanceof Date);
});
test('never uses browser supplied actor even when it looks like another valid UUID',async()=>{
 const {handle,seen}=make();
 const r=await handle(req({actor:B,actorId:B,userId:B,headers:{cookie:'x', 'X-User-Id':B,'x-subject':B}}));
 assert.equal(r.status,200);assert.equal(seen.read[0].actor,A);
 assert.deepEqual(Object.keys(seen.auth[0]),['authorization','cookie']);
 assert.ok(!JSON.stringify(seen.read).includes(B));
});
test('no supplied cookie or bearer means no authenticator call and no database access',async()=>{
 const {handle,seen}=make();const r=await handle(req({headers:{'x-user-id':A}}));
 assert.equal(r.status,401);assert.equal(seen.auth.length,0);assert.equal(seen.read.length,0);
});
test('header names are case insensitive without forwarding identity-shaped headers',async()=>{
 const {handle,seen}=make();const r=await handle(req({headers:{CoOkIe:'opaque', 'X-Actor':B}}));
 assert.equal(r.status,200);assert.deepEqual(seen.auth[0],{authorization:null,cookie:'opaque'});
});
test('fetch Headers-style accessor works',async()=>{
 const {handle,seen}=make();const headers=new Headers({'authorization':'Bearer opaque'});
 const r=await handle(req({headers}));assert.equal(r.status,200);
 assert.deepEqual(seen.auth[0],{authorization:'Bearer opaque',cookie:null});
});
test('missing authorization is 401 even if resolver is willing to invent a subject',async()=>{
 const {handle,seen}=make({resolveVerifiedSubject:async()=>A});
 const r=await handle(req({headers:{}}));assert.equal(r.status,401);assert.equal(seen.read.length,0);
});
test('invalid subject and invalid return shapes fail closed',async()=>{
 for(const value of [null,'','abc','123',B.toUpperCase()+'x',0,{sub:A},{verified:true,subject:A}]){
  const {handle,seen}=make({resolveVerifiedSubject:async()=>value});
  const r=await handle(req());assert.equal(r.status,401,String(value));assert.equal(seen.read.length,0);
 }
});
test('authentication throw/rejection is 401 with neither error nor token disclosure',async()=>{
 const {handle,seen}=make({resolveVerifiedSubject:async()=>{throw Error('SECRET_AUTH_TOKEN');}});
 const r=await handle(req());assert.equal(r.status,401);assert.equal(seen.read.length,0);
 assert.ok(!r.body.includes('SECRET_AUTH_TOKEN'));
});
test('reader throw/rejection is 503 and response does not disclose DB diagnostics',async()=>{
 const {handle}=make({readSnapshot:async()=>{throw Error('SQL_PRIVATE_ROW');}});
 const r=await handle(req());assert.equal(r.status,503);assert.deepEqual(body(r),{state:'unavailable'});
 assert.ok(!r.body.includes('SQL_PRIVATE_ROW'));
});
test('outer unavailable state is never returned as HTTP 200',async()=>{
 const {handle}=make({readSnapshot:async()=>({state:'unavailable',debug:{token:'sensitive'}})});
 const r=await handle(req());assert.equal(r.status,503);assert.deepEqual(body(r),{state:'unavailable'});
});
test('reader cannot silently omit one of the requested sections',async()=>{
 const {handle}=make({readSnapshot:async()=>absent(['pet'])});
 assert.equal((await handle(req())).status,503);
});
test('reader cannot include sections that the browser did not request',async()=>{
 const {handle}=make({readSnapshot:async()=>absent(['pet','garden','property'])});
 assert.equal((await handle(req())).status,503);
});
test('projector strips surplus sensitive attributes in valid section envelopes',async()=>{
 const {handle}=make({readSnapshot:async()=>({state:'ready',version:1,sections:{pet:{state:'absent',privateKey:'secret'},garden:{state:'absent',privateKey:'secret'}},privateSecret:'secret'})});
 const r=await handle(req());assert.equal(r.status,200);assert.ok(!r.body.includes('secret'));
});
test('unknown section is rejected before invoking trust boundaries',async()=>{
 const {handle,seen}=make();const r=await handle(req({url:'/api/portal/v1/read?sections=pet,unknown'}));
 assert.equal(r.status,400);assert.equal(seen.auth.length,0);assert.equal(seen.read.length,0);
});
test('unknown/malformed/ambiguous query data is refused (including actorId)',async()=>{
 const bad=[
  '/api/portal/v1/read','/api/portal/v1/read?sections=',
  '/api/portal/v1/read?sections=pet,pet',
  '/api/portal/v1/read?sections=pet&sections=garden',
  '/api/portal/v1/read?sections=pet&actorId='+B,
  '/api/portal/v1/read?sections=pet&homeId=8',
  '/api/portal/v1/read?sections=__proto__',
  '/api/portal/v1/read?sections=Pet',
  '/api/portal/v1/read?sections=pet%00',
  '/api/portal/v1/read?sections=pet%2C',
  '/api/portal/v1/read?sections=pet%2Cgarden%2Cchest%2Cproperty%2Cpantry%2Cgarden',
  '/api/portal/v1/read?sections=pet&debug=1'
 ];
 const {handle,seen}=make();for(const u of bad)assert.equal((await handle(req({url:u}))).status,400,u);
 assert.equal(seen.auth.length,0);assert.equal(seen.read.length,0);
});
test('valid five sections are allowed and immutable through the reader',async()=>{
 const {handle,seen}=make();const r=await handle(req({url:'/api/portal/v1/read?sections=pantry,property,chest,garden,pet'}));
 assert.equal(r.status,200);assert.equal(seen.read[0].sections.length,5);
});
test('unsupported methods never reach authorization nor reading',async()=>{
 const {handle,seen}=make();for(const method of ['POST','HEAD','PUT','DELETE','OPTIONS',undefined]){
  const r=await handle(req({method}));assert.equal(r.status,405,String(method));assert.equal(r.headers.Allow,'GET');
 }
 assert.equal(seen.auth.length,0);assert.equal(seen.read.length,0);
});
test('GET with body rejected, no hidden write-like inputs',async()=>{
 const {handle,seen}=make();const r=await handle(req({body:{actor:B}}));
 assert.equal(r.status,400);assert.equal(seen.read.length,0);
});
test('wrong route returns 404 and never authenticates',async()=>{
 const {handle,seen}=make();const r=await handle(req({url:'/api/portal/v1/write?sections=pet'}));
 assert.equal(r.status,404);assert.equal(seen.auth.length,0);
});
test('absolute, protocol-relative, fragment, excessively long, or invalid URL rejected',async()=>{
 const {handle,seen}=make();for(const u of ['https://evil.test/api/portal/v1/read?sections=pet','//evil.test/api/portal/v1/read?sections=pet',url+'#hash',url+'x'.repeat(600),'',42]){
  assert.equal((await handle(req({url:u}))).status,400,String(u).slice(0,25));
 }assert.equal(seen.read.length,0);
});
test('invalid request objects rejected safely',async()=>{
 const {handle}=make();for(const r of [null,undefined,1,'x',[],{},Object.create(null)]){
  const result=await handle(r);assert.equal(result.status,400);
 }
});
test('credential arrays, control characters and huge headers are rejected',async()=>{
 const {handle,seen}=make();for(const value of [['a','b'],'a\r\nb','x'.repeat(20000),123]){
  const r=await handle(req({headers:{cookie:value}}));assert.equal(r.status,400);
 }assert.equal(seen.auth.length,0);
});
test('all outcomes use no-store and response body never echoes credentials',async()=>{
 const {handle}=make();for(const r of [req(),req({headers:{}}),req({url:'/other?sections=pet'}),req({method:'POST'})]){
  const out=await handle(r);assert.match(out.headers['Cache-Control'],/no-store/);
  assert.equal(out.headers['X-Content-Type-Options'],'nosniff');
  assert.equal(out.headers['Access-Control-Allow-Origin'],undefined);
  assert.ok(!out.body.includes('opaque-test'));
 }
});
test('duplicate credential spellings cannot ambiguously select an identity',async()=>{
 const {handle,seen}=make();const r=await handle(req({headers:{cookie:'A',Cookie:'B'}}));
 assert.equal(r.status,400);assert.equal(seen.auth.length,0);assert.equal(seen.read.length,0);
});
test('raw whitespace in URL is rejected instead of being normalized into a valid query',async()=>{
 const {handle,seen}=make();for(const u of ['/api/portal/v1/read?sections=pet\n','/api/portal/v1/read?sections=pet\t','/api/portal/v1/read? sections=pet']){
  assert.equal((await handle(req({url:u}))).status,400);
 }assert.equal(seen.auth.length,0);
});
test('exotic request property getters fail closed without unhandled rejection',async()=>{
 const {handle,seen}=make();const r={method:'GET',get url(){throw Error('proxy-secret');}};
 const result=await handle(r);assert.equal(result.status,400);assert.ok(!result.body.includes('proxy-secret'));assert.equal(seen.auth.length,0);
});

test('reject dual credentials rather than selecting a bearer or cookie actor ambiguously',async()=>{
 const {handle,seen}=make();const r=await handle(req({headers:{cookie:'A',authorization:'Bearer B'}}));
 assert.equal(r.status,400);assert.equal(seen.auth.length,0);assert.equal(seen.read.length,0);
});
test('reject advertised GET bodies even when request.body property is not set',async()=>{
 const {handle,seen}=make();for(const headers of [
  {cookie:'x','content-length':'42'}, {cookie:'x','transfer-encoding':'chunked'},
  {cookie:'x','content-length':'not-a-number'}, {cookie:'x','content-length':'0','transfer-encoding':'chunked'}
 ])assert.equal((await handle(req({headers}))).status,400);
 assert.equal(seen.auth.length,0);assert.equal(seen.read.length,0);
});
test('reject normalized dot-segments and encoded routes, not just parsed pathname',async()=>{
 const {handle,seen}=make();for(const u of [
  '/api/portal/v1/not/../read?sections=pet,garden',
  '/api/portal/v1/%72ead?sections=pet,garden',
  '/api/portal/v1//read?sections=pet,garden'
 ])assert.notEqual((await handle(req({url:u}))).status,200,u);
 assert.equal(seen.auth.length,0);
});
test('zero content-length and single bearer credential remain valid',async()=>{
 const {handle,seen}=make();const r=await handle(req({headers:{authorization:'Bearer abc','content-length':'0'}}));
 assert.equal(r.status,200);assert.equal(seen.auth.length,1);
});

test('reject empty or whitespace-only identity headers before the resolver',async()=>{
 const {handle,seen}=make();
 for(const headers of [{cookie:' '},{authorization:'   '},{authorization:'Basic opaque'},{authorization:'Bearer '},{authorization:'Bearer a,b'},{authorization:'Bearer a\nb'}]){
  assert.equal((await handle(req({headers}))).status,400,JSON.stringify(headers));
 }
 assert.equal(seen.auth.length,0);assert.equal(seen.read.length,0);
});
test('accept valid RFC6750-style bearer format with opaque token alphabet',async()=>{
 const {handle,seen}=make();const r=await handle(req({headers:{authorization:'bearer a-Z_123.+/~=='}}));
 assert.equal(r.status,200);assert.equal(seen.read.length,1);
 assert.deepEqual(seen.auth[0],{authorization:'bearer a-Z_123.+/~==',cookie:null});
});

test('duplicate request-cookie name and comma-merged credentials fail before verifier',async()=>{
 const {handle,seen}=make();
 for(const cookie of ['session=A; session=B','session=A, session=B','sid=A; sid=B; theme=dark',' =bad; sid=A']){
  assert.equal((await handle(req({headers:{cookie}}))).status,400,cookie);
 }
 assert.equal(seen.auth.length,0);assert.equal(seen.read.length,0);
});
test('distinct cookie names remain valid for the verifier to assess',async()=>{
 const {handle,seen}=make();const r=await handle(req({headers:{cookie:'session=A; prefs=dark'}}));
 assert.equal(r.status,200);assert.equal(seen.auth[0].cookie,'session=A; prefs=dark');
});
