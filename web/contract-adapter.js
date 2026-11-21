/* CP038: pure, fail-closed client projection of CP035 version-1 READ-ONLY responses.
 * Not authorization. Never accepts an ID to fetch or performs HTTP/DB calls.
 * Does not make the CP035 candidate a certified endpoint. */
(function(root, factory){
 const api=factory();
 if(typeof module==='object' && module.exports) module.exports=api;
 else root.PortalContract=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const sections=['pet','garden','property','chest','pantry'];
 // Official PetConstants.PET_FOOD identifiers (string).
 const foodIds=new Set(['commonFood','carnivorousFood','herbivorousFood','ultimateFood']);
 const states=['ready','absent','restricted','not_initialized'];
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const int=(v,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
 const positive=(v,max)=>int(v,max)&&v>0;
 const str=(v,max=160)=>typeof v==='string'&&v.length>0&&v.length<=max&&![...v].some(c=>c<' ');
 const optionalStr=(v,max)=>v===undefined||v===null||str(v,max);
 const limited=(v,max)=>Array.isArray(v)&&v.length<=max;
 const bool=x=>typeof x==='boolean';
 const fail=()=>({state:'unavailable'});
 const categoryCaps=x=>object(x)&&['weapon','armor','potion','object'].every(k=>int(x[k],2000))?
  {weapon:x.weapon,armor:x.armor,potion:x.potion,object:x.object}:null;
 function pet(packet){
  if(!object(packet)||!object(packet.pet))return null;
  const p=packet.pet;
  if(!positive(p.typeId,10000)||!int(p.rarity,30)||!int(p.loveLevel,100000)||!int(p.force,10000000)||
   !optionalStr(p.nickname,100)||!str(p.sex,16)||!(packet.hasTalisman===undefined||bool(packet.hasTalisman)))return null;
  if(packet.expeditionInProgress!==undefined&&!object(packet.expeditionInProgress))return null;
  return {pet:{typeId:p.typeId,nickname:p.nickname??'',rarity:p.rarity,sex:p.sex,loveLevel:p.loveLevel,force:p.force},
   ...(packet.hasTalisman===undefined?{}:{hasTalisman:packet.hasTalisman}),
   ...(packet.expeditionInProgress===undefined?{}:{expeditionInProgress:{present:true}})};
 }
 function garden(data){
  if(!object(data)||!positive(data.homeLevel,20)||!positive(data.totalPlots,30)||!['full','readOnly'].includes(data.accessMode)||
   !limited(data.plots,30)||data.plots.length!==data.totalPlots||!limited(data.plantStorage,20)||!int(data.seedPlantId,10)||
   !(data.wateringAvailableAt===null||int(data.wateringAvailableAt)))return null;
  const ids=new Set(),stored=new Set(),plots=[],storage=[];
  for(const p of data.plots){
   if(!object(p)||!int(p.slot,30)||p.slot>=data.totalPlots||ids.has(p.slot)||!int(p.plantId,10)||
     typeof p.growthProgress!=='number'||!Number.isFinite(p.growthProgress)||p.growthProgress<0||p.growthProgress>1||
     !bool(p.isReady)||!int(p.readyAtTimestamp))return null;
   ids.add(p.slot); plots.push({slot:p.slot,plantId:p.plantId,growthProgress:p.growthProgress,isReady:p.isReady,readyAtTimestamp:p.readyAtTimestamp});
  }
  for(const s of data.plantStorage){
   if(!object(s)||!positive(s.plantId,10)||stored.has(s.plantId)||!int(s.quantity)||!int(s.maxCapacity))return null;
   stored.add(s.plantId);storage.push({plantId:s.plantId,quantity:s.quantity,maxCapacity:s.maxCapacity});
  }
  return {homeLevel:data.homeLevel,totalPlots:data.totalPlots,accessMode:data.accessMode,plots:plots.sort((a,b)=>a.slot-b.slot),
   plantStorage:storage.sort((a,b)=>a.plantId-b.plantId),seedPlantId:data.seedPlantId,wateringAvailableAt:data.wateringAvailableAt};
 }
 function property(data){
  if(!object(data)||!limited(data.apartments,100)||!int(data.minRentToClaim))return null;
  let home=null;
  if(data.home!==null){
   const h=data.home;if(!object(h)||!str(h.cityId,128)||!positive(h.level,20)||!int(h.cookingSlots,50)||
    !int(h.gardenPlots,30)||!int(h.bedHealthRegeneration,100)||!categoryCaps(h.chestSlots))return null;
   home={cityId:h.cityId,level:h.level,chestSlots:categoryCaps(h.chestSlots),cookingSlots:h.cookingSlots,
    gardenPlots:h.gardenPlots,bedHealthRegeneration:h.bedHealthRegeneration};
  }
  const apartments=[],seen=new Set(),cities=new Set();
  for(const a of data.apartments){
   if(!object(a)||!positive(a.apartmentId)||seen.has(a.apartmentId)||!str(a.cityId,128)||cities.has(a.cityId)||
     !positive(a.mapLocationId)||!int(a.purchasePrice)||!int(a.accumulatedRent)||!bool(a.isRented)||!bool(a.canClaim)||
     a.canClaim&&(!a.isRented||a.accumulatedRent<data.minRentToClaim))return null;
   seen.add(a.apartmentId);cities.add(a.cityId);
   apartments.push({apartmentId:a.apartmentId,cityId:a.cityId,mapLocationId:a.mapLocationId,purchasePrice:a.purchasePrice,
    accumulatedRent:a.accumulatedRent,isRented:a.isRented,canClaim:a.canClaim});
  }
  return {home,apartments,minRentToClaim:data.minRentToClaim};
 }
 function chest(data){
  if(!object(data)||!str(data.homeCityId,128)||!str(data.accessibleFromCityId,128)||
   !['main_home','owned_apartment'].includes(data.accessMode)||!categoryCaps(data.slotsPerCategory)||!limited(data.chestItems,250))return null;
  const items=[],seen=new Set(),caps=categoryCaps(data.slotsPerCategory);
  const keys=['weapon','armor','potion','object'];
  for(const i of data.chestItems){
   if(!object(i)||!positive(i.slot,2000)||!int(i.category,3)||i.slot>caps[keys[i.category]]||!object(i.details)||
     !positive(i.details.id)||!int(i.details.rarity,8)||i.details.itemCategory!==i.category)return null;
   const k=i.category+':'+i.slot;if(seen.has(k))return null;seen.add(k);
   // Never copy arbitrary details, names, URLs or model instance attributes.
   const d=i.details;let details={id:d.id,itemCategory:d.itemCategory,rarity:d.rarity};
   if(i.category===0||i.category===1){
    if(!int(d.itemLevel)||!['attack','defense','speed'].every(k=>object(d[k])&&['baseValue','upgradeValue','maxValue'].every(n=>typeof d[k][n]==='number'&&Number.isFinite(d[k][n]))))return null;
    details.itemLevel=d.itemLevel;
    for(const n of ['attack','defense','speed'])details[n]={baseValue:d[n].baseValue,upgradeValue:d[n].upgradeValue,maxValue:d[n].maxValue};
   }else{
    if(!int(d.nature,7)||typeof d.power!=='number'||!Number.isFinite(d.power)||typeof d.maxPower!=='number'||!Number.isFinite(d.maxPower))return null;
    details.nature=d.nature;details.power=d.power;details.maxPower=d.maxPower;
    if(d.usages!==undefined){if(!int(d.usages))return null;details.usages=d.usages;}
    if(d.maxUsages!==undefined){if(!int(d.maxUsages))return null;details.maxUsages=d.maxUsages;}
   }
   items.push({slot:i.slot,category:i.category,details});
  }
  return {homeCityId:data.homeCityId,accessibleFromCityId:data.accessibleFromCityId,accessMode:data.accessMode,
   slotsPerCategory:caps,chestItems:items.sort((a,b)=>a.category-b.category||a.slot-b.slot)};
 }
 function pantry(packet){
  if(!object(packet)||!str(packet.guildName,160)||!limited(packet.foods,50))return null;
  const foods=[],seen=new Set();
  for(const f of packet.foods){if(!object(f)||!foodIds.has(f.id)||seen.has(f.id)||!int(f.amount)||!int(f.maxAmount)||f.amount>f.maxAmount)return null;
   seen.add(f.id);foods.push({id:f.id,amount:f.amount,maxAmount:f.maxAmount});}
  return {guildName:packet.guildName,foods};
 }
 const project={pet:src=>pet(src.packet),garden:src=>garden(src.data),property:src=>property(src.data),chest:src=>chest(src.data),pantry:src=>pantry(src.packet)};
 function normalizeUnsafe(raw){
  if(!object(raw))return fail();
  if(raw.state==='unavailable')return fail();
  if(raw.state!=='ready'||raw.version!==1||!object(raw.sections))return fail();
  if(Object.keys(raw.sections).some(k=>!sections.includes(k)))return fail();
  const out=Object.create(null);
  for(const name of sections){
   if(!own(raw.sections,name))continue;
   const val=raw.sections[name];if(!object(val)||!states.includes(val.state))return fail();
   if(val.state==='ready'){
    let data;try{data=project[name](val);}catch{return fail();}
    if(!data)return fail();out[name]={state:'ready',[name==='pet'||name==='pantry'?'packet':'data']:data};
   }else out[name]={state:val.state};
  }
  return {state:'ready',version:1,sections:out};
 }
 function normalizeBundle(raw){try{return normalizeUnsafe(raw);}catch{return fail();}}
 return Object.freeze({normalizeBundle});
});
