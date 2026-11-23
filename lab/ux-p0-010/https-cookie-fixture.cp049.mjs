/**
 * CP049 temporary localhost TLS fixture, with a private stdin-only approval
 * channel used by the Python cookie-jar test. NEVER expose this control as HTTP.
 * IDs, authority and pepper are fictional; no production databases.
 */
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {IdentityLedger} from '../cp014/identity.mjs';
import {createCP049HttpsLab} from './https-loopback.cp049.mjs';
import {createInterface} from 'node:readline';
const key=readFileSync(process.argv[2]),cert=readFileSync(process.argv[3]);
// CP053 opt-in: the original HTTPS-only allowlist, never a generic static server.
// Unset by default to preserve CP049 CookieJar and API-only test behavior.
const publicAssetsRoot=process.env.CROWNICLES_P0_LAB_STATIC==='1'
 ? resolve(dirname(fileURLToPath(import.meta.url)),'../..'):undefined;
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ref={a:'a'.repeat(64),b:'b'.repeat(64)},ids={a:A,b:B};
const ledger=new IdentityLedger({pepper:Buffer.alloc(32,0x51)});
const bindings=new Map(Object.entries(ref).map(([label,r])=>[r,{actor:ids[label],epoch:1}]));
for(const label of ['a','b'])ledger.observeBinding({ref:ref[label],actor:ids[label],epoch:1});
const attribute=()=>({baseValue:1,upgradeValue:0,maxValue:1});
const main=c=>({id:0,rarity:1,itemCategory:c,itemLevel:0,attack:attribute(),defense:attribute(),speed:attribute()});
const support=c=>({id:0,rarity:1,itemCategory:c,nature:1,power:1,maxPower:1});
const readNativeOwn=async({actorId,section})=>({actorId,state:'ready',packet:section==='profile'?{playerData:{
 level:actorId===A?12:77,health:{value:2,max:5},experience:{value:1,max:2},money:actorId===A?111:777,badges:[],
 missions:{gems:0,campaignProgression:1},rank:{rank:-1,unranked:true,numberOfPlayers:1,score:0},
 effect:{healed:true,timeLeft:0,effect:'none',hasTimeDisplay:false},kingChallengeTier:0
 }}:{foundPlayer:true,data:{weapon:main(0),armor:main(1),potion:support(2),object:support(3),
 backupWeapons:[],backupArmors:[],backupPotions:[],backupObjects:[],slots:{weapons:1,armors:1,potions:1,objects:1},materials:[],
 plants:{maxPlantSlots:1,plantSlots:[],linkedToHomeStorage:false}}}});
const server=createCP049HttpsLab({tls:{key,cert},ledger,authority:{readBinding:async r=>bindings.get(r)??null},
 rateScopeFor:async req=>{const user=req.headers['x-fixture-user'];return user==='b'?ref.b:ref.a},readNativeOwn,publicAssetsRoot});
server.listen(0,'127.0.0.1',()=>{
 const port=server.address().port;
 console.log(JSON.stringify({ready:true,port,...(publicAssetsRoot?{
  previewUrl:`https://127.0.0.1:${port}/lab/ux-p0-010/preview.html`
 }:{})}));
});
const input=createInterface({input:process.stdin,crlfDelay:Infinity});
for await(const line of input){
 try{
  const {command,user,code}=JSON.parse(line),r=ref[user],actor=ids[user];
  if(command==='approve'&&r){
   const ctx={channel:'private',verified:true,ref:r,actor,epoch:1,confirmed:true};
   const p=ledger.prepareApproval(code,ctx);
   const ok=p.status==='confirm'&&ledger.confirmApproval(p.approvalNonce,ctx).status==='approved';
   console.log(JSON.stringify({ok}));
  }else if(command==='unbind'&&r){
   // Revocation changes only this binding. Rebinding to another already-bound
   // actor is a collision and the canonical ledger quarantines both accounts.
   const changed={actor:null,epoch:2};
   bindings.set(r,changed);ledger.observeBinding({ref:r,...changed});
   console.log(JSON.stringify({ok:true}));
  }else if(command==='exit'){console.log(JSON.stringify({ok:true}));break;}
  else console.log(JSON.stringify({ok:false}));
 }catch{console.log(JSON.stringify({ok:false}));}
}
await new Promise(resolve=>server.close(resolve));ledger.close();
