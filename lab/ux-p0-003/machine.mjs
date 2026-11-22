/** Copy of pinned UX-P0-003 machine, for local validation only. */
export const P0_CATEGORIES = Object.freeze(['weapon', 'armor', 'potion', 'object']);
export const P0_DOMAIN_STATES = Object.freeze(['ready', 'not_initialized', 'restricted', 'unavailable']);
const SECTION_NAMES = new Set(['profile', 'inventory']);
const DOMAIN_STATES = new Set(P0_DOMAIN_STATES);
const PRIVATE_KEYS = new Set(['keycloakId', 'playerId', 'ownerId', 'askedPlayer', 'sessionToken', 'bindingRef']);
const SAFE_PROFILE_FIELDS = new Set(['level','health','experience','money','badges','missions','rank','effect','kingChallengeTier',
  'classId','destinationId','mapTypeId','guild','color','stats','fightRanking','pet','tokens','cooking']);
const SAFE_INVENTORY_FIELDS = new Set(['categories','materials','talismans','plants']);
function freshSection() {return {state:'idle',requestId:null,asOf:null,data:null};}
export function initialState(){return {authorized:false,epoch:0,view:'profile',category:'weapon',selected:null,
  detailOrigin:null,focusIntent:'profile-heading',sections:{profile:freshSection(),inventory:freshSection()}};}
function safeTree(node,depth=0){
 if(depth>16) return false;
 if(!node || typeof node!=='object') return true;
 if(Array.isArray(node))return node.length<=10000&&node.every(v=>safeTree(v,depth+1));
 for(const [k,v] of Object.entries(node)) if(PRIVATE_KEYS.has(k)||!safeTree(v,depth+1))return false;
 return true;
}
function safeSnapshot(section,data){
 if(!data||typeof data!=='object'||Array.isArray(data)||!safeTree(data))return false;
 const allowed=section==='profile'?SAFE_PROFILE_FIELDS:SAFE_INVENTORY_FIELDS;
 if(Object.keys(data).some(k=>!allowed.has(k)))return false;
 if(section==='profile')return Number.isSafeInteger(data.level)&&data.level>=0;
 return Array.isArray(data.categories)&&data.categories.length===4&&
  P0_CATEGORIES.every((name,i)=>data.categories[i]?.category===name&&
    data.categories[i]?.active&&Array.isArray(data.categories[i]?.reserves));
}
export function itemAt(data,category,slot){
 if(!P0_CATEGORIES.includes(category)||!Number.isSafeInteger(slot)||slot<0)return null;
 const c=data?.categories?.find(c=>c.category===category);
 if(!c)return null;
 const item=slot===0?c.active:c.reserves.find(r=>r.slot===slot)?.display;
 if(!item||!Number.isSafeInteger(item.id)||item.id<0)return null;
 return {category,slot,id:item.id};
}
function stillSame(data,selected){const actual=selected&&itemAt(data,selected.category,selected.slot);
 return actual&&actual.id===selected.id?actual:null;}
function replaceSection(state,section,patch){return {...state,sections:{...state.sections,[section]:patch}};}
function clearDetail(state){return {...state,selected:null,detailOrigin:null,view:state.view==='detail'?'inventory':state.view,focusIntent:'inventory-heading'};}
export function transition(state,event){
 const e=event??{};
 if(e.type==='AUTH_LOST'||e.type==='LOGOUT')return {...initialState(),epoch:state.epoch+1};
 if(e.type==='AUTH_ESTABLISHED')return {...initialState(),authorized:true,epoch:state.epoch+1};
 if(!state.authorized)return state;
 if(e.type==='GO_PROFILE')return {...state,view:'profile',detailOrigin:null,focusIntent:'profile-heading'};
 if(e.type==='GO_INVENTORY')return {...state,view:'inventory',detailOrigin:null,focusIntent:'inventory-heading'};
 if(e.type==='SET_CATEGORY'){
  if(!P0_CATEGORIES.includes(e.category)||state.view==='detail')return state;
  return {...state,category:e.category,selected:null,detailOrigin:null,focusIntent:'category-tab'};
 }
 if(e.type==='FETCH_STARTED'){
  if(!SECTION_NAMES.has(e.section)||!Number.isSafeInteger(e.requestId)||e.requestId<1||
    e.epoch!==state.epoch)return state;
  const previous=state.sections[e.section];
  if(previous.requestId!==null&&e.requestId<=previous.requestId)return state;
  let next=replaceSection(state,e.section,{state:'loading',requestId:e.requestId,asOf:null,data:null});
  // Hide old detail immediately. Keep only its inert identity through loading;
  // FETCH_FINISHED revalidates category + slot + ID before restoring selection.
  if(e.section==='inventory'&&state.view==='detail')next={...next,view:'inventory',detailOrigin:null,focusIntent:'inventory-heading'};
  return next;
 }
 if(e.type==='FETCH_FINISHED'){
  if(!SECTION_NAMES.has(e.section)||e.epoch!==state.epoch)return state;
  // A 401 is a session-security signal: a same-epoch delayed 401 must revoke
  // even when a newer request superseded it. An old-epoch 401 was rejected above.
  if(e.domainState==='unauthorized')return {...initialState(),epoch:state.epoch+1};
  const previous=state.sections[e.section];
  if(previous.state!=='loading'||previous.requestId!==e.requestId)return state;
  if(!DOMAIN_STATES.has(e.domainState))return state;
  const valid=e.domainState!=='ready'||safeSnapshot(e.section,e.data);
  const resolved=valid?e.domainState:'unavailable';
  const body={state:resolved,requestId:e.requestId,asOf:resolved==='ready'&&typeof e.asOf==='string'?e.asOf:null,
    data:resolved==='ready'?structuredClone(e.data):null};
  let next=replaceSection(state,e.section,body);
  if(e.section==='inventory'){
   const preserved=resolved==='ready'?stillSame(body.data,state.selected):null;
   next={...next,selected:preserved};
   if(!preserved&&state.view==='detail')next=clearDetail(next);
  }
  return next;
 }
 if(e.type==='SELECT_ITEM'){
  if(state.view!=='inventory'||state.sections.inventory.state!=='ready'||
    e.category!==state.category)return state;
  const match=itemAt(state.sections.inventory.data,e.category,e.slot);
  return match?{...state,selected:match,detailOrigin:null,focusIntent:`item:${match.category}:${match.slot}`}:state;
 }
 if(e.type==='OPEN_DETAIL'){
  if(state.view!=='inventory'||state.sections.inventory.state!=='ready'||!state.selected)return state;
  const found=stillSame(state.sections.inventory.data,state.selected);
  return found?{...state,view:'detail',selected:found,detailOrigin:`item:${found.category}:${found.slot}`,focusIntent:'detail-heading'}:state;
 }
 if(e.type==='BACK'){
  if(state.view==='detail')return {...state,view:'inventory',focusIntent:stillSame(state.sections.inventory.data,state.selected)?state.detailOrigin:'category-tab',detailOrigin:null};
  if(state.view==='inventory')return {...state,view:'profile',focusIntent:'profile-heading'};
 }
 return state;
}
export function canInspect(state){return state.authorized&&state.view==='inventory'&&
 state.sections.inventory.state==='ready'&&!!stillSame(state.sections.inventory.data,state.selected);}
