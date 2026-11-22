/**
 * CP041 read-only client CONTRACT guard for the CP014 server projection.
 * This is defense-in-depth before the UX state machine, NOT access control.
 * Strictly checks the *projected* Profile/Inventory DTO, never native packets.
 * It neither fetches nor transforms, derives, rounds or fabricates game values.
 */
const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
const obj = v => v!==null && typeof v==='object' && !Array.isArray(v) &&
  Object.getPrototypeOf(v)===Object.prototype;
const keys = (v,required,optional=[]) => obj(v) &&
  required.every(k=>own(v,k)) && Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const list = (v,limit=10000)=>Array.isArray(v)&&v.length<=limit;
const natural = v=>Number.isSafeInteger(v)&&v>=0;
const positive = v=>natural(v)&&v>0;
const num = v=>typeof v==='number'&&Number.isFinite(v);
const str = v=>typeof v==='string'&&v.length<=256;
const bool = v=>typeof v==='boolean';
const unique = (v,key)=>new Set(v.map(x=>x[key])).size===v.length;
const bar = v=>keys(v,['value','max'])&&num(v.value)&&num(v.max);
function cap(v){
 return keys(v,['kind'],['value']) && (
  (v.kind==='value' && own(v,'value') && num(v.value)) ||
  ((v.kind==='unbounded'||v.kind==='unknown') && !own(v,'value')));
}
function attr(v){return keys(v,['baseValue','upgradeValue','maximum'])&&
 num(v.baseValue)&&num(v.upgradeValue)&&cap(v.maximum)}
function main(v,cat){return keys(v,['id','rarity','itemCategory','itemLevel','attack','defense','speed'],['itemEnchantmentId']) &&
 natural(v.id)&&natural(v.rarity)&&v.rarity<=8&&v.itemCategory===cat&&natural(v.itemLevel)&&
 (!own(v,'itemEnchantmentId')||str(v.itemEnchantmentId))&&attr(v.attack)&&attr(v.defense)&&attr(v.speed)}
function support(v,cat){return keys(v,['id','rarity','itemCategory','nature','power','maximumPower'],['usages','maxUsages'])&&
 natural(v.id)&&natural(v.rarity)&&v.rarity<=8&&v.itemCategory===cat&&natural(v.nature)&&v.nature<=7&&
 num(v.power)&&cap(v.maximumPower)&&(!own(v,'usages')||natural(v.usages))&&
 (!own(v,'maxUsages')||natural(v.maxUsages))}
function categories(v){
 const names=['weapon','armor','potion','object'];
 if(!list(v,4)||v.length!==4)return false;
 return v.every((c,i)=>keys(c,['category','capacity','active','reserves']) &&
  c.category===names[i]&&positive(c.capacity)&&(i<2?main(c.active,i):support(c.active,i))&&
  list(c.reserves)&&c.reserves.every(r=>keys(r,['slot','display'])&&positive(r.slot)&&
   (i<2?main(r.display,i):support(r.display,i))&&r.display.id!==0)&&unique(c.reserves,'slot'));
}
function materials(v){return list(v)&&v.every(m=>keys(m,['materialId','quantity'])&&
 natural(m.materialId)&&positive(m.quantity))&&unique(v,'materialId')}
function talismans(v){return (keys(v,['kind'])&&v.kind==='not_reported')||
 (keys(v,['kind','expedition','clone','remoteHarvest'])&&v.kind==='reported'&&
  bool(v.expedition)&&bool(v.clone)&&bool(v.remoteHarvest))}
function plants(v){if(keys(v,['kind'])&&v.kind==='not_reported')return true;
 return keys(v,['kind','plantSlots','maxPlantSlots','linkedToHomeStorage'],['seed'])&&v.kind==='reported'&&
  (!own(v,'seed')||positive(v.seed))&&list(v.plantSlots)&&
  v.plantSlots.every(s=>keys(s,['plantId','slot'])&&positive(s.plantId)&&natural(s.slot))&&
  unique(v.plantSlots,'slot')&&natural(v.maxPlantSlots)&&bool(v.linkedToHomeStorage)}
function inventory(d){return keys(d,['categories','materials','talismans','plants'])&&
  categories(d.categories)&&materials(d.materials)&&talismans(d.talismans)&&plants(d.plants)}
function missions(v){return keys(v,['gems','campaignProgression'])&&num(v.gems)&&num(v.campaignProgression)}
function rank(v){return keys(v,['unranked','rank','numberOfPlayers','score'])&&bool(v.unranked)&&
  (v.rank===-1||positive(v.rank))&&v.unranked===(v.rank===-1)&&natural(v.numberOfPlayers)&&num(v.score)}
function effect(v){return keys(v,['healed','timeLeft','effect','hasTimeDisplay'])&&bool(v.healed)&&
  num(v.timeLeft)&&str(v.effect)&&bool(v.hasTimeDisplay)}
function stats(v){return keys(v,['energy','attack','defense','speed','breath'])&&bar(v.energy)&&
 num(v.attack)&&num(v.defense)&&num(v.speed)&&keys(v.breath,['base','max','regen'])&&
 num(v.breath.base)&&num(v.breath.max)&&num(v.breath.regen)}
function fight(v){return keys(v,['glory','gloryRank','numberOfFighters','league'])&&num(v.glory)&&
  (v.gloryRank===-1||positive(v.gloryRank))&&natural(v.numberOfFighters)&&natural(v.league)}
function pet(v){return keys(v,['typeId','sex','rarity','nickname'])&&natural(v.typeId)&&
  (v.sex==='m'||v.sex==='f')&&natural(v.rarity)&&str(v.nickname)}
function cooking(v){return keys(v,['level','grade','experience'])&&natural(v.level)&&str(v.grade)&&bar(v.experience)}
const req=['level','health','experience','money','badges','missions','rank','effect','kingChallengeTier'];
const opt={classId:natural,destinationId:natural,mapTypeId:str,guild:str,color:str,
 stats,fightRanking:fight,pet,tokens:bar,cooking};
function profile(v){return keys(v,req,Object.keys(opt))&&natural(v.level)&&bar(v.health)&&bar(v.experience)&&
 num(v.money)&&list(v.badges)&&v.badges.every(str)&&new Set(v.badges).size===v.badges.length&&
 missions(v.missions)&&rank(v.rank)&&effect(v.effect)&&natural(v.kingChallengeTier)&&
 Object.entries(opt).every(([k,validate])=>!own(v,k)||validate(v[k]))}

export function isProjectedP0(section,data){
 try {return section==='profile'?profile(data):section==='inventory'?inventory(data):false}
 catch {return false} // Malicious getters/Proxy should never crash the UI event flow.
}
