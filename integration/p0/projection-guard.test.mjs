/** CP041 strict projection-schema regression battery, standalone Node 22+. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { isProjectedP0 } from './projection-guard.mjs';

const c=(value=3)=>({kind:'value',value});
const attr=()=>({baseValue:0,upgradeValue:0,maximum:c()});
const main=(id=0,itemCategory=0)=>({id,rarity:1,itemCategory,itemLevel:0,attack:attr(),defense:attr(),speed:attr()});
const support=(id=0,itemCategory=2)=>({id,rarity:1,itemCategory,nature:1,power:0,maximumPower:{kind:'unknown'}});
const profile=()=>({level:0,health:{value:0,max:0},experience:{value:0,max:0},money:0,badges:[],
 missions:{gems:0,campaignProgression:100},rank:{unranked:true,rank:-1,numberOfPlayers:0,score:0},
 effect:{healed:false,timeLeft:-1,effect:'none',hasTimeDisplay:false},kingChallengeTier:0});
const inventory=()=>({categories:[
 {category:'weapon',capacity:2,active:main(),reserves:[{slot:1,display:main(1)}]},
 {category:'armor',capacity:1,active:main(0,1),reserves:[]},
 {category:'potion',capacity:1,active:support(),reserves:[]},
 {category:'object',capacity:1,active:support(0,3),reserves:[]}
],materials:[],talismans:{kind:'not_reported'},plants:{kind:'not_reported'}});
const cp=x=>structuredClone(x);
const accepts=(section,data)=>assert.equal(isProjectedP0(section,data),true);
const rejects=(section,data)=>assert.equal(isProjectedP0(section,data),false);

test('Guard-01 canonical complete profile and inventory accepted',()=>{accepts('profile',profile());accepts('inventory',inventory())});
test('Guard-02 detail ID0 remains legitimate in every active category',()=>{
 let i=inventory();for(const c of i.categories)assert.equal(c.active.id,0);accepts('inventory',i)
});
test('Guard-03 two reserve slots may contain the same item ID',()=>{
 let i=inventory();i.categories[0].capacity=3;i.categories[0].reserves.push({slot:2,display:main(1)});accepts('inventory',i)
});
test('Guard-04 negative effect time and rank -1 retain native semantics',()=>{
 let p=profile();p.effect.timeLeft=-999999;p.rank.rank=-1;accepts('profile',p)
});
test('Guard-05 original optional profile sections validate when all present',()=>{
 let p=profile();p.classId=0;p.guild='';p.color='#123abc';p.mapTypeId='village';p.destinationId=0;
 p.stats={energy:{value:1,max:2},attack:-1,defense:0,speed:2,breath:{base:0,max:1,regen:0}};
 p.fightRanking={glory:0,gloryRank:-1,numberOfFighters:0,league:0};
 p.pet={typeId:0,sex:'f',rarity:0,nickname:''};p.tokens={value:0,max:5};
 p.cooking={level:0,grade:'',experience:{value:0,max:10}};accepts('profile',p)
});
test('Guard-06 reported plants and talismans maintain independent properties',()=>{
 let i=inventory();i.talismans={kind:'reported',expedition:false,clone:true,remoteHarvest:false};
 i.plants={kind:'reported',plantSlots:[{slot:0,plantId:1}],maxPlantSlots:1,linkedToHomeStorage:false};
 accepts('inventory',i)
});
for(const field of ['level','health','experience','money','badges','missions','rank','effect','kingChallengeTier']){
 test('Guard mandatory profile '+field+' cannot vanish',()=>{let p=profile();delete p[field];rejects('profile',p)})
}
const cases=[
 ['root unknown personal field','profile',p=>p.keycloakId='secret'],
 ['nested health unknown field','profile',p=>p.health.phone='secret'],
 ['nested rank unknown field','profile',p=>p.rank.ownerId='private'],
 ['effect unknown field','profile',p=>p.effect.sessionToken='secret'],
 ['negative level','profile',p=>p.level=-1],
 ['NaN health','profile',p=>p.health.value=NaN],
 ['Infinity money','profile',p=>p.money=Infinity],
 ['unranked mismatch','profile',p=>p.rank.unranked=false],
 ['rank zero','profile',p=>p.rank.rank=0],
 ['overlong guild','profile',p=>p.guild='x'.repeat(257)],
 ['badges repeated','profile',p=>p.badges=['rich','rich']],
 ['pet invalid sex','profile',p=>p.pet={typeId:1,sex:'x',rarity:1,nickname:'pet'}],
 ['nested stats extras','profile',p=>p.stats={energy:{value:0,max:1},attack:1,defense:0,speed:0,breath:{base:0,max:1,regen:0,password:'x'}}],
 ['inventory root unknown','inventory',i=>i.askedPlayer='victim'],
 ['wrong category order','inventory',i=>i.categories.reverse()],
 ['empty/zero capacity','inventory',i=>i.categories[0].capacity=0],
 ['categorical item mismatch','inventory',i=>i.categories[0].active.itemCategory=1],
 ['rogue item attribute','inventory',i=>i.categories[0].active.attack.password='x'],
 ['item max Infinity without discriminator','inventory',i=>i.categories[0].active.attack.maximum=Infinity],
 ['invalid max unknown with value','inventory',i=>i.categories[0].active.attack.maximum={kind:'unknown',value:1}],
 ['bad item ID','inventory',i=>i.categories[0].active.id=-1],
 ['reserve id zero','inventory',i=>i.categories[0].reserves[0].display.id=0],
 ['reserve duplicate slot','inventory',i=>i.categories[0].reserves.push(cp(i.categories[0].reserves[0]))],
 ['reserve slot zero','inventory',i=>i.categories[0].reserves[0].slot=0],
 ['private attribute in reserve item','inventory',i=>i.categories[0].reserves[0].display.email='private'],
 ['support category mismatch','inventory',i=>i.categories[2].active.itemCategory=0],
 ['support power malformed','inventory',i=>i.categories[2].active.power='10'],
 ['material bad quantity','inventory',i=>i.materials=[{materialId:1,quantity:0}]],
 ['material duplicated id','inventory',i=>i.materials=[{materialId:1,quantity:1},{materialId:1,quantity:2}]],
 ['reported talismans without flags','inventory',i=>i.talismans={kind:'reported'}],
 ['plant unknown vs none mismatch','inventory',i=>i.plants={kind:'not_reported',plantSlots:[]}],
 ['plant duplicated slot','inventory',i=>i.plants={kind:'reported',plantSlots:[{slot:1,plantId:1},{slot:1,plantId:2}],maxPlantSlots:2,linkedToHomeStorage:false}],
 ['seed zero invalid','inventory',i=>i.plants={kind:'reported',seed:0,plantSlots:[],maxPlantSlots:1,linkedToHomeStorage:false}],
];
for (const [name,section,mutate] of cases)test('Guard reject '+name,()=>{
 const fixture=section==='profile'?profile():inventory();mutate(fixture);rejects(section,fixture)
});
test('Guard rejects extra or unknown section (chest is not inventory)',()=>{rejects('chest',inventory());rejects('pet',profile())});
test('Guard returns false, never throws on throwing source getter',()=>{
 let p=profile();Object.defineProperty(p,'money',{get(){throw new Error('secret')}});
 rejects('profile',p)
});
test('Guard rejects non-JSON prototype and potentially polluted object',()=>{
 let p=profile();Object.setPrototypeOf(p,{admin:true});rejects('profile',p)
});
test('Guard rejects invalid JSON types',()=>{
 for(const value of [undefined,null,1,'',[],false]){rejects('profile',value);rejects('inventory',value)}
});
test('Guard deterministic single-field mutations never leak as ready',()=>{
 const edits=[(x)=>x.health.value=NaN,(x)=>x.health.max=Infinity,(x)=>x.experience.value='oops',
  (x)=>x.rank.numberOfPlayers=-1,(x)=>x.missions.gems=null,(x)=>x.effect.effect=123,
  (x)=>x.badges.push({badge:'rich'}),(x)=>x.kingChallengeTier=0.5];
 for(let seed=0;seed<1600;seed++){
  let p=profile();edits[(seed*17+13)%edits.length](p);rejects('profile',p)
 }
});

test('CP043 all categories reject a reserve at capacity and far outside it',()=>{
 for(let category=0;category<4;category++){
  for(const bad of [2,9000]){
   const i=inventory();const c=i.categories[category];c.capacity=2;
   c.reserves=[{slot:bad,display:category<2?main(7,category):support(7,category)}];
   rejects('inventory',i);
  }
 }
});
test('CP043 independently optional talisman flags never fabricate missing siblings',()=>{
 for(const key of ['expedition','clone','remoteHarvest']){
  const i=inventory();i.talismans={kind:'reported',[key]:false};accepts('inventory',i);
 }
});
test('CP043 reported talismans need one valid boolean and exclude extras',()=>{
 const a=inventory();a.talismans={kind:'reported'};rejects('inventory',a);
 const b=inventory();b.talismans={kind:'reported',expedition:1};rejects('inventory',b);
 const c=inventory();c.talismans={kind:'reported',expedition:true,sessionToken:'leak'};rejects('inventory',c);
});
test('CP043 1200 seeded slot/capacity mutations follow the native invariant',()=>{
 let seed=0xC04340EF;const rand=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0};
 for(let n=0;n<1200;n++){
  const i=inventory(),cat=rand()%4,capacity=1+rand()%20,slot=rand()%25;
  const row=i.categories[cat];row.capacity=capacity;
  row.reserves=[{slot,display:cat<2?main(7,cat):support(7,cat)}];
  assert.equal(isProjectedP0('inventory',i),slot>0&&slot<capacity,String(n));
 }
});
test('CP043 600 seeded talisman partial reports preserve presence and type',()=>{
 let seed=0xC043ABCD;const rand=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0};
 const flags=['expedition','clone','remoteHarvest'];
 for(let n=0;n<600;n++){
  const i=inventory();i.talismans={kind:'reported'};
  for(const k of flags)if(rand()%3!==0)i.talismans[k]=rand()%2===0;
  assert.equal(isProjectedP0('inventory',i),flags.some(k=>Object.hasOwn(i.talismans,k)),String(n));
 }
});
test('CP043 filled plant slot at maxPlantSlots is never a valid slot',()=>{
 let i=inventory();i.plants={kind:'reported',maxPlantSlots:2,linkedToHomeStorage:false,plantSlots:[{plantId:3,slot:2}]};
 rejects('inventory',i);
});
test('CP043 huge plant slot is denied even if other fields are valid',()=>{
 let i=inventory();i.plants={kind:'reported',maxPlantSlots:1,linkedToHomeStorage:false,plantSlots:[{plantId:3,slot:9000}]};
 rejects('inventory',i);
});
test('CP045 zero plant capacity is not a valid reported inventory under the native schema',()=>{
 let i=inventory();i.plants={kind:'reported',seed:4,maxPlantSlots:0,linkedToHomeStorage:false,plantSlots:[]};
 rejects('inventory',i);
});
