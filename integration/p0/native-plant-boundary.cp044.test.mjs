import test from 'node:test';
import assert from 'node:assert/strict';
import {projectInventory} from './native-projection.mjs';

// CP044: synthetic projection fixtures; source bounds pinned to
// Core PlayerPlantSlots.initializeSlots (0..max-1), PlantConstants
// DEFAULT_PLANT_SLOTS=1, MAX_PLANT_SLOTS=3, PlantId=1..10.
const attr={baseValue:1,upgradeValue:0,maxValue:1};
const main=c=>({id:0,itemCategory:c,rarity:0,itemLevel:0,attack:attr,defense:attr,speed:attr});
const support=c=>({id:0,itemCategory:c,rarity:0,nature:0,power:1,maxPower:1});
function raw(){
 return {foundPlayer:true,data:{weapon:main(0),armor:main(1),potion:support(2),object:support(3),
  backupWeapons:[],backupArmors:[],backupPotions:[],backupObjects:[],
  slots:{weapons:1,armors:1,potions:1,objects:1},materials:[],
  plants:{seed:1,plantSlots:[{plantId:1,slot:0}],maxPlantSlots:1,linkedToHomeStorage:false}}};
}
test('CP044 native slots reject every index outside capacity 1,2,3',()=>{
 for(const cap of [1,2,3])for(const slot of [0,1,2,3,4,9000]){
  const r=raw();r.data.plants.maxPlantSlots=cap;r.data.plants.plantSlots=[{plantId:1,slot}];
  if(slot<cap)assert.equal(projectInventory(r).plants.plantSlots[0].slot,slot);
  else assert.throws(()=>projectInventory(r),/invalid projection source/);
 }
});
test('CP044 native plant/seed IDs are exactly 1..10',()=>{
 for(const field of ['seed','plantId'])for(const id of [0,1,10,11,999]){
  const r=raw();
  if(field==='seed')r.data.plants.seed=id;else r.data.plants.plantSlots[0].plantId=id;
  if(id>=1&&id<=10)assert.equal(projectInventory(r).plants.kind,'reported');
  else assert.throws(()=>projectInventory(r),/invalid projection source/);
 }
});
test('CP044 native maxPlantSlots is 1..3, not arbitrary integer',()=>{
 for(const cap of [0,1,2,3,4,999]){const r=raw();r.data.plants.maxPlantSlots=cap;
  if(cap>=1&&cap<=3)assert.equal(projectInventory(r).plants.maxPlantSlots,cap);
  else assert.throws(()=>projectInventory(r),/invalid projection source/);
 }
});
test('CP044 preserves valid 0-based positions and optional seed',()=>{
 const r=raw();r.data.plants.maxPlantSlots=3;
 r.data.plants.plantSlots=[{plantId:1,slot:0},{plantId:2,slot:1},{plantId:10,slot:2}];
 delete r.data.plants.seed;
 const p=projectInventory(r);
 assert.deepEqual(p.plants.plantSlots.map(x=>x.slot),[0,1,2]);
 assert.equal(Object.hasOwn(p.plants,'seed'),false);
 assert.equal(p.categories[0].active.id,0);
});
test('CP044 absence stays not_reported; no invented plants',()=>{
 const r=raw();delete r.data.plants;
 assert.deepEqual(projectInventory(r).plants,{kind:'not_reported'});
});
test('CP044 duplicate native plant positions are rejected',()=>{
 const r=raw();r.data.plants.maxPlantSlots=2;
 r.data.plants.plantSlots=[{plantId:1,slot:0},{plantId:2,slot:0}];
 assert.throws(()=>projectInventory(r),/invalid projection source/);
});
