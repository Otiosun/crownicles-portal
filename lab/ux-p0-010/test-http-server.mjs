/** Test-only same-origin HTTP composition: CP014 REAL SQLite ledger + CP046.
 * Loopback-only, synthetic actors and session tokens. NEVER DEPLOY.
 * A public server/Keycloak/real DB is out of scope.
 */
import http from 'node:http';
import {IdentityLedger} from '../cp014/identity.mjs';
import {createSessionHandler} from '../cp014/session-gateway.mjs';
import {createP0NativeHttpHandler,createCP014Resolver} from '../../integration/p0/secure-native-read.cp046.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const REF_A='a'.repeat(64),REF_B='b'.repeat(64);
const ledger=new IdentityLedger({pepper:Buffer.alloc(32,42)});
const bindings=new Map([[REF_A,{actor:A,epoch:1}],[REF_B,{actor:B,epoch:1}]]);
const authority={readBinding:async ref=>bindings.get(ref)??null};
const sessions=new Map();
for(const [name,ref,actor] of [['A',REF_A,A],['B',REF_B,B]]){
 ledger.observeBinding({ref,actor,epoch:1});
 const challenge=ledger.issueChallenge(ref);
 const context={channel:'private',verified:true,ref,actor,epoch:1,confirmed:true};
 const prepared=ledger.prepareApproval(challenge.code,context);
 if(prepared.status!=='confirm'||ledger.confirmApproval(prepared.approvalNonce,context).status!=='approved')throw Error('CP014_TEST_AUTH_FAILED');
 const redemption=ledger.redeem(challenge.browserSecret);
 if(redemption.status!=='redeemed')throw Error('CP014_TEST_REDEEM_FAILED');
 sessions.set(name,redemption.sessionToken);
}
const stat=()=>({baseValue:1,upgradeValue:0,maxValue:3});
const equip=(id,itemCategory)=>({id,itemCategory,rarity:1,itemLevel:0,attack:stat(),defense:stat(),speed:stat()});
const support=itemCategory=>({id:0,itemCategory,rarity:1,nature:1,power:0,maxPower:1});
const profile=money=>({playerData:{level:money===12?12:15,health:{value:6,max:10},experience:{value:2,max:9},money,badges:[],missions:{gems:0,campaignProgression:0},rank:{unranked:true,rank:-1,numberOfPlayers:0,score:0},effect:{healed:false,timeLeft:0,effect:'none',hasTimeDisplay:false},kingChallengeTier:0,keycloakId:'DO_NOT_LEAK'}});
const inventory=owner=>({foundPlayer:true,keycloakId:'DO_NOT_LEAK',data:{weapon:equip(0,0),armor:equip(0,1),potion:support(2),object:support(3),backupWeapons:[{slot:1,display:equip(owner===A?7:9,0)},{slot:2,display:equip(owner===A?7:9,0)}],backupArmors:[],backupPotions:[],backupObjects:[],slots:{weapons:3,armors:1,potions:1,objects:1},materials:[],plants:{seed:1,maxPlantSlots:1,plantSlots:[],linkedToHomeStorage:false},privateActorId:owner}});
const auth=createCP014Resolver({ledger,authority});
const p0=createP0NativeHttpHandler({
 resolveFreshSession:auth,
 readNativeOwn:async({actorId,section,signal})=>{
  if(signal.aborted)throw Error('ABORTED');
  return {actorId,state:'ready',packet:section==='profile'?profile(actorId===A?12:77):inventory(actorId)};
 }
});
const cp014=createSessionHandler({ledger,authority,repo:{},rateScopeFor:async()=>REF_A,origin:'https://portal.example.test'});
const server=http.createServer((req,res)=>{
 if(req.url==='/v1/me/profile'||req.url==='/v1/me/inventory')return p0(req,res);
 return cp014(req,res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
console.log(JSON.stringify({port:server.address().port,tokens:Object.fromEntries(sessions)}));
process.stdin.setEncoding('utf8');
process.stdin.on('data',chunk=>{
 for(const cmd of chunk.split('\n').filter(Boolean)){
  if(cmd==='REVOKE_A')ledger.revokeSession(sessions.get('A'));
  if(cmd==='ROTATE_A'){bindings.set(REF_A,{actor:A,epoch:2});ledger.observeBinding({ref:REF_A,actor:A,epoch:2});}
  if(cmd==='SHUTDOWN'){server.close(()=>{ledger.close();process.exit(0)});}
 }
});
