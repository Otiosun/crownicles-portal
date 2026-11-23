/** CP043 future integration gate. Requires CP042 source to enforce P0 compatibility.
 * In isolated PR #12, reports an explicit skip; when CP042 is added/merged,
 * the cases execute automatically. CP042_REQUIRED=1 makes missing source fail. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {isProjectedP0} from './projection-guard.mjs';

const cp042Url=new URL('./native-projection.mjs',import.meta.url);
const available=existsSync(fileURLToPath(cp042Url));
if(!available){
 test('CP043-INTEROP: CP042 native projection is required for integrated checks',{
  skip:process.env.CP042_REQUIRED==='1'?false:'CP042 not present on isolated PR #12; stack PR #11 or use CP042_REQUIRED=1'
 },()=>assert.fail('CP042_REQUIRED_BUT_MISSING'));
}else{
 const {normalizeNativeP0Read}=await import(cp042Url.href);
 const stat=()=>({baseValue:1,upgradeValue:0,maxValue:8});
 const main=(category,id=0)=>({id,rarity:1,itemCategory:category,itemLevel:0,attack:stat(),defense:stat(),speed:stat()});
 const support=(category,id=0)=>({id,rarity:1,itemCategory:category,nature:1,power:1,maxPower:8});
 const fixture=()=>({foundPlayer:true,data:{
  weapon:main(0),armor:main(1),potion:support(2),object:support(3),
  backupWeapons:[{slot:1,display:main(0,7)}],backupArmors:[],backupPotions:[],backupObjects:[],
  slots:{weapons:2,armors:1,potions:1,objects:1},materials:[],
  plants:{seed:5,maxPlantSlots:2,plantSlots:[{plantId:2,slot:1}],linkedToHomeStorage:false}
 }});
 const project=p=>normalizeNativeP0Read('inventory',{state:'ready',packet:p});
 test('CP043-INTEROP valid CP042 DTO with partial talismans passes client guard',()=>{
  const p=fixture();p.hasTalisman=true;const out=project(p);
  assert.equal(out.state,'ready');assert.equal(isProjectedP0('inventory',out.data),true);
  assert.deepEqual(out.data.talismans,{kind:'reported',expedition:true});
 });
 test('CP043-INTEROP reservation exceeding capacity denied by server projection and client guard',()=>{
  const p=fixture();p.data.backupWeapons[0].slot=2;
  assert.deepEqual(project(p),{state:'unavailable'});
  p.data.backupWeapons[0].slot=1;const out=project(p);out.data.categories[0].reserves[0].slot=2;
  assert.equal(isProjectedP0('inventory',out.data),false);
 });
 test('CP043-INTEROP plant slot exceeding maxPlantSlots denied at both stages',()=>{
  const p=fixture();p.data.plants.plantSlots[0].slot=2;
  assert.deepEqual(project(p),{state:'unavailable'});
  p.data.plants.plantSlots[0].slot=1;const out=project(p);out.data.plants.plantSlots[0].slot=2;
  assert.equal(isProjectedP0('inventory',out.data),false);
 });
 test('CP045-INTEROP zero plant capacity is rejected by native projection and client guard',()=>{
  const p=fixture();p.data.plants.maxPlantSlots=0;p.data.plants.plantSlots=[];
  const out=project(p);assert.deepEqual(out,{state:'unavailable'});
  p.data.plants.maxPlantSlots=1;const ready=project(p);
  ready.data.plants.maxPlantSlots=0;
  assert.equal(isProjectedP0('inventory',ready.data),false);
 });
 test('CP043-INTEROP no private owner or session identifiers leak through projected data',()=>{
  const p=fixture();p.keycloakId='PRIVATE_ACTOR';p.data.weapon.ownerId='PRIVATE_OWNER';
  const out=project(p);assert.equal(out.state,'ready');assert.equal(isProjectedP0('inventory',out.data),true);
  assert.ok(!JSON.stringify(out.data).includes('PRIVATE_'));
 });
}
