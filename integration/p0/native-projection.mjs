/** CP042: pure P0 profile/inventory projection derived from CP014 (native source),
 * CP012 inventory contract and pinned Core packet schemas. Lab-only, no auth
 * or persistence. The caller must authenticate with real binding/epoch and
 * only read native own-only results under a server transaction. */
const categories = [['weapon','weapons','backupWeapons',0],['armor','armors','backupArmors',1],['potion','potions','backupPotions',2],['object','objects','backupObjects',3]];
const fail=()=>{throw new Error('invalid projection source')};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v:fail();
const int=v=>Number.isSafeInteger(v)?v:fail();
const natural=v=>int(v)>=0?v:fail();
const positive=v=>int(v)>0?v:fail();
const finite=v=>typeof v==='number'&&Number.isFinite(v)?v:fail();
const bool=v=>typeof v==='boolean'?v:fail();
const string=v=>typeof v==='string'&&v.length<=256?v:fail();
const array=v=>Array.isArray(v)&&v.length<=10000?v:fail();
const optional=(obj,key,fn)=>Object.hasOwn(obj,key)&&obj[key]!==undefined?{[key]:fn(obj[key])}:{};
const enumInt=(v,max)=>natural(v)<=max?v:fail();
const unique=(a,key)=>new Set(a.map(x=>x[key])).size===a.length?a:fail();
function cap(v){if(v===Infinity)return {kind:'unbounded'};if(v===undefined||v===null)return {kind:'unknown'};return {kind:'value',value:finite(v)}}
function attr(v){v=object(v);return {baseValue:finite(v.baseValue),upgradeValue:finite(v.upgradeValue),maximum:cap(v.maxValue)}}
function item(v,category){v=object(v);if(v.itemCategory!==category)fail();let base={id:natural(v.id),rarity:enumInt(v.rarity,8),itemCategory:category};return category<2?{...base,itemLevel:natural(v.itemLevel),...optional(v,'itemEnchantmentId',string),attack:attr(v.attack),defense:attr(v.defense),speed:attr(v.speed)}:{...base,nature:enumInt(v.nature,7),power:finite(v.power),maximumPower:cap(v.maxPower),...optional(v,'usages',natural),...optional(v,'maxUsages',natural)}}
function talismans(raw){const keys=['hasTalisman','hasCloneTalisman','hasRemoteHarvestTalisman'];
 if(keys.every(k=>raw[k]===undefined))return {kind:'not_reported'};
 return {kind:'reported',expedition:bool(raw.hasTalisman),clone:bool(raw.hasCloneTalisman),remoteHarvest:bool(raw.hasRemoteHarvestTalisman)}}
export function projectInventory(raw){raw=object(raw);if(raw.foundPlayer!==true)fail();let d=object(raw.data),slots=object(d.slots);let result={categories:categories.map(([key,plural,backup,category])=>{let capacity=positive(slots[plural]);let reserves=unique(array(d[backup]).map(row=>{row=object(row);let slot=positive(row.slot),display=item(row.display,category);if(slot>=capacity||display.id===0)fail();return{slot,display}}),'slot');return {category:key,capacity,active:item(d[key],category),reserves}}),materials:unique(array(d.materials).map(m=>{m=object(m);return {materialId:natural(m.materialId),quantity:positive(m.quantity)}}),'materialId'),talismans:talismans(raw)};
if(d.plants!==undefined){let p=object(d.plants);result.plants={kind:'reported',...optional(p,'seed',positive),plantSlots:unique(array(p.plantSlots).map(s=>({plantId:positive(s.plantId),slot:natural(s.slot)})),'slot'),maxPlantSlots:natural(p.maxPlantSlots),linkedToHomeStorage:bool(p.linkedToHomeStorage)}}else result.plants={kind:'not_reported'};return result;}
function bar(v){v=object(v);return {value:finite(v.value),max:finite(v.max)}}
// CP014: full native CommandProfilePacketRes.playerData contract. Explicit nested allowlists.
function rankNumber(v){return v===-1?-1:positive(v)}
function rankData(v){v=object(v);const rank=rankNumber(v.rank),unranked=bool(v.unranked);if(unranked!==(rank===-1))fail();return {unranked,rank,numberOfPlayers:natural(v.numberOfPlayers),score:finite(v.score)}}
function fightData(v){v=object(v);return {glory:finite(v.glory),gloryRank:rankNumber(v.gloryRank),numberOfFighters:natural(v.numberOfFighters),league:natural(v.league)}}
function statsData(v){v=object(v);let breath=object(v.breath);return {energy:bar(v.energy),attack:finite(v.attack),defense:finite(v.defense),speed:finite(v.speed),breath:{base:finite(breath.base),max:finite(breath.max),regen:finite(breath.regen)}}}
function petData(v){v=object(v);if(v.sex!=="m"&&v.sex!=="f")fail();return {typeId:natural(v.typeId),sex:v.sex,rarity:natural(v.rarity),nickname:string(v.nickname)}}
function effectData(v){v=object(v);return {healed:bool(v.healed),timeLeft:finite(v.timeLeft),effect:string(v.effect),hasTimeDisplay:bool(v.hasTimeDisplay)}}
function cookingData(v){v=object(v);return {level:natural(v.level),grade:string(v.grade),experience:bar(v.experience)}}
function missionData(v){v=object(v);return {gems:finite(v.gems),campaignProgression:finite(v.campaignProgression)}}
export function projectProfile(raw){const d=object(object(raw).playerData),badges=array(d.badges).map(string);if(new Set(badges).size!==badges.length)fail();return {
 level:natural(d.level),health:bar(d.health),experience:bar(d.experience),money:finite(d.money),badges,
 missions:missionData(d.missions),rank:rankData(d.rank),effect:effectData(d.effect),kingChallengeTier:natural(d.kingChallengeTier),
 ...optional(d,'classId',natural),...optional(d,'destinationId',natural),...optional(d,'mapTypeId',string),...optional(d,'guild',string),
 ...optional(d,'color',string),...optional(d,'stats',statsData),...optional(d,'fightRanking',fightData),...optional(d,'pet',petData),
 ...optional(d,'tokens',bar),...optional(d,'cooking',cookingData)
};}

/** Surface-only allowlist. The input is the CP012/CP014 native return
 * {state:'ready',packet} or non-ready state. Never forward raw model objects,
 * internal keycloak IDs, or partial packets in restricted/unavailable cases.
 * This is NOT a verified session and must not be mounted as an HTTP route. */
export function normalizeNativeP0Read(section,readResult){
 try {
  if(section!=='profile'&&section!=='inventory')return {state:'unavailable'};
  if(!readResult||typeof readResult!=='object'||Array.isArray(readResult))return {state:'unavailable'};
  if(['restricted','not_initialized','unavailable'].includes(readResult.state))return {state:readResult.state};
  if(readResult.state!=='ready')return {state:'unavailable'};
  return {state:'ready',data:section==='profile'?projectProfile(readResult.packet):projectInventory(readResult.packet)};
 }catch{return {state:'unavailable'};}
}