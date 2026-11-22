import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, transition, canInspect } from '../../lab/ux-p0-003/machine.mjs';
import { mapReadResponse, startRead, finishRead } from './response-bridge.mjs';

const asOf = '2026-11-22T19:50:00.000Z';
const main = (id,itemCategory=0) => ({id,itemCategory,rarity:1,itemLevel:1,attack:{baseValue:1,upgradeValue:0,maximum:{kind:'value',value:5}},defense:{baseValue:0,upgradeValue:0,maximum:{kind:'value',value:5}},speed:{baseValue:0,upgradeValue:0,maximum:{kind:'unbounded'}}});
const support = (id,itemCategory) => ({id,itemCategory,rarity:1,nature:1,power:1,maximumPower:{kind:'value',value:2}});
const inventory = () => ({categories:[
 {category:'weapon',capacity:3,active:main(0),reserves:[{slot:1,display:main(7)},{slot:2,display:main(7)}]},
 {category:'armor',capacity:1,active:main(0,1),reserves:[]},
 {category:'potion',capacity:1,active:support(0,2),reserves:[]},
 {category:'object',capacity:1,active:support(0,3),reserves:[]}
],materials:[{materialId:5,quantity:1}],talismans:{kind:'not_reported'},plants:{kind:'not_reported'}});
const profile = () => ({level:12,health:{value:2,max:5},experience:{value:1,max:4},money:0,badges:[],
 missions:{gems:0,campaignProgression:100},rank:{rank:-1,unranked:true,numberOfPlayers:1,score:0},
 effect:{timeLeft:-2000,healed:true,effect:'none',hasTimeDisplay:false},kingChallengeTier:0});
const ready = data => ({status:200,body:{state:'ready',asOf,data}});
const empty = state => ({status:200,body:{state,asOf}});
const authorized = () => transition(initialState(),{type:'AUTH_ESTABLISHED'});
const begin = (state,section,requestId=1) => startRead(state,section,requestId);
const finished = (state,section,data,id=1) => {const b=begin(state,section,id);return finishRead(b.state,b.token,ready(data));};

