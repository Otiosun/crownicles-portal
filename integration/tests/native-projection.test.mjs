import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {fixture,A,B,NOW,ALL} from '../cp035/tests/native-fixture.mjs';
const require=createRequire(import.meta.url);const {normalizeBundle}=require('../overlay/contract-adapter.js');
const get=(f,actor=A,sections=ALL)=>f.readPortalSectionsForServer(actor,f.tx,sections,new Date(NOW));
test('five CP035 pinned compiled candidate queries with CP039 overlay pass CP038 projection with native food identifiers',async()=>{
 const f=fixture(),raw=await get(f),n=normalizeBundle(raw);assert.equal(n.state,'ready');assert.deepEqual(new Set(Object.keys(n.sections)),new Set(ALL));
 for(const key of ALL)assert.equal(n.sections[key].state,'ready');
 assert.deepEqual(n.sections.pantry.packet.foods.map(x=>x.id),['commonFood','herbivorousFood','carnivorousFood','ultimateFood']);
 assert.equal(n.sections.garden.data.plantStorage.at(-1).quantity,9);assert.equal(n.sections.garden.data.plantStorage.at(-1).maxCapacity,4);
 assert.equal(n.sections.pantry.packet.foods[1].maxAmount,11);assert.equal(n.sections.pantry.packet.foods[2].maxAmount,21);
 assert.equal(n.sections.pet.packet.pet.typeId,7);assert.ok(!JSON.stringify(n).includes('NO'));assert.ok(!JSON.stringify(n).includes(A));
});
test('B has distinct home and chest but no pet/pantry/garden',async()=>{
 const f=fixture(),n=normalizeBundle(await get(f,B));assert.equal(n.state,'ready');assert.equal(n.sections.chest.data.chestItems[0].details.id,70);
 for(const key of ['pet','pantry','garden'])assert.equal(n.sections[key].state,'absent');
 assert.equal(n.sections.property.data.apartments.length,0);
});
test('restricted chest/garden preserve only state, property remains visible',async()=>{
 const f=fixture();f.a.city='elsewhere';const n=normalizeBundle(await get(f));assert.equal(n.state,'ready');
 assert.deepEqual(n.sections.chest,{state:'restricted'});assert.deepEqual(n.sections.garden,{state:'restricted'});
 assert.equal(n.sections.property.state,'ready');assert.ok(!JSON.stringify(n).includes('42'));
});
test('cross-owner corruption fails whole bundle and client projection emits unavailable',async()=>{
 const f=fixture();f.homeA.ownerId=2;f.issues.forceCrossOwner=true;const raw=await get(f);assert.deepEqual(raw,{state:'unavailable'});assert.deepEqual(normalizeBundle(raw),{state:'unavailable'});
});
test('native 4 food identifiers allowed; numerical, invented, duplicate, overflow and XSS-like ids rejected',()=>{
 const good={state:'ready',version:1,sections:{pantry:{state:'ready',packet:{guildName:'Guild',foods:[{id:'commonFood',amount:1,maxAmount:3},{id:'ultimateFood',amount:0,maxAmount:5}]}}}};
 assert.equal(normalizeBundle(good).state,'ready');
 for(const id of [1,'grain','__proto__','<img src=x>','CommonFood','commonfood']){const bad=structuredClone(good);bad.sections.pantry.packet.foods[0].id=id;assert.equal(normalizeBundle(bad).state,'unavailable',String(id));}
 for(const mutate of [x=>x.sections.pantry.packet.foods[1].id='commonFood',x=>x.sections.pantry.packet.foods[0].amount=7]){const bad=structuredClone(good);mutate(bad);assert.equal(normalizeBundle(bad).state,'unavailable');}
});
test('legacy overweight garden storage is preserved, invalid negative storage rejected',()=>{
 const f=fixture();return get(f,A,['garden']).then(x=>{const n=normalizeBundle(x);assert.equal(n.state,'ready');assert.equal(n.sections.garden.data.plantStorage[9].quantity,9);x.sections.garden.data.plantStorage[9].quantity=-1;assert.equal(normalizeBundle(x).state,'unavailable');});
});
