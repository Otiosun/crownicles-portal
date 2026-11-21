import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {A,B,ALL,fixture,read} from './fixture.mjs';

// This is a contract test using the *actual candidate TypeScript* transpiled at
// test time, not a pre-shaped fake response. Its ORM and session are simulated.
const require=createRequire(import.meta.url);
const {normalizeBundle}=require('../../web/contract-adapter.js');

test('all five compiled candidate queries pass the real client projector without exposing internal fields',async()=>{
 const f=fixture(),raw=await read(f),view=normalizeBundle(raw);
 assert.equal(raw.state,'ready');
 assert.equal(view.state,'ready');
 assert.deepEqual(Object.keys(view.sections),['pet','garden','property','chest','pantry']); // projector canonical section order
 for(const name of ALL)assert.equal(view.sections[name].state,'ready',name);
 assert.equal(view.sections.pet.packet.pet.typeId,7);
 assert.equal(view.sections.pet.packet.pet.nickname,'Lumi');
 assert.equal(view.sections.chest.data.chestItems[0].details.id,42);
 assert.equal(view.sections.garden.data.plantStorage.at(-1).quantity,9);
 assert.equal(view.sections.garden.data.plantStorage.at(-1).maxCapacity,4);
 assert.ok(!JSON.stringify(view).includes(A));
 assert.ok(!JSON.stringify(view).includes('private'));
 assert.ok(!JSON.stringify(view).includes('NO'));
});

test('official four food names are mapped to their native capacity index, even when caps differ',async()=>{
 const n=normalizeBundle(await read(fixture()));
 const foods=n.sections.pantry.packet.foods;
 assert.deepEqual(foods.map(x=>x.id),['commonFood','herbivorousFood','carnivorousFood','ultimateFood']);
 assert.deepEqual(foods.map(x=>x.maxAmount),[10,11,21,5]);
 assert.deepEqual(foods.map(x=>x.amount),[2,3,3,1]);
});

test('a second authenticated subject cannot inherit the first subject property, pet or pantry',async()=>{
 const f=fixture();
 const first=normalizeBundle(await read(f,A));
 const second=normalizeBundle(await read(f,B));
 assert.equal(first.sections.chest.data.chestItems[0].details.id,42);
 assert.equal(second.sections.chest.data.chestItems[0].details.id,70);
 assert.equal(second.sections.property.data.home.cityId,'elsewhere');
 assert.deepEqual(second.sections.property.data.apartments,[]);
 for(const name of ['pet','pantry','garden'])assert.deepEqual(second.sections[name],{state:'absent'});
 assert.ok(!JSON.stringify(second).includes('Lumi'));
 assert.ok(!JSON.stringify(second).includes('Coven'));
});

test('apartment allows chest without silently granting garden access',async()=>{
 const f=fixture();f.a.city='remote';
 let v=normalizeBundle(await read(f,A,['chest','garden']));
 assert.equal(v.sections.chest.data.accessMode,'owned_apartment');
 assert.deepEqual(v.sections.garden,{state:'restricted'});
 f.db.talismans[0].hasRemoteHarvestTalisman=true;
 v=normalizeBundle(await read(f,A,['garden']));
 assert.equal(v.sections.garden.data.accessMode,'readOnly');
 assert.equal('eligibility' in v.sections.garden.data,false);
});

test('missing native garden rows stay not_initialized, not invented as empty plots',async()=>{
 const f=fixture();f.db.garden.pop();
 const n=normalizeBundle(await read(f,A,['garden']));
 assert.deepEqual(n.sections.garden,{state:'not_initialized'});
});

test('cross-owner ORM corruption and SQL failure both suppress previously read sensitive sections',async()=>{
 for(const failure of ['foreign','sql']){
  const f=fixture();
  if(failure==='foreign'){f.homeA.ownerId=2;f.issues.forceCrossOwner=true;}
  else f.issues.throwTable='slots';
  const raw=await read(f,A,['property','chest']);
  assert.deepEqual(raw,{state:'unavailable'});
  assert.deepEqual(normalizeBundle(raw),{state:'unavailable'});
 }
});

test('a legacy plant quantity over capacity passes; negatives are rejected',async()=>{
 const raw=await read(fixture(),A,['garden']);
 assert.equal(normalizeBundle(raw).state,'ready');
 assert.equal(raw.sections.garden.data.plantStorage.at(-1).quantity,9);
 raw.sections.garden.data.plantStorage.at(-1).quantity=-1;
 assert.deepEqual(normalizeBundle(raw),{state:'unavailable'});
});

test('a malformed native food id, duplicate, or corrupt item detail invalidates the entire projection',async()=>{
 const base=await read(fixture());
 for(const modify of [
  x=>x.sections.pantry.packet.foods[0].id='grain',
  x=>x.sections.pantry.packet.foods[1].id='commonFood',
  x=>x.sections.chest.data.chestItems[0].details.itemCategory=1,
  x=>x.sections.property.data.apartments[0].isRented='yes'
 ]){
  const bad=structuredClone(base);modify(bad);
  assert.deepEqual(normalizeBundle(bad),{state:'unavailable'});
 }
});

test('no section not requested can be serialized, including on an errored or restricted response',async()=>{
 const f=fixture();f.a.city='elsewhere';
 const raw=await read(f,A,['chest']);
 const view=normalizeBundle(raw);
 assert.deepEqual(Object.keys(view.sections),['chest']);
 assert.deepEqual(view.sections.chest,{state:'restricted'});
 assert.ok(!JSON.stringify(view).includes('42'));
 assert.deepEqual(normalizeBundle({state:'unavailable',sections:{property:{state:'ready',data:{home:{cityId:'secret'}}}}}),{state:'unavailable'});
});