test('CP041-01 maps CP014 successful envelope to one matching response event',()=>{
 const e=mapReadResponse({section:'profile',epoch:1,requestId:1},ready(profile()));
 assert.deepEqual({type:e.type,section:e.section,domainState:e.domainState,asOf:e.asOf},
 {type:'FETCH_FINISHED',section:'profile',domainState:'ready',asOf});
});
test('CP041-02 preserves item ID 0 as an inspectable active slot',()=>{
 let s=finished(authorized(),'inventory',inventory());
 s=transition(s,{type:'GO_INVENTORY'});
 s=transition(s,{type:'SELECT_ITEM',category:'weapon',slot:0});
 assert.deepEqual(s.selected,{category:'weapon',slot:0,id:0});
 assert.equal(canInspect(s),true);
 s=transition(s,{type:'OPEN_DETAIL'});assert.equal(s.view,'detail');
 s=transition(s,{type:'BACK'});assert.equal(s.view,'inventory');assert.equal(s.focusIntent,'item:weapon:0');
});
test('CP041-03 duplicates of one item ID remain distinct by category and slot',()=>{
 let s=finished(authorized(),'inventory',inventory());
 s=transition(s,{type:'GO_INVENTORY'});
 for(const slot of [1,2]){s=transition(s,{type:'SELECT_ITEM',category:'weapon',slot});assert.deepEqual(s.selected,{category:'weapon',slot,id:7});}
});
test('CP041-04 fresh fetch purges inspected details before the response arrives',()=>{
 let s=finished(authorized(),'inventory',inventory());
 s=transition(s,{type:'GO_INVENTORY'});s=transition(s,{type:'SELECT_ITEM',category:'weapon',slot:1});s=transition(s,{type:'OPEN_DETAIL'});
 const b=begin(s,'inventory',2);assert.equal(b.state.view,'inventory');assert.equal(b.state.sections.inventory.data,null);assert.equal(b.state.sections.inventory.state,'loading');
});
test('CP041-05 response from an old request cannot override newer data',()=>{
 let s=authorized();let a=begin(s,'inventory',1);s=finishRead(a.state,a.token,ready(inventory()));
 let b=begin(s,'inventory',2);let c=begin(b.state,'inventory',3);s=finishRead(c.state,b.token,ready({sensitive:'old'}));
 assert.equal(s.sections.inventory.state,'loading');assert.equal(s.sections.inventory.requestId,3);
 s=finishRead(s,c.token,ready(inventory()));assert.equal(s.sections.inventory.state,'ready');
});
test('CP041-06 old actor epoch cannot overwrite current actor data',()=>{
 let s=authorized();let old=begin(s,'profile',1);
 s=transition(old.state,{type:'AUTH_ESTABLISHED'});let next=begin(s,'profile',1);
 s=finishRead(next.state,old.token,ready({level:999}));assert.equal(s.sections.profile.state,'loading');
 s=finishRead(s,next.token,ready(profile()));assert.equal(s.sections.profile.data.level,12);
});
test('CP041-07 401 wipes both sections, category, selection, epoch and detail',()=>{
 let s=finished(authorized(),'profile',profile());s=finished(s,'inventory',inventory());
 s=transition(s,{type:'GO_INVENTORY'});s=transition(s,{type:'SELECT_ITEM',category:'weapon',slot:0});
 const b=begin(s,'profile',2);s=finishRead(b.state,b.token,{status:401,body:{secret:'SHOULD_NOT_COPY'}});
 assert.equal(s.authorized,false);assert.equal(s.sections.profile.data,null);assert.equal(s.sections.inventory.data,null);
 assert.equal(s.selected,null);assert.equal(s.category,'weapon');assert.equal(s.view,'profile');assert.equal(s.epoch,2);
 assert.equal(JSON.stringify(s).includes('SHOULD_NOT_COPY'),false);
});
for(const domainState of ['restricted','not_initialized','unavailable']){
 test('CP041 state '+domainState+' replaces old ready data without status conflation',()=>{
  let s=finished(authorized(),'inventory',inventory());const b=begin(s,'inventory',2);
  s=finishRead(b.state,b.token,empty(domainState));assert.equal(s.sections.inventory.state,domainState);assert.equal(s.sections.inventory.data,null);
 });
}
for(const [label,mutate] of [
 ['non-200 status',r=>r.status=503],
 ['invalid date',r=>r.body.asOf='2026-22-22'],
 ['extra envelope field',r=>r.body.ownerId='private'],
 ['missing body data',r=>delete r.body.data],
 ['unknown state',r=>r.body.state='absent'],
 ['raw packet private identity',r=>r.body.data.keycloakId='private'],
 ['nested private ownerId',r=>r.body.data.categories[0].active.ownerId='private'],
 ['not-ready with data',r=>r.body={state:'restricted',asOf,data:inventory()}],
 ['invalid categories',r=>r.body.data.categories=[]]
]) test('CP041 malformed '+label+' fails closed',()=>{
 let r=ready(inventory());mutate(r);let s=authorized(),b=begin(s,'inventory');
 s=finishRead(b.state,b.token,r);assert.equal(s.sections.inventory.state,'unavailable');assert.equal(s.sections.inventory.data,null);
});
test('CP041-19 profile -1 rank, negative effect millis and zero class are untouched',()=>{
 let p=profile();p.classId=0;let s=finished(authorized(),'profile',p);
 assert.equal(s.sections.profile.data.rank.rank,-1);
 assert.equal(s.sections.profile.data.effect.timeLeft,-2000);
 assert.equal(s.sections.profile.data.classId,0);
});
test('CP041-20 safe unknown server errors do not copy payload details',()=>{
 let s=authorized(),b=begin(s,'profile');s=finishRead(b.state,b.token,{status:503,body:{error:'PRIVATE_CONNECTION_URI'}});
 assert.equal(s.sections.profile.state,'unavailable');assert.ok(!JSON.stringify(s).includes('PRIVATE_CONNECTION_URI'));
});
test('CP041-21 invalid context cannot create a response event',()=>{
 assert.throws(()=>mapReadResponse({section:'chest',epoch:1,requestId:1},ready(inventory())));
 assert.throws(()=>mapReadResponse({section:'inventory',epoch:0,requestId:1},ready(inventory())));
});
test('CP041-22 untouched section stays clean, no inventory/chest substitution',()=>{
 const s=finished(authorized(),'profile',profile());assert.equal(s.sections.inventory.state,'idle');
 assert.deepEqual(Object.keys(s.sections),['profile','inventory']);
});

