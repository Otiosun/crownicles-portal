import test, {before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import https from 'node:https';
import http from 'node:http';
import {IdentityLedger} from '../cp014/identity.mjs';
import {createCP049HttpsLab} from './https-loopback.cp049.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const REF_A='a'.repeat(64),REF_B='b'.repeat(64);
const attr=()=>({baseValue:2,upgradeValue:0,maxValue:10});
const item=(n,i)=>({id:0,rarity:1,itemCategory:i,itemLevel:0,attack:attr(),defense:attr(),speed:attr()});
const support=i=>({id:0,rarity:1,itemCategory:i,nature:1,power:1,maxPower:2});
function packet(section,id){
 if(section==='profile')return {playerData:{level:id===A?12:77,health:{value:5,max:12},experience:{value:1,max:4},money:id===A?111:777,badges:[],missions:{gems:0,campaignProgression:4},rank:{rank:-1,unranked:true,numberOfPlayers:0,score:0},effect:{healed:false,timeLeft:-1,effect:'none',hasTimeDisplay:false},kingChallengeTier:0,ownerId:'NOT_ALLOWED'}};
 return {foundPlayer:true,data:{weapon:item(0,0),armor:item(0,1),potion:support(2),object:support(3),backupWeapons:[],backupArmors:[],backupPotions:[],backupObjects:[],slots:{weapons:1,armors:1,potions:1,objects:1},materials:[],plants:{maxPlantSlots:1,plantSlots:[{slot:0,plantId:1}],linkedToHomeStorage:false}}};
}
let server,ledger,cert,key,dir,port,origin,bindings,reads=[];
const closed=async s=>await new Promise((resolve,reject)=>s.close(e=>e?reject(e):resolve()));
function request(path,{method='GET',jar,originHeader,host,ca=cert,rejectUnauthorized=true,body}={}){
 return new Promise((resolve,reject)=>{
  const headers={Host:host??`127.0.0.1:${port}`,Accept:'application/json'};
  if(originHeader!==undefined)headers.Origin=originHeader;
  if(jar&&jar.size)headers.Cookie=[...jar].map(([n,v])=>`${n}=${v}`).join('; ');
  const req=https.request({host:'127.0.0.1',port,path,method,headers,ca:ca===null?undefined:ca,servername:'',rejectUnauthorized,timeout:3000},res=>{
   const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>{
    const text=Buffer.concat(chunks).toString('utf8');let payload;
    try{payload=JSON.parse(text)}catch{payload=null}
    if(jar)for(const c of res.headers['set-cookie']??[]){
     const match=c.match(/^(__Host-crownicles_(?:link|session))=([^;]*)/);
     if(!match)continue;
     assert.match(c,/; Secure; HttpOnly; SameSite=Strict/i);
     assert.match(c,/; Path=\//i);
     assert.ok(!/; Domain=/i.test(c),'__Host cookie must be host-only');
     if(/; Max-Age=0(?:;|$)/i.test(c))jar.delete(match[1]);else jar.set(match[1],match[2]);
    }
    resolve({status:res.statusCode,headers:res.headers,body:payload,bytes:text.length,tlsAuthorized:req.socket.authorized});
   });
  });
  req.on('error',reject);req.on('timeout',()=>req.destroy(Error('TIMEOUT')));req.end(body);
 });
}
const cookies=()=>new Map();
async function start(jar){const r=await request('/v1/link/start',{method:'POST',originHeader:origin,jar});assert.equal(r.status,201);assert.equal(r.body.status,'issued');return r.body.code;}
function approve(code,ref,actor){const ctx={channel:'private',verified:true,ref,actor,epoch:1,confirmed:true};const v=ledger.prepareApproval(code,ctx);assert.equal(v.status,'confirm');assert.equal(ledger.confirmApproval(v.approvalNonce,ctx).status,'approved')}
async function finish(jar){let r=await request('/v1/link/status',{jar});assert.equal(r.body.status,'approved');r=await request('/v1/link/redeem',{method:'POST',jar,originHeader:origin});assert.equal(r.status,200);assert.equal(r.body.status,'redeemed');return r}
before(async()=>{
 dir=await mkdtemp(join(tmpdir(),'cp049-https-'));
 const keyPath=join(dir,'key.pem'),certPath=join(dir,'cert.pem');
 const proc=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',keyPath,'-out',certPath,'-days','1','-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1'],{encoding:'utf8'});
 if(proc.status!==0)throw Error('CP049_OPENSSL_REQUIRED '+proc.stderr?.slice(-160));
 key=await readFile(keyPath);cert=await readFile(certPath);
});
beforeEach(async()=>{
 ledger=new IdentityLedger({pepper:Buffer.alloc(32,0x49)});
 bindings=new Map([[REF_A,{actor:A,epoch:1}],[REF_B,{actor:B,epoch:1}]]);
 ledger.observeBinding({ref:REF_A,actor:A,epoch:1});ledger.observeBinding({ref:REF_B,actor:B,epoch:1});
 const authority={readBinding:async ref=>bindings.get(ref)??null};
 server=createCP049HttpsLab({tls:{key,cert},ledger,authority,rateScopeFor:async()=>REF_A,
   readNativeOwn:async({actorId,section})=>{reads.push([actorId,section]);return {actorId,state:'ready',packet:packet(section,actorId)}}});
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve));
 port=server.address().port;origin=`https://127.0.0.1:${port}`;
});
afterEach(async()=>{if(server?.listening)await closed(server);ledger?.close();server=null;ledger=null;});
after(async()=>{if(dir)await rm(dir,{recursive:true,force:true});});

