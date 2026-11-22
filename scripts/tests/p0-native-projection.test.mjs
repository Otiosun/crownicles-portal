import test from 'node:test';
import assert from 'node:assert/strict';
import {projectInventory,projectProfile,normalizeNativeP0Read} from '../../integration/p0/native-projection.mjs';

const stat=(v,up=0,max=10)=>({baseValue:v,upgradeValue:up,maxValue:max});
const main=(id,cat)=>({id,itemCategory:cat,rarity:1,itemLevel:1,attack:stat(3,0,10),defense:stat(0),speed:stat(1)});
const support=(id,cat)=>({id,itemCategory:cat,rarity:1,nature:1,power:1,maxPower:10});
const inventory=()=>({foundPlayer:true,keycloakId:'PRIVATE_PLAYER_A',data:{
  weapon:main(0,0),armor:main(2,1),potion:support(0,2),object:support(0,3),
  backupWeapons:[{slot:1,display:main(7,0)}],backupArmors:[],backupPotions:[],backupObjects:[],
  slots:{weapons:2,armors:1,potions:1,objects:1},materials:[{materialId:1,quantity:3}],
  plants:{seed:2,plantSlots:[{plantId:3,slot:1}],maxPlantSlots:2,linkedToHomeStorage:false}
}});
const profile=()=>({keycloakId:'PRIVATE_PLAYER_A',playerData:{
  level:15,health:{value:9,max:10},experience:{value:1,max:20},money:15,
  badges:['rich'],missions:{gems:0,campaignProgression:25},
  rank:{rank:-1,unranked:true,numberOfPlayers:5,score:2},
  effect:{effect:'sleeping',healed:true,timeLeft:-1000,hasTimeDisplay:true},
  kingChallengeTier:0,classId:0,pet:{typeId:2,sex:'f',rarity:1,nickname:'Lumi'}
}});