// CP041 compatibility with UX-P0-008: same-session late revocation is authoritative.
test('CP041-UX008-A superseded same-epoch 401 revokes even after latest ready',()=>{
 let s=finished(authorized(),'profile',profile());s=finished(s,'inventory',inventory());
 let old=begin(s,'inventory',2),newer=begin(old.state,'inventory',3);
 s=finishRead(newer.state,newer.token,ready(inventory()));
 assert.equal(s.sections.profile.state,'ready');
 s=finishRead(s,old.token,{status:401,body:{secret:'NO_COPY'}});
 assert.equal(s.authorized,false);assert.equal(s.sections.profile.data,null);
 assert.equal(s.sections.inventory.data,null);assert.equal(s.epoch,2);
 assert.equal(JSON.stringify(s).includes('NO_COPY'),false);
});
test('CP041-UX008-B previous actor epoch 401 cannot revoke a new actor',()=>{
 let s=finished(authorized(),'inventory',inventory());const old=begin(s,'profile',2);
 s=transition(old.state,{type:'AUTH_ESTABLISHED'});
 s=finished(s,'profile',profile());
 s=finishRead(s,old.token,{status:401,body:{}});
 assert.equal(s.authorized,true);assert.equal(s.sections.profile.data.level,12);
 assert.equal(s.epoch,2);
});
test('CP041-UX008-C refreshing detail retains inert slot id until original item revalidated',()=>{
 let s=finished(authorized(),'inventory',inventory());
 s=transition(s,{type:'GO_INVENTORY'});
 s=transition(s,{type:'SELECT_ITEM',category:'weapon',slot:1});
 s=transition(s,{type:'OPEN_DETAIL'});
 const b=begin(s,'inventory',2);
 assert.equal(b.state.view,'inventory');assert.equal(b.state.sections.inventory.data,null);
 assert.equal(canInspect(b.state),false);
 assert.deepEqual(b.state.selected,{category:'weapon',slot:1,id:7});
 s=finishRead(b.state,b.token,ready(inventory()));
 assert.deepEqual(s.selected,{category:'weapon',slot:1,id:7});
 assert.equal(canInspect(s),true);
 s=transition(s,{type:'OPEN_DETAIL'});assert.equal(s.view,'detail');
});
test('CP041-UX008-D changed item in same slot invalidates preserved inspection',()=>{
 let s=finished(authorized(),'inventory',inventory());
 s=transition(s,{type:'GO_INVENTORY'});
 s=transition(s,{type:'SELECT_ITEM',category:'weapon',slot:1});
 s=transition(s,{type:'OPEN_DETAIL'});
 const b=begin(s,'inventory',2),changed=inventory();
 changed.categories[0].reserves[0].display.id=8;
 s=finishRead(b.state,b.token,ready(changed));
 assert.equal(s.selected,null);assert.equal(canInspect(s),false);
});
test('CP041-UX008-E stale READY is ignored while newer 401 still wipes session',()=>{
 let s=finished(authorized(),'inventory',inventory());
 const old=begin(s,'inventory',2),latest=begin(old.state,'inventory',3);
 s=finishRead(latest.state,old.token,ready(inventory()));
 assert.equal(s.sections.inventory.state,'loading');
 s=finishRead(s,latest.token,{status:401});
 assert.equal(s.authorized,false);assert.equal(s.sections.inventory.data,null);
});
