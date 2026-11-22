import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeNativeP0Read} from '../../integration/p0/native-projection.mjs';

const stat=()=>({baseValue:1,upgradeValue:0,maxValue:5});
const item=(category,id)=>category<2?
 {id,itemCategory:category,rarity:1,itemLevel:1,attack:stat(),defense:stat(),speed:stat()}:
 {id,itemCategory:category,rarity:1,nature:1,power:1,maxPower:5};
const specs=[['weapon','weapons','backupWeapons',0],['armor','armors','backupArmors',1],['potion','potions','backupPotions',2],['object','objects','backupObjects',3]];
function source(){
 const data={slots:{weapons:1,armors:1,potions:1,objects:1},materials:[]};
 for(const [k,_plural,backup,cat] of specs){data[k]=item(cat,0);data[backup]=[];}
 return {foundPlayer:true,data};
}
let seed=0xC042BA5E;
function rand(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;}
const read=x=>normalizeNativeP0Read('inventory',{state:'ready',packet:x});

test('seeded 2,000 reserve/capacity permutations agree with the native slot boundary in all categories',()=>{
 for(let i=0;i<2000;i++){
  const [k,plural,backup,cat]=specs[rand()%4];
  const capacity=1+rand()%25;
  const slot=rand()%32;
  const x=source();x.data.slots[plural]=capacity;x.data[backup]=[{slot,display:item(cat,7)}];
  const expected=slot>0&&slot<capacity?'ready':'unavailable';
  assert.equal(read(x).state,expected,[k,capacity,slot].join(':'));
 }
});
test('a hostile owner marker nested in any category cannot emerge in projected data',()=>{
 for(const [k,plural,backup,cat] of specs){
  const x=source();x.keycloakId='SECRET_ACTOR_A';x.data.slots[plural]=3;
  x.data[k].internalOwner='SECRET_ACTOR_A';
  x.data[backup]=[{slot:1,display:{...item(cat,7),internalOwner:'SECRET_ACTOR_B'}}];
  const result=read(x);assert.equal(result.state,'ready',k);
  assert.ok(!JSON.stringify(result).includes('SECRET_'),k);
 }
});
test('reused projector cannot retain A data after B becomes restricted',()=>{
 for(let i=0;i<120;i++){
  const x=source();x.data.weapon.id=7;
  const first=read(x);assert.equal(first.state,'ready');
  const second=normalizeNativeP0Read('inventory',{state:'restricted',packet:x,privateRow:'SECRET_ACTOR_A'});
  assert.deepEqual(second,{state:'restricted'});
  assert.ok(!JSON.stringify(second).includes('SECRET_'));
 }
});