test('CP049 requires TLS and explicit loopback binding before any listening',()=>{
 assert.throws(()=>createCP049HttpsLab({}),/TLS_PRIVATE_KEY_AND_CERT_REQUIRED/);
 const fake=createCP049HttpsLab({tls:{key,cert},ledger,authority:{readBinding:async()=>null},rateScopeFor:async()=>REF_A,readNativeOwn:async()=>null});
 for(const args of [[0],[0,'0.0.0.0'],[{port:0,host:'::'}],['/tmp/crownicles-not-created.sock'],[{fd:1}],[0,'localhost']])assert.throws(()=>fake.listen(...args),/CP049_LOOPBACK_ONLY/);
});
test('CP049 genuinely negotiated certificate-verified TLS, with no insecure HTTP fallback',async()=>{
 const r=await request('/v1/me/profile');assert.equal(r.tlsAuthorized,true);assert.equal(r.status,401);
 await assert.rejects(request('/v1/me/profile',{ca:null}),/certificate|self.signed|unable.to.verify/i); // verified CA must be supplied
 await assert.rejects(new Promise((resolve,reject)=>{http.get({host:'127.0.0.1',port,path:'/v1/me/profile',timeout:2000},resolve).on('error',reject)}));
});
test('CP049 denies arbitrary Host even with TLS and no bearer credentials',async()=>{
 let r=await request('/v1/link/start',{method:'POST',originHeader:origin,host:'not-crownicles.local'});assert.equal(r.status,421);
 r=await request('/v1/me/profile',{host:'localhost:'+port});assert.equal(r.status,421);assert.deepEqual(r.body,{error:'invalid_host'});
});
test('CP049 unapproved or missing session cannot access native data',async()=>{
 const jar=cookies();assert.equal((await request('/v1/me/profile',{jar})).status,401);
 const count=reads.length;const code=await start(jar);assert.ok(code);assert.equal((await request('/v1/me/profile',{jar})).status,401);assert.equal(reads.length,count);
 assert.equal(jar.has('__Host-crownicles_link'),true);assert.equal(jar.has('__Host-crownicles_session'),false);
 await request('/v1/link/cancel',{method:'POST',jar,originHeader:origin});
});
test('CP049 private confirmed challenge goes via REAL TLS Set-Cookie to own profile/inventory, logout revokes',async()=>{
 const jar=cookies(),code=await start(jar);approve(code,REF_A,A);
 const pre=await request('/v1/link/status',{jar});assert.equal(pre.body.status,'approved');
 await finish(jar);
 assert.equal(jar.has('__Host-crownicles_link'),false);assert.equal(jar.has('__Host-crownicles_session'),true);
 const p=await request('/v1/me/profile',{jar});assert.equal(p.status,200);assert.equal(p.body.data.money,111);assert.equal(JSON.stringify(p.body).includes('NOT_ALLOWED'),false);
 const i=await request('/v1/me/inventory',{jar});assert.equal(i.status,200);assert.equal(i.body.data.categories[0].active.id,0);
 assert.equal(p.headers['cache-control'],'private, no-store');
 const bye=await request('/v1/session/logout',{jar,method:'POST',originHeader:origin});assert.equal(bye.status,200);assert.deepEqual(bye.body,{status:'signed_out'});
 assert.equal(jar.has('__Host-crownicles_session'),false);
 assert.equal((await request('/v1/me/profile',{jar})).status,401);
});
test('CP049 two distinct private sessions never cross actor data over TLS',async()=>{
 const a=cookies(),b=cookies();approve(await start(a),REF_A,A);approve(await start(b),REF_B,B);
 await finish(a);await finish(b);
 const pa=await request('/v1/me/profile',{jar:a}),pb=await request('/v1/me/profile',{jar:b});
 assert.equal(pa.body.data.money,111);assert.equal(pb.body.data.money,777);
 assert.notEqual(a.get('__Host-crownicles_session'),b.get('__Host-crownicles_session'));
 await request('/v1/session/logout',{jar:a,method:'POST',originHeader:origin});
 assert.equal((await request('/v1/me/profile',{jar:a})).status,401);
 assert.equal((await request('/v1/me/profile',{jar:b})).status,200);
});
test('CP049 authority rebinding revokes old session under real TLS, without copying another actor',async()=>{
 const a=cookies();approve(await start(a),REF_A,A);await finish(a);
 const snapshot=reads.length;
 bindings.set(REF_A,{actor:B,epoch:2});ledger.observeBinding({ref:REF_A,actor:B,epoch:2});
 const r=await request('/v1/me/profile',{jar:a});assert.equal(r.status,401);assert.equal(reads.length,snapshot);
 bindings.set(REF_A,{actor:A,epoch:3});ledger.observeBinding({ref:REF_A,actor:A,epoch:3});
});
test('CP049 same-origin POST enforced over actual TLS; untrusted origin cannot issue or redeem',async()=>{
 const jar=cookies();
 const bad=await request('/v1/link/start',{jar,method:'POST',originHeader:'https://evil.example'});
 assert.equal(bad.status,403);assert.equal(jar.size,0);
 const code=await start(jar);approve(code,REF_A,A);
 const retry=await request('/v1/link/redeem',{jar,method:'POST',originHeader:'https://evil.example'});
 assert.equal(retry.status,403);assert.equal(jar.has('__Host-crownicles_session'),false);
 await finish(jar);
});

test('CP049 rejects duplicated Host headers before CP014 can issue a challenge',async()=>{
 const r=await new Promise((resolve,reject)=>{
  const req=https.request({host:'127.0.0.1',port,path:'/v1/link/start',method:'POST',
   headers:['Host',`127.0.0.1:${port}`,'Host','evil.invalid','Origin',origin],
   ca:cert,servername:'',rejectUnauthorized:true},res=>{
    const c=[];res.on('data',b=>c.push(b));res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(c).toString('utf8')}));
   });req.on('error',reject);req.end();
 });
 assert.ok([400,421].includes(r.status),'duplicate Host must fail closed before challenge issuance');
 assert.equal(r.body.includes('issued'),false);
});