test('the P0 inventory projection preserves canonical active item ID 0 and per-slot reserves',()=>{
 const p=projectInventory(inventory());
 assert.equal(p.categories[0].active.id,0);
 assert.equal(p.categories[2].active.id,0);
 assert.equal(p.categories[0].reserves[0].slot,1);
 assert.equal(p.categories[0].reserves[0].display.id,7);
 assert.equal(p.categories[0].capacity,2);
 assert.equal(p.categories[0].category,'weapon');
});
test('a reserve slot outside the category capacity must fail closed',()=>{
 for(const badSlot of [2,3,17,9000]){
  const source=inventory();source.data.backupWeapons[0].slot=badSlot;
  assert.throws(()=>projectInventory(source),undefined,String(badSlot));
  assert.deepEqual(normalizeNativeP0Read('inventory',{state:'ready',packet:source}),{state:'unavailable'});
 }
});
test('a reservation is invalid when category capacity is one (only equipped slot zero)',()=>{
 const source=inventory();source.data.slots.weapons=1;
 assert.deepEqual(normalizeNativeP0Read('inventory',{state:'ready',packet:source}),{state:'unavailable'});
});
test('noncontiguous reserve slots remain legal when both fit capacity',()=>{
 const source=inventory();source.data.slots.weapons=5;source.data.backupWeapons[0].slot=4;
 assert.equal(projectInventory(source).categories[0].reserves[0].slot,4);
});
test('duplicate slot positions and empty reserve ID zero fail closed',()=>{
 const source=inventory();source.data.backupWeapons.push({slot:1,display:main(8,0)});
 assert.deepEqual(normalizeNativeP0Read('inventory',{state:'ready',packet:source}),{state:'unavailable'});
 const other=inventory();other.data.backupWeapons[0].display.id=0;
 assert.deepEqual(normalizeNativeP0Read('inventory',{state:'ready',packet:other}),{state:'unavailable'});
});
test('inventories strip all internal identifiers and arbitrary nested fields',()=>{
 const source=inventory();source.otherSecret='PRIVATE_TOKEN';source.data.weapon.ownerId='PRIVATE_OWNER';
 const output=normalizeNativeP0Read('inventory',{state:'ready',packet:source});
 assert.equal(output.state,'ready');
 assert.ok(!JSON.stringify(output).includes('PRIVATE_'));
 assert.ok(!JSON.stringify(output).includes('ownerId'));
});
test('maximum Infinity is represented explicitly as unbounded, not null',()=>{
 const source=inventory();source.data.weapon.speed.maxValue=Infinity;
 const o=normalizeNativeP0Read('inventory',{state:'ready',packet:source});
 assert.deepEqual(o.data.categories[0].active.speed.maximum,{kind:'unbounded'});
});
test('plants not reported remain distinct from an empty reported garden',()=>{
 const source=inventory();delete source.data.plants;
 assert.deepEqual(projectInventory(source).plants,{kind:'not_reported'});
});
test('profile includes native sentinel rank -1, effect timeLeft negative, optional classId zero',()=>{
 const p=projectProfile(profile());
 assert.equal(p.rank.rank,-1);assert.equal(p.rank.unranked,true);
 assert.equal(p.effect.timeLeft,-1000);assert.equal(p.classId,0);
});
test('profile never forwards keycloakId or arbitrary packet metadata',()=>{
 const source=profile();source.playerData.debug='PRIVATE_PROFILE';source.playerData.health.secret='PRIVATE_HEALTH';
 const o=normalizeNativeP0Read('profile',{state:'ready',packet:source});
 assert.equal(o.state,'ready');assert.ok(!JSON.stringify(o).includes('PRIVATE_'));
});
test('missing mandatory fields fail closed and do not fabricate defaults',()=>{
 for(const key of ['level','health','experience','money','badges','missions','rank','effect','kingChallengeTier']){
  const source=profile();delete source.playerData[key];
  assert.deepEqual(normalizeNativeP0Read('profile',{state:'ready',packet:source}),{state:'unavailable'},key);
 }
});
test('optional native fields omitted stay omitted',()=>{
 const source=profile();delete source.playerData.classId;delete source.playerData.pet;
 const o=normalizeNativeP0Read('profile',{state:'ready',packet:source});
 assert.equal(o.state,'ready');assert.ok(!('classId' in o.data));assert.ok(!('pet' in o.data));
});
test('restricted, not_initialized and unavailable states never expose stale packets',()=>{
 for(const state of ['restricted','not_initialized','unavailable']){
  const o=normalizeNativeP0Read('inventory',{state,packet:inventory(),secret:'PRIVATE_DUMP'});
  assert.deepEqual(o,{state});assert.ok(!JSON.stringify(o).includes('PRIVATE_'));
 }
});
test('invalid states, sections and malformed data are always unavailable',()=>{
 for(const state of ['absent','ok',null,undefined,'ready']){
  const result=normalizeNativeP0Read('profile',{state,packet:null});
  assert.deepEqual(result,{state:'unavailable'});
 }
 for(const section of ['chest','pet','__proto__',undefined]){
  assert.deepEqual(normalizeNativeP0Read(section,{state:'ready',packet:profile()}),{state:'unavailable'});
 }
});
test('hostile getters fail closed instead of escaping the projector',()=>{
 const hostile={state:'ready',get packet(){throw Error('PRIVATE_THROW');}};
 assert.deepEqual(normalizeNativeP0Read('profile',hostile),{state:'unavailable'});
});
test('input source objects remain unchanged during projection',()=>{
 const source=inventory(),before=structuredClone(source);
 projectInventory(source);assert.deepEqual(source,before);
});
test('P0 projector is pure and exposes no HTTP server, session or data mutators',async()=>{
 const m=await import('../../integration/p0/native-projection.mjs');
 assert.deepEqual(Object.keys(m).sort(),['normalizeNativeP0Read','projectInventory','projectProfile']);
});

test('independently optional talisman flags stay absent rather than becoming false',()=>{
 const source=inventory();source.hasTalisman=true;
 const result=projectInventory(source);
 assert.deepEqual(result.talismans,{kind:'reported',expedition:true});
 assert.ok(!Object.hasOwn(result.talismans,'clone'));
});
test('all three reported talisman flags retain each boolean independently',()=>{
 const source=inventory();source.hasTalisman=false;source.hasCloneTalisman=true;source.hasRemoteHarvestTalisman=false;
 assert.deepEqual(projectInventory(source).talismans,{kind:'reported',expedition:false,clone:true,remoteHarvest:false});
});
