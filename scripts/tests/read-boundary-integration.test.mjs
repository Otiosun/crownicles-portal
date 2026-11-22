import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,A,B,ALL,read} from '../../integration/tests/fixture.mjs';
import {createPortalReadBoundary} from '../../integration/gateway/read-boundary.mjs';

// Transpiles the four *actual candidate TS files* using fixture.mjs.
// Only the database, real OIDC verification and HTTP transport are doubled.
const request=(names=ALL,actorId)=>({method:'GET',url:'/api/portal/v1/read?sections='+names.join(','),headers:{cookie:'opaque'},actorId});
const bound=(f,subject)=>createPortalReadBoundary({resolveVerifiedSubject:async()=>subject,
 readSnapshot:({actor,sections})=>read(f,actor,sections)});
const result=async(handler,req)=>{const response=await handler(req);return {status:response.status,payload:JSON.parse(response.body),raw:response.body,headers:response.headers};};

test('real five-query candidates flow through the real projector and CP040 boundary for subject A',async()=>{
 const f=fixture();const r=await result(bound(f,A),request());
 assert.equal(r.status,200);assert.equal(r.payload.state,'ready');
 assert.equal(r.payload.sections.pet.packet.pet.nickname,'Lumi');
 assert.equal(r.payload.sections.chest.data.chestItems[0].details.id,42);
 assert.deepEqual(Object.keys(r.payload.sections),['pet','garden','property','chest','pantry']);
 for(const word of [A,'private','NO'])assert.ok(!r.raw.includes(word),word);
 assert.equal(r.headers['Cache-Control'],'private, no-store');
});

test('subject B never obtains A pet, guild pantry, home or chest by supplying A as actorId',async()=>{
 const f=fixture();const r=await result(bound(f,B),request(ALL,A));
 assert.equal(r.status,200);assert.equal(r.payload.state,'ready');
 assert.equal(r.payload.sections.pet.state,'absent');
 assert.equal(r.payload.sections.pantry.state,'absent');
 assert.equal(r.payload.sections.garden.state,'absent');
 assert.equal(r.payload.sections.chest.data.chestItems[0].details.id,70);
 assert.equal(r.payload.sections.property.data.home.cityId,'elsewhere');
 for(const word of [A,'Lumi','Coven','"id":42'])assert.ok(!r.raw.includes(word),word);
});

test('reader SQL error after an earlier successful candidate suppresses the entire response',async()=>{
 const f=fixture();f.issues.throwTable='slots';
 const r=await result(bound(f,A),request(['property','chest']));
 assert.equal(r.status,503);assert.deepEqual(r.payload,{state:'unavailable'});
 assert.ok(!r.raw.includes('DONT_LEAK_DATABASE_ERROR'));
});

test('cross-owner corrupted home row cannot produce a partial 200 response',async()=>{
 const f=fixture();f.homeA.ownerId=2;f.issues.forceCrossOwner=true;
 const r=await result(bound(f,A),request(['property','chest']));
 assert.equal(r.status,503);assert.deepEqual(r.payload,{state:'unavailable'});
});

test('native restricted states survive projection but do not carry property objects',async()=>{
 const f=fixture();f.a.city='elsewhere';
 const r=await result(bound(f,A),request(['chest','garden']));
 assert.equal(r.status,200);
 assert.deepEqual(r.payload.sections.chest,{state:'restricted'});
 assert.deepEqual(r.payload.sections.garden,{state:'restricted'});
 assert.ok(!r.raw.includes('chestItems'));
});
