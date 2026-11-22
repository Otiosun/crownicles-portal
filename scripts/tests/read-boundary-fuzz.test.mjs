import test from 'node:test';
import assert from 'node:assert/strict';
import {createPortalReadBoundary} from '../../integration/gateway/read-boundary.mjs';
const A='11111111-1111-4111-8111-111111111111';
const PATH='/api/portal/v1/read?';
const allowed=['property','chest','garden','pet','pantry'];
let seed=0xC0401234;
function rand(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;}
const pick=arr=>arr[rand()%arr.length];
const source=()=>{
 const stats={auth:0,read:0};
 const handle=createPortalReadBoundary({
  resolveVerifiedSubject:async()=>{stats.auth++;return A;},
  readSnapshot:async({sections})=>{stats.read++;return {state:'ready',version:1,sections:Object.fromEntries(sections.map(n=>[n,{state:'absent'}]))};}
 });
 const request=url=>({method:'GET',url,headers:{authorization:'Bearer opaque'}});
 return {handle,stats,request};
};

test('seeded mutations of query bytes never authenticate a noncanonical URL',async()=>{
 const {handle,stats,request}=source();
 const initial='sections=pet,garden';
 const alphabet=['%','&','=','+',';','#','?',' ','\t','\n','.',':','/','\\','\u0000','ç','A','Z','0','2','C','x',',','p','g'];
 let trials=0;
 for(let i=0;i<1400;i++){
  let q=initial;
  const idx=rand()%(q.length+1),ch=pick(alphabet);
  switch(rand()%3){
   case 0:q=q.slice(0,idx)+ch+q.slice(idx);break;
   case 1:q=q.slice(0,idx)+ch+q.slice(Math.min(idx+1,q.length));break;
   default:q=q.slice(0,idx)+q.slice(Math.min(idx+1,q.length));break;
  }
  if(q===initial)continue;
  const r=await handle(request(PATH+q));
  assert.notEqual(r.status,200,JSON.stringify(q));trials++;
 }
 assert.ok(trials>1000);
 assert.equal(stats.auth,0);assert.equal(stats.read,0);
});

test('seeded duplicated critical HTTP headers reject before session verification',async()=>{
 const {handle,stats,request}=source();
 const critical=['Authorization','Cookie','Content-Length','Transfer-Encoding'];
 const changeCase=name=>[...name].map(c=>rand()%2?c.toUpperCase():c.toLowerCase()).join('');
 for(let i=0;i<350;i++){
  const header=pick(critical),a=changeCase(header),b=changeCase(header);
  const rawHeaders=[a,'Bearer x',b,'Bearer y'];
  assert.equal((await handle({...request(PATH+'sections=pet'),rawHeaders})).status,400,a+' '+b);
 }
 assert.equal(stats.auth,0);assert.equal(stats.read,0);
});

test('canonical query in both accepted encodings survives random section order/subset',async()=>{
 const {handle,stats,request}=source();
 for(let i=0;i<150;i++){
  const shuffled=[...allowed].sort(()=>rand()%2?1:-1);
  const count=1+rand()%5;
  const sections=shuffled.slice(0,count);
  const query=rand()%2?'sections='+sections.join(','):new URLSearchParams({sections:sections.join(',')}).toString();
  const response=await handle(request(PATH+query));
  assert.equal(response.status,200,query);
  assert.deepEqual(Object.keys(JSON.parse(response.body).sections).sort(),[...sections].sort());
 }
 assert.equal(stats.auth,150);assert.equal(stats.read,150);
});

test('malformed body and signal values cannot escalate to read despite valid auth header',async()=>{
 const {handle,stats,request}=source();
 const badSignal=[{},[],null,42,'signal',false];
 const badBody=[{},[],42,'signal',false];
 for(const value of badSignal){
  assert.equal((await handle({...request(PATH+'sections=pet'),signal:value})).status,400);
 }
 for(const value of badBody){
  assert.equal((await handle({...request(PATH+'sections=pet'),body:value})).status,400);
 }
 assert.equal(stats.auth,0);assert.equal(stats.read,0);
});
