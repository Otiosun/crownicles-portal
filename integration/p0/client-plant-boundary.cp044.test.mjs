import test from 'node:test';
import assert from 'node:assert/strict';
import {isProjectedP0} from './projection-guard.mjs';

// CP044: validate ALREADY projected DTOs; not session authorization.
const maximum={kind:'value',value:1};
const attr={baseValue:1,upgradeValue:0,maximum};
const main=c=>({id:0,rarity:0,itemCategory:c,itemLevel:0,attack:attr,defense:attr,speed:attr});
const support=c=>({id:0,rarity:0,itemCategory:c,nature:0,power:1,maximumPower:maximum});
const names=['weapon','armor','potion','object'];
function inventory(){
 return {categories:names.map((category,i)=>({category,capacity:1,
  active:i<2?main(i):support(i),reserves:[]})),
  materials:[],talismans:{kind:'not_reported'},plants:{kind:'reported',seed:1,
   plantSlots:[{plantId:1,slot:0}],maxPlantSlots:1,linkedToHomeStorage:false}};
}
test('CP044 projected plant slots require 0 <= slot < maxPlantSlots',()=>{
 for(const cap of [1,2,3])for(const slot of [0,1,2,3,4,9000]){
  const d=inventory();d.plants.maxPlantSlots=cap;d.plants.plantSlots=[{plantId:1,slot}];
  assert.equal(isProjectedP0('inventory',d),slot<cap,`capacity=${cap} slot=${slot}`);
 }
});
test('CP044 projected plant ID and seed ID range is 1..10',()=>{
 for(const field of ['seed','plantId'])for(const id of [0,1,10,11,9000]){
  const d=inventory();if(field==='seed')d.plants.seed=id;else d.plants.plantSlots[0].plantId=id;
  assert.equal(isProjectedP0('inventory',d),id>=1&&id<=10,`${field}=${id}`);
 }
});
test('CP044 projected maxPlantSlots uses canonical MAX_PLANT_SLOTS=3',()=>{
 for(const cap of [0,1,2,3,4,9000]){
  const d=inventory();d.plants.maxPlantSlots=cap;
  assert.equal(isProjectedP0('inventory',d),cap>=1&&cap<=3,`cap=${cap}`);
 }
});
test('CP044 valid three 0-based positions and optional seed survive',()=>{
 const d=inventory();d.plants.maxPlantSlots=3;delete d.plants.seed;
 d.plants.plantSlots=[{plantId:1,slot:0},{plantId:2,slot:1},{plantId:10,slot:2}];
 assert.equal(isProjectedP0('inventory',d),true);
});
test('CP044 duplicate slots and fourth item rejected',()=>{
 const d=inventory();d.plants.maxPlantSlots=2;
 d.plants.plantSlots=[{plantId:1,slot:0},{plantId:2,slot:0}];
 assert.equal(isProjectedP0('inventory',d),false);
 d.plants.maxPlantSlots=3;d.plants.plantSlots=[0,1,2,2].map(slot=>({plantId:1,slot}));
 assert.equal(isProjectedP0('inventory',d),false);
});
test('CP044 not_reported remains legitimate and never invents data',()=>{
 const d=inventory();d.plants={kind:'not_reported'};
 assert.equal(isProjectedP0('inventory',d),true);
 d.plants={kind:'not_reported',maxPlantSlots:0};
 assert.equal(isProjectedP0('inventory',d),false);
});
test('CP044 optional talisman booleans remain independently reportable',()=>{
 const d=inventory();d.talismans={kind:'reported',clone:false};
 assert.equal(isProjectedP0('inventory',d),true);
 d.talismans={kind:'reported',expedition:true};
 assert.equal(isProjectedP0('inventory',d),true);
});
