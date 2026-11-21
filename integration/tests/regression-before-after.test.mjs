import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {fixture as newFixture,A,NOW} from '../cp035/tests/native-fixture.mjs';
import {fixture as oldFixture} from '../cp035/tests/original-fixture.mjs';
const require=createRequire(import.meta.url);
const oldAdapter=require('../work/contract-adapter-before.cjs');
const newAdapter=require('../overlay/contract-adapter.js');
test('pre-CP039 adapter rejects a genuine shaped candidate bundle while the patched adapter accepts it',async()=>{
 const f=newFixture(),raw=await f.readPortalSectionsForServer(A,f.tx,['pet','garden','property','chest','pantry'],new Date(NOW));
 assert.equal(raw.state,'ready');assert.equal(oldAdapter.normalizeBundle(raw).state,'unavailable');
 assert.equal(newAdapter.normalizeBundle(raw).state,'ready');
});
test('original companion candidate relies on divergent object-value order; patch preserves canonical PET_FOOD_BY_ID',async()=>{
 const old=oldFixture(),next=newFixture();
 const oldPantry=await old.readPortalSectionsForServer(A,old.tx,['pantry'],new Date(NOW));
 const newPantry=await next.readPortalSectionsForServer(A,next.tx,['pantry'],new Date(NOW));
 assert.equal(oldPantry.sections.pantry.state,'ready');assert.equal(newPantry.sections.pantry.state,'ready');
 const oldPairs=Object.fromEntries(oldPantry.sections.pantry.packet.foods.map(x=>[x.id,x.maxAmount]));
 const newPairs=Object.fromEntries(newPantry.sections.pantry.packet.foods.map(x=>[x.id,x.maxAmount]));
 assert.equal(oldPairs.herbivorousFood,21);assert.equal(oldPairs.carnivorousFood,11);
 assert.equal(newPairs.herbivorousFood,11);assert.equal(newPairs.carnivorousFood,21);
});
