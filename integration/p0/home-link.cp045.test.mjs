import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeNativeP0Read} from './native-projection.mjs';
import {isProjectedP0} from './projection-guard.mjs';

// Native rule: isPlantInventoryLinkedToHome in PlantDeliveryUtils requires
// PlantConstants.hasHomeStorageLink(plantSlots) >= MAX_PLANT_SLOTS=3,
// AND a real home with garden storage capacity. The DTO only contains the
// boolean and slot count, so it can reject impossible TRUE for counts 1-2.
const a=()=>({baseValue:1,upgradeValue:0,maxValue:1});
const m=(itemCategory)=>({id:0,rarity:1,itemCategory,itemLevel:0,attack:a(),defense:a(),speed:a()});
const s=(itemCategory)=>({id:0,rarity:1,itemCategory,nature:1,power:1,maxPower:1});
const packet=()=>({foundPlayer:true,data:{weapon:m(0),armor:m(1),potion:s(2),object:s(3),
 backupWeapons:[],backupArmors:[],backupPotions:[],backupObjects:[],
 slots:{weapons:1,armors:1,potions:1,objects:1},materials:[],
 plants:{plantSlots:[{plantId:1,slot:0}],maxPlantSlots:1,linkedToHomeStorage:false}}});
const projected=(p)=>normalizeNativeP0Read('inventory',{state:'ready',packet:p});

test('CP045 native: home plant link cannot be true for capacity 1 or 2',()=>{
 for(const capacity of [1,2]){
  const p=packet();p.data.plants.maxPlantSlots=capacity;
  p.data.plants.linkedToHomeStorage=true;
  assert.deepEqual(projected(p),{state:'unavailable'},'plantSlots '+capacity);
 }
});
test('CP045 guard: reject linkedToHomeStorage=true when capacity 1 or 2',()=>{
 for(const capacity of [1,2]){
  const p=packet();p.data.plants.maxPlantSlots=capacity;
  const result=projected(p);
  assert.equal(result.state,'ready');
  result.data.plants.linkedToHomeStorage=true;
  assert.equal(isProjectedP0('inventory',result.data),false);
 }
});
test('CP045 max capacity 3 may link to a home, but should not be forced to true',()=>{
 for(const flag of [true,false]){
  const p=packet();p.data.plants.maxPlantSlots=3;
  p.data.plants.linkedToHomeStorage=flag;
  const result=projected(p);
  assert.equal(result.state,'ready');
  assert.equal(result.data.plants.linkedToHomeStorage,flag);
  assert.equal(isProjectedP0('inventory',result.data),true);
 }
});
test('CP045 missing or nonboolean link remains unavailable, not coerced',()=>{
 const p=packet();p.data.plants.linkedToHomeStorage=1;
 assert.deepEqual(projected(p),{state:'unavailable'});
 p.data.plants.linkedToHomeStorage=false;
 const result=projected(p);result.data.plants.linkedToHomeStorage=1;
 assert.equal(isProjectedP0('inventory',result.data),false);
});
