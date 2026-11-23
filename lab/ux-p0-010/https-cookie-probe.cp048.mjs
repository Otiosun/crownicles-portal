/** CP048 disposable TLS/cURL cookie experiment. Test-only; never deploy. */
import https from 'node:https';
import {readFileSync} from 'node:fs';
import {IdentityLedger} from '../cp014/identity.mjs';
import {createSessionHandler} from '../cp014/session-gateway.mjs';
import {createCP014Resolver,createP0NativeHttpHandler} from '../../integration/p0/secure-native-read.cp046.mjs';
const certPath=process.env.CP048_CERT,keyPath=process.env.CP048_KEY;
if(!certPath||!keyPath)throw Error('DISPOSABLE_TLS_FILES_REQUIRED');
const ledger=new IdentityLedger({pepper:Buffer.alloc(32,0x48)});
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',REF='a'.repeat(64);
ledger.observeBinding({ref:REF,actor:A,epoch:1});
const authority={readBinding:async ref=>ref===REF?{actor:A,epoch:1}:null};
let session;
const read=createP0NativeHttpHandler({resolveFreshSession:createCP014Resolver({ledger,authority}),readNativeOwn:async({actorId,section})=>({actorId,state:'ready',packet:{playerData:{level:12,health:{value:5,max:5},experience:{value:0,max:1},money:23,badges:[],missions:{gems:0,campaignProgression:0},rank:{unranked:true,rank:-1,numberOfPlayers:0,score:0},effect:{healed:false,timeLeft:0,effect:'none',hasTimeDisplay:false},kingChallengeTier:0}}})});
const server=https.createServer({key:readFileSync(keyPath),cert:readFileSync(certPath)},(req,res)=>{
 if(req.url==='/v1/me/profile')return read(req,res);
 return session(req,res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
session=createSessionHandler({ledger,authority,repo:{},rateScopeFor:async()=>REF,origin:'https://127.0.0.1:'+port});
console.log(JSON.stringify({port,ready:true}));
process.stdin.setEncoding('utf8');
process.stdin.on('data',text=>{
 for(const line of text.split('\n').filter(Boolean)){
  if(line==='SHUTDOWN'){server.close(()=>{ledger.close();process.exit(0)});continue;}
  if(line.startsWith('APPROVE ')){
   const code=line.slice(8),ctx={channel:'private',verified:true,ref:REF,actor:A,epoch:1,confirmed:true};
   const p=ledger.prepareApproval(code,ctx);
   const q=p.status==='confirm'?ledger.confirmApproval(p.approvalNonce,ctx):p;
   console.log(JSON.stringify({approved:q.status==='approved'}));
  }
 }
});
