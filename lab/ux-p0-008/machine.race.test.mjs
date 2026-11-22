import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, transition, canInspect } from '../ux-p0-003/machine.mjs';

const inventory = () => ({categories:['weapon','armor','potion','object'].map((category,i)=>({
  category,capacity:3,active:{id:i===0?0:i,itemCategory:category,rarity:0},
  reserves:category==='weapon'?[{slot:1,display:{id:7,itemCategory:category,rarity:0}},{slot:2,display:{id:7,itemCategory:category,rarity:0}}]:[]
})),materials:[],talismans:{kind:'not_reported'},plants:{kind:'not_reported'}});
const profile={level:2,health:{value:10,max:12}};
const event=(type,rest={})=>({type,...rest});
function finish(state,section,id,data,domainState='ready'){
  const epoch=state.epoch;
  state=transition(state,event('FETCH_STARTED',{section,epoch,requestId:id}));
  state=transition(state,event('FETCH_FINISHED',{section,epoch,requestId:id,domainState,data}));
  return state;
}
function prepared(){let s=transition(initialState(),event('AUTH_ESTABLISHED'));
  s=finish(s,'profile',1,profile);s=finish(s,'inventory',1,inventory());return s;}

// Must pass on the original implementation: establish the test harness.
test('baseline: slot 0 and duplicate IDs are distinguishable',()=>{
  let s=transition(prepared(),event('GO_INVENTORY'));
  s=transition(s,event('SELECT_ITEM',{category:'weapon',slot:0}));
  assert.deepEqual(s.selected,{category:'weapon',slot:0,id:0});
  s=transition(s,event('SELECT_ITEM',{category:'weapon',slot:2}));
  assert.deepEqual(s.selected,{category:'weapon',slot:2,id:7});
});

test('P0-008-A: same-epoch late 401 purges all data even if its request is superseded',()=>{
  let s=prepared();
  const epoch=s.epoch;
  s=transition(s,event('FETCH_STARTED',{section:'inventory',epoch,requestId:2}));
  s=transition(s,event('FETCH_STARTED',{section:'inventory',epoch,requestId:3}));
  s=transition(s,event('FETCH_FINISHED',{section:'inventory',epoch,requestId:3,domainState:'ready',data:inventory()}));
  assert.equal(s.authorized,true);assert.equal(s.sections.profile.state,'ready');
  s=transition(s,event('FETCH_FINISHED',{section:'inventory',epoch,requestId:2,domainState:'unauthorized'}));
  assert.equal(s.authorized,false,'a same-session 401 is a revocation signal, not a display response');
  assert.equal(s.sections.profile.data,null);assert.equal(s.sections.inventory.data,null);
  assert.equal(s.epoch,epoch+1);
});

test('P0-008-B: refresh exits inspection but retains inert slot selection only if item still exists',()=>{
  let s=transition(prepared(),event('GO_INVENTORY'));
  s=transition(s,event('SELECT_ITEM',{category:'weapon',slot:1}));
  s=transition(s,event('OPEN_DETAIL'));
  assert.equal(s.view,'detail');
  const epoch=s.epoch;
  s=transition(s,event('FETCH_STARTED',{section:'inventory',epoch,requestId:2}));
  assert.equal(s.view,'inventory');
  assert.equal(s.sections.inventory.data,null,'sensitive item detail must vanish during loading');
  assert.equal(canInspect(s),false);
  s=transition(s,event('FETCH_FINISHED',{section:'inventory',epoch,requestId:2,domainState:'ready',data:inventory()}));
  assert.deepEqual(s.selected,{category:'weapon',slot:1,id:7},'same slot+id returns selected');
  s=transition(s,event('OPEN_DETAIL'));
  assert.equal(s.view,'detail','item can be inspected after revalidation');
});

