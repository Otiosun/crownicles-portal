/* CP012 executable contract v2 LAB ONLY. No Core, DB, MQTT, Keycloak or production secrets. */
import http from 'node:http';
const states = new Set(['ready','not_initialized','unavailable','restricted']);
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
export function projectInventory(raw){raw=object(raw);if(raw.foundPlayer!==true)fail();let d=object(raw.data),slots=object(d.slots);let result={categories:categories.map(([key,plural,backup,category])=>{let capacity=positive(slots[plural]);let reserves=unique(array(d[backup]).map(row=>{row=object(row);let slot=positive(row.slot),display=item(row.display,category);if(display.id===0)fail();return{slot,display}}),'slot');return {category:key,capacity,active:item(d[key],category),reserves}}),materials:unique(array(d.materials).map(m=>{m=object(m);return {materialId:natural(m.materialId),quantity:positive(m.quantity)}}),'materialId'),talismans:talismans(raw)};
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
export async function readOwn({section,session,repo,now}){
 if(!session||typeof session.actorId!=='string'||!session.actorId||!Number.isFinite(session.expiresAt)||session.expiresAt<=now) return {status:401,body:{error:'unauthorized'}};
 if(!['inventory','profile'].includes(section)) return {status:404,body:{error:'not_found'}};
 try{const snapshot=await repo.readSnapshot(session.actorId,section);if(!snapshot)return {status:200,body:{state:'unavailable'}};
 if(snapshot.actorId!==session.actorId||!states.has(snapshot.state))fail();
 const asOf=string(snapshot.asOf);if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(asOf)||!Number.isFinite(Date.parse(asOf)))fail();
 if(snapshot.state!=='ready')return {status:200,body:{state:snapshot.state,asOf}};
 return {status:200,body:{state:'ready',asOf,data:section==='inventory'?projectInventory(snapshot.source):projectProfile(snapshot.source)}};
 }catch{return {status:503,body:{state:'unavailable',error:'source_unavailable'}};}
}
// HTTP adapter only for local lab. Authenticator injected, not production auth.
export function createLabServer({verifySession,repo,clock=Date.now}){return http.createServer(async(req,res)=>{
 const send=(status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});res.end(JSON.stringify(body))};
 try{if(req.method!=='GET'){res.setHeader('allow','GET');return send(405,{error:'method_not_allowed'})}
 if(req.url.includes('?')||req.url.includes('#')||req.headers['transfer-encoding']||Number(req.headers['content-length']||0)>0)return send(400,{error:'invalid_request'});
 const match=/^\/v1\/me\/(inventory|profile)$/.exec(req.url);if(!match)return send(404,{error:'not_found'});
 const authCount=req.rawHeaders.filter((h,i)=>i%2===0&&h.toLowerCase()==='authorization').length;
 const auth=authCount===1&&typeof req.headers.authorization==='string'?/^Bearer ([A-Za-z0-9._-]{1,256})$/.exec(req.headers.authorization):null;
 let session=auth?await verifySession(auth[1]):null;const out=await readOwn({section:match[1],session,repo,now:clock()});send(out.status,out.body);
 }catch{return send(503,{state:'unavailable',error:'source_unavailable'})}
 });}
