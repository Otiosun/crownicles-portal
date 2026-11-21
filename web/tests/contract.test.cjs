'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {normalizeBundle}=require('../contract-adapter.js');
const safe=()=>({state:'ready',version:1,sections:{
 pet:{state:'ready',packet:{pet:{typeId:7,nickname:'Lume',sex:'f',rarity:2,loveLevel:4,force:12},hasTalisman:true}},
 garden:{state:'ready',data:{homeLevel:3,totalPlots:2,accessMode:'full',plots:[
  {slot:0,plantId:0,growthProgress:0,isReady:false,readyAtTimestamp:0},
  {slot:1,plantId:3,growthProgress:0.64,isReady:false,readyAtTimestamp:1795212000}
 ],plantStorage:[{plantId:3,quantity:2,maxCapacity:5}],seedPlantId:2,wateringAvailableAt:null}},
 property:{state:'ready',data:{home:{cityId:'city-A',level:3,chestSlots:{weapon:1,armor:1,object:1,potion:1},cookingSlots:2,gardenPlots:2,bedHealthRegeneration:3},apartments:[{apartmentId:17,cityId:'city-A',mapLocationId:111,purchasePrice:3000,accumulatedRent:212,isRented:true,canClaim:true}],minRentToClaim:100}},
 chest:{state:'ready',data:{homeCityId:'city-A',accessibleFromCityId:'city-A',accessMode:'main_home',slotsPerCategory:{weapon:1,armor:1,potion:1,object:1},chestItems:[{slot:1,category:2,details:{id:4,itemCategory:2,rarity:1,nature:1,power:2,maxPower:3,usages:2,maxUsages:2,secret:'SHOULD_NOT_LEAK'}}]}},
 pantry:{state:'ready',packet:{guildName:'Guild demo',foods:[{id:'commonFood',amount:3,maxAmount:8}]}}
}});
const clone=x=>structuredClone(x);
test('accepts all five CP035 sections, whitelists fields and preserves time units',()=>{
 const original=safe(),normalized=normalizeBundle(original);
 assert.equal(normalized.state,'ready');assert.equal(Object.keys(normalized.sections).length,5);
 assert.equal(normalized.sections.garden.data.plots[1].readyAtTimestamp,1795212000);
 assert.equal(normalized.sections.garden.data.wateringAvailableAt,null);
 assert.equal(normalized.sections.chest.data.chestItems[0].details.secret,undefined);
 normalized.sections.chest.data.chestItems[0].details.id=91;
 assert.equal(original.sections.chest.data.chestItems[0].details.id,4);
});
test('preserves non-ready states without stale data or arbitrary reason',()=>{
 const raw=safe();raw.sections.pet={state:'restricted',packet:{pet:{nickname:'private'}}};
 raw.sections.property={state:'not_initialized',data:raw.sections.property.data};
 const normalized=normalizeBundle(raw);assert.equal(normalized.state,'ready');
 assert.deepEqual(normalized.sections.pet,{state:'restricted'});
 assert.deepEqual(normalized.sections.property,{state:'not_initialized'});
});
test('unavailable root never contains any section',()=>{
 const r=normalizeBundle({state:'unavailable',sections:{property:{state:'ready',data:safe().sections.property.data}}});
 assert.deepEqual(r,{state:'unavailable'});
});
test('rejects malformed root, unknown fields, unknown section, unknown version',()=>{
 const inputs=[null,undefined,[],{},'text',{state:'ready',version:2,sections:{}},{state:'ready',version:1,sections:[]},
 {state:'ready',version:1,sections:{thief:{state:'ready'}}},{state:'ready',version:1,sections:{pet:{state:'fake'}}}];
 for(const raw of inputs)assert.equal(normalizeBundle(raw).state,'unavailable');
});
test('rejects duplicate garden slot, missing slot, overflowed growth and invalid timestamp',()=>{
 for(const mutate of [
  x=>x.sections.garden.data.plots[1].slot=0,
  x=>x.sections.garden.data.totalPlots=3,
  x=>x.sections.garden.data.plots[1].growthProgress=1.01,
  x=>x.sections.garden.data.plots[1].readyAtTimestamp=-1,
  x=>x.sections.garden.data.seedPlantId=55,
  x=>x.sections.garden.data.wateringAvailableAt='today']){
  const x=safe();mutate(x);assert.equal(normalizeBundle(x).state,'unavailable');
 }
});
test('rejects duplicate apartments, invalid rent claim, negative prices and invalid city',()=>{
 for(const mutate of [
  x=>x.sections.property.data.apartments.push(clone(x.sections.property.data.apartments[0])),
  x=>x.sections.property.data.apartments[0].isRented=false,
  x=>x.sections.property.data.apartments[0].accumulatedRent=10,
  x=>x.sections.property.data.apartments[0].purchasePrice=-1,
  x=>x.sections.property.data.home.cityId='',
  x=>x.sections.property.data.home.chestSlots.weapon=-3]){
  const x=safe();mutate(x);assert.equal(normalizeBundle(x).state,'unavailable');
 }
});
test('accepts player with no home and no apartments without inventing property',()=>{
 const x=safe();x.sections.property.data.home=null;x.sections.property.data.apartments=[];
 const r=normalizeBundle(x);assert.equal(r.state,'ready');assert.equal(r.sections.property.data.home,null);assert.deepEqual(r.sections.property.data.apartments,[]);
});
test('rejects chest overflow, duplicate slot and item category mismatch',()=>{
 for(const mutate of [
  x=>x.sections.chest.data.chestItems.push(clone(x.sections.chest.data.chestItems[0])),
  x=>x.sections.chest.data.chestItems[0].slot=3,
  x=>x.sections.chest.data.chestItems[0].details.itemCategory=0,
  x=>x.sections.chest.data.chestItems[0].details.power=Infinity]){
  const x=safe();mutate(x);assert.equal(normalizeBundle(x).state,'unavailable');
 }
});
test('rejects pantry overflow and duplicate food IDs',()=>{
 const x=safe();x.sections.pantry.packet.foods[0].amount=15;assert.equal(normalizeBundle(x).state,'unavailable');
 const y=safe();y.sections.pantry.packet.foods.push(clone(y.sections.pantry.packet.foods[0]));assert.equal(normalizeBundle(y).state,'unavailable');
});
test('does not interpolate or execute strings and does not propagate unknown packet fields',()=>{
 const x=safe();x.sections.pet.packet.pet.nickname='<img src=x onerror=alert(1)>';
 x.sections.pet.packet.pet.phone='PERSONAL_DATA';
 const r=normalizeBundle(x);assert.equal(r.state,'ready');assert.equal(r.sections.pet.packet.pet.nickname,'<img src=x onerror=alert(1)>');
 assert.equal(r.sections.pet.packet.pet.phone,undefined);
});

test('exception from a hostile accessor fails closed, not an uncaught crash',()=>{
 const raw=safe();Object.defineProperty(raw.sections,'pet',{get(){throw Error('hostile getter')}});
 assert.equal(normalizeBundle(raw).state,'unavailable');
});
test('no hidden data is serialized for partial or restricted query sections',()=>{
 const raw=safe();raw.sections.garden={state:'restricted',data:raw.sections.garden.data};
 const out=normalizeBundle(raw);
 assert.equal(out.sections.garden.data,undefined);
 assert.equal(JSON.stringify(out).includes('1795212000'),false);
});