test('P0-008-C: refresh invalidation removes stale selection when ID changes',()=>{
 let s=transition(prepared(),event('GO_INVENTORY'));
 s=transition(s,event('SELECT_ITEM',{category:'weapon',slot:1}));
 s=transition(s,event('OPEN_DETAIL'));
 const epoch=s.epoch;
 s=transition(s,event('FETCH_STARTED',{section:'inventory',epoch,requestId:2}));
 const next=inventory();next.categories[0].reserves[0].display.id=8;
 s=transition(s,event('FETCH_FINISHED',{section:'inventory',epoch,requestId:2,domainState:'ready',data:next}));
 assert.equal(s.selected,null);assert.equal(canInspect(s),false);
});

test('P0-008-D: old epoch 401 MUST NOT erase a new actor session',()=>{
 let s=prepared();const previousEpoch=s.epoch;
 s=transition(s,event('AUTH_ESTABLISHED'));
 const currentEpoch=s.epoch;
 s=finish(s,'profile',2,profile);
 s=transition(s,event('FETCH_FINISHED',{section:'inventory',epoch:previousEpoch,requestId:999,domainState:'unauthorized'}));
 assert.equal(s.epoch,currentEpoch);assert.equal(s.authorized,true);assert.equal(s.sections.profile.state,'ready');
});

test('P0-008-E: same-epoch 401 from a superseded PROFILE request clears inventory too',()=>{
 let s=prepared(),epoch=s.epoch;
 s=transition(s,event('FETCH_STARTED',{section:'profile',epoch,requestId:2}));
 s=transition(s,event('FETCH_STARTED',{section:'profile',epoch,requestId:3}));
 s=transition(s,event('FETCH_FINISHED',{section:'profile',epoch,requestId:3,domainState:'ready',data:profile}));
 assert.equal(s.sections.inventory.state,'ready');
 s=transition(s,event('FETCH_FINISHED',{section:'profile',epoch,requestId:2,domainState:'unauthorized'}));
 assert.equal(s.authorized,false);assert.equal(s.sections.inventory.data,null);
});

test('P0-008-F: same-epoch superseded READY response remains ignored',()=>{
 let s=prepared(),epoch=s.epoch;
 s=transition(s,event('FETCH_STARTED',{section:'inventory',epoch,requestId:2}));
 s=transition(s,event('FETCH_STARTED',{section:'inventory',epoch,requestId:3}));
 const old=inventory();old.categories[0].active.id=100;
 assert.deepEqual(transition(s,event('FETCH_FINISHED',{section:'inventory',epoch,requestId:2,domainState:'ready',data:old})),s);
});

test('P0-008-G: invalid section cannot force an unrelated session reset',()=>{
 const s=prepared();
 assert.deepEqual(transition(s,event('FETCH_FINISHED',{section:'arbitrary',epoch:s.epoch,requestId:2,domainState:'unauthorized'})),s);
});

test('P0-008-H: post-logout stale 401 cannot revoke newly established actor',()=>{
 let s=prepared(),epoch=s.epoch;
 s=transition(s,event('LOGOUT'));
 s=transition(s,event('AUTH_ESTABLISHED'));
 const newEpoch=s.epoch;
 s=finish(s,'inventory',2,inventory());
 s=transition(s,event('FETCH_FINISHED',{section:'profile',epoch,requestId:1,domainState:'unauthorized'}));
 assert.equal(s.authorized,true);assert.equal(s.epoch,newEpoch);assert.equal(s.sections.inventory.state,'ready');
});

test('P0-008-I: refresh followed by restricted response destroys preserved identity',()=>{
 let s=transition(prepared(),event('GO_INVENTORY'));
 s=transition(s,event('SELECT_ITEM',{category:'weapon',slot:1}));
 s=transition(s,event('OPEN_DETAIL'));
 const epoch=s.epoch;
 s=transition(s,event('FETCH_STARTED',{section:'inventory',epoch,requestId:2}));
 s=transition(s,event('FETCH_FINISHED',{section:'inventory',epoch,requestId:2,domainState:'restricted'}));
 assert.equal(s.sections.inventory.data,null);assert.equal(s.selected,null);assert.equal(s.detailOrigin,null);assert.equal(s.view,'inventory');
});
