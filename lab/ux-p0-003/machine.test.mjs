import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,transition,itemAt,canInspect} from './machine.mjs';
const cats=['weapon','armor','potion','object'];
const mk=(id,category)=>({id,rarity:0,itemCategory:category});
const inventory=()=>({categories:cats.map((category,i)=>({category,capacity:3,active:mk(i===0?0:i,i),
 reserves:i===0?[{slot:1,display:mk(7,i)},{slot:2,display:mk(7,i)}]:[]})),materials:[],talismans:{kind:'not_reported'},plants:{kind:'not_reported'}});
const profile=()=>({level:2,health:{value:10,max:12},experience:{value:1,max:10},money:0});
let req=0;
const auth=()=>transition(initialState(),{type:'AUTH_ESTABLISHED'});
function resolved(state,section,data,domainState='ready'){
 const requestId=++req,epoch=state.epoch;
 let s=transition(state,{type:'FETCH_STARTED',section,requestId,epoch});
 s=transition(s,{type:'FETCH_FINISHED',section,requestId,epoch,domainState,data,asOf:'2026-11-22T00:00:00Z'});
 return s;
}
function setupInventory(){let s=auth();s=transition(s,{type:'GO_INVENTORY'});return resolved(s,'inventory',inventory());}
function selected(state,category='weapon',slot=1){return transition(state,{type:'SELECT_ITEM',category,slot});}
test('initial view cannot navigate before auth',()=>assert.deepEqual(transition(initialState(),{type:'GO_INVENTORY'}),initialState()));
test('auth resets prior data and clears selections',()=>{let s=selected(setupInventory());s=transition(s,{type:'AUTH_ESTABLISHED'});assert.equal(s.view,'profile');assert.equal(s.sections.inventory.data,null);assert.equal(s.selected,null);});
test('profile ready retains only supplied projected fields',()=>{const s=resolved(auth(),'profile',profile());assert.equal(s.sections.profile.state,'ready');assert.equal(s.sections.profile.data.level,2);});
test('selection uses category + slot + item ID',()=>{const s=selected(setupInventory());assert.deepEqual(s.selected,{category:'weapon',slot:1,id:7});});
test('active item ID 0 is real, not treated as missing',()=>{const s=selected(setupInventory(),'weapon',0);assert.deepEqual(s.selected,{category:'weapon',slot:0,id:0});});
test('duplicate item IDs in different slots have separate keys',()=>{let s=setupInventory();assert.notDeepEqual(itemAt(s.sections.inventory.data,'weapon',1),itemAt(s.sections.inventory.data,'weapon',2));});
test('invalid categories cannot be chosen',()=>{const s=setupInventory();assert.deepEqual(transition(s,{type:'SET_CATEGORY',category:'guild'}),s);});
test('missing reserve cannot be selected',()=>{const s=setupInventory();assert.deepEqual(selected(s,'weapon',9),s);});
test('other category item cannot be selected through wrong tab',()=>{const s=setupInventory();assert.deepEqual(selected(s,'armor',0),s);});
test('inspect and back restore exact origin focus intent',()=>{let s=selected(setupInventory());assert.equal(canInspect(s),true);s=transition(s,{type:'OPEN_DETAIL'});assert.equal(s.view,'detail');assert.equal(s.focusIntent,'detail-heading');s=transition(s,{type:'BACK'});assert.equal(s.view,'inventory');assert.equal(s.focusIntent,'item:weapon:1');assert.equal(s.selected.slot,1);});
test('back from inventory reaches profile',()=>{const s=transition(setupInventory(),{type:'BACK'});assert.equal(s.view,'profile');});
test('changing category clears selection',()=>{let s=selected(setupInventory());s=transition(s,{type:'SET_CATEGORY',category:'armor'});assert.equal(s.selected,null);assert.equal(s.category,'armor');});
test('category change is blocked within detail view',()=>{let s=transition(selected(setupInventory()),{type:'OPEN_DETAIL'});assert.equal(transition(s,{type:'SET_CATEGORY',category:'armor'}).category,'weapon');});
test('restricted response removes inventory data and exits detail',()=>{let s=transition(selected(setupInventory()),{type:'OPEN_DETAIL'});s=resolved(s,'inventory',null,'restricted');assert.equal(s.sections.inventory.state,'restricted');assert.equal(s.sections.inventory.data,null);assert.equal(s.view,'inventory');assert.equal(s.selected,null);});
test('not_initialized stays distinct from restricted',()=>{let s=resolved(auth(),'inventory',null,'not_initialized');assert.equal(s.sections.inventory.state,'not_initialized');assert.equal(s.sections.inventory.data,null);});
test('unavailable does not expose previous data',()=>{let s=setupInventory();s=resolved(s,'inventory',null,'unavailable');assert.equal(s.sections.inventory.state,'unavailable');assert.equal(s.sections.inventory.data,null);});
test('HTTP unauthorized revokes local data for BOTH sections',()=>{let s=resolved(auth(),'profile',profile());s=resolved(s,'inventory',inventory());const id=++req;s=transition(s,{type:'FETCH_STARTED',section:'profile',requestId:id,epoch:s.epoch});s=transition(s,{type:'FETCH_FINISHED',section:'profile',requestId:id,epoch:s.epoch,domainState:'unauthorized'});assert.equal(s.authorized,false);assert.equal(s.sections.profile.data,null);assert.equal(s.sections.inventory.data,null);});
test('logout discards all data, selection, and focus history',()=>{let s=transition(selected(setupInventory()),{type:'OPEN_DETAIL'});s=transition(s,{type:'LOGOUT'});assert.equal(s.authorized,false);assert.equal(s.selected,null);assert.equal(s.detailOrigin,null);assert.equal(s.sections.inventory.data,null);});
test('late reply from previous session epoch is ignored',()=>{let s=auth(),epoch=s.epoch,id=++req;s=transition(s,{type:'FETCH_STARTED',section:'inventory',requestId:id,epoch});s=transition(s,{type:'AUTH_ESTABLISHED'});assert.deepEqual(transition(s,{type:'FETCH_FINISHED',section:'inventory',requestId:id,epoch,domainState:'ready',data:inventory()}),s);});
test('older reply cannot overwrite newer request',()=>{let s=auth(),epoch=s.epoch,id=++req;s=transition(s,{type:'FETCH_STARTED',section:'inventory',requestId:id,epoch});let newer=id+1;req++;s=transition(s,{type:'FETCH_STARTED',section:'inventory',requestId:newer,epoch});assert.deepEqual(transition(s,{type:'FETCH_FINISHED',section:'inventory',requestId:id,epoch,domainState:'ready',data:inventory()}),s);});
test('starting refresh clears previously visible detail and data',()=>{let s=transition(selected(setupInventory()),{type:'OPEN_DETAIL'});s=transition(s,{type:'FETCH_STARTED',section:'inventory',requestId:++req,epoch:s.epoch});assert.equal(s.view,'inventory');assert.equal(s.sections.inventory.data,null);assert.equal(s.sections.inventory.state,'loading');});
test('reloaded same slot and item can preserve selection for return',()=>{let s=selected(setupInventory());s=resolved(s,'inventory',inventory());assert.deepEqual(s.selected,{category:'weapon',slot:1,id:7});});
test('changed item in the SAME slot invalidates old selection',()=>{let s=selected(setupInventory());const n=inventory();n.categories[0].reserves[0].display.id=8;s=resolved(s,'inventory',n);assert.equal(s.selected,null);});
test('missing item after refresh invalidates old selection',()=>{let s=selected(setupInventory());const n=inventory();n.categories[0].reserves=[];s=resolved(s,'inventory',n);assert.equal(s.selected,null);});
test('projected profile cannot contain raw keycloakId',()=>{let s=resolved(auth(),'profile',{...profile(),keycloakId:'should-not-exist'});assert.equal(s.sections.profile.state,'unavailable');assert.equal(s.sections.profile.data,null);});
test('projected inventory cannot contain nested private actor info',()=>{let p=inventory();p.categories[0].active.ownerId=3;let s=resolved(auth(),'inventory',p);assert.equal(s.sections.inventory.state,'unavailable');});
test('screen never constructs a player name not available from packet',()=>{const s=resolved(auth(),'profile',profile());assert.equal(Object.hasOwn(s.sections.profile.data,'name'),false);});
test('arbitrary mutation event has no effect',()=>{let s=selected(setupInventory());assert.deepEqual(transition(s,{type:'EQUIP',slot:1}),s);});
test('unknown domain state never reintroduces data',()=>{let s=auth();let id=++req;s=transition(s,{type:'FETCH_STARTED',section:'profile',requestId:id,epoch:s.epoch});assert.deepEqual(transition(s,{type:'FETCH_FINISHED',section:'profile',requestId:id,epoch:s.epoch,domainState:'absent',data:profile()}),s);});