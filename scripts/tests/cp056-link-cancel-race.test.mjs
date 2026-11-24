/** CP056: source-pinned lab identity and session gateway. All identities synthetic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {createServer, request as httpRequest} from 'node:http';
import {IdentityLedger} from '../../lab/cp014/identity.mjs';
import {createSessionHandler} from '../../lab/cp014/session-gateway.mjs';
const REF='1'.repeat(64),ACTOR='12345678-1234-1234-1234-123456789abc',REF2='2'.repeat(64),ACTOR2='22345678-1234-1234-1234-123456789abc';
const ORIGIN='https://portal.example.test',TIME=1000000,PEPPER=Buffer.alloc(32,5),LINK='__Host-crownicles_link',SESSION='__Host-crownicles_session';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {resolve,promise}};
function approve(ledger,ref=REF,actor=ACTOR,scope='3'.repeat(64)){
 const challenge=ledger.issueChallenge(scope);assert.equal(challenge.status,'issued');
 const ctx={ref,actor,epoch:1,verified:true,channel:'private',confirmed:true};
 const approval=ledger.prepareApproval(challenge.code,ctx);assert.equal(approval.status,'confirm');assert.equal(ledger.confirmApproval(approval.approvalNonce,ctx).status,'approved');return challenge;
}
function makeLedger(t){const ledger=new IdentityLedger({pepper:PEPPER,clock:()=>TIME});t.after(()=>ledger.close());ledger.observeBinding({ref:REF,actor:ACTOR,epoch:1});ledger.observeBinding({ref:REF2,actor:ACTOR2,epoch:1});return ledger}
const cookieOf=(r,name)=>r.headers['set-cookie']?.find(c=>c.startsWith(name+'='))?.split(';')[0].split('=')[1];
async function fixture(t,{pauseAt=2}={}){
 const ledger=makeLedger(t),challenge=approve(ledger),pause=deferred(),entered=deferred();let calls=0;
 const authority={readBinding:async(ref)=>{if(++calls===pauseAt){entered.resolve();await pause.promise;}return {actor:ref===REF?ACTOR:ACTOR2,epoch:1}}};
 const handler=createSessionHandler({ledger,authority,repo:{},origin:ORIGIN,rateScopeFor:()=> '4'.repeat(64),clock:()=>TIME});
 const server=createServer(handler);server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{pause.resolve();server.closeAllConnections();await new Promise(r=>server.close(r))});
 const request=(path,secret=challenge.browserSecret,session)=>new Promise((resolve,reject)=>{
  const cookies=[secret&&`${LINK}=${secret}`,session&&`${SESSION}=${session}`].filter(Boolean).join('; ');
  const req=httpRequest({host:'127.0.0.1',port:server.address().port,path,method:'POST',headers:{origin:ORIGIN,...(cookies?{cookie:cookies}:{})}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>{try{resolve({status:res.statusCode,body:JSON.parse(body),headers:res.headers})}catch(e){reject(e)}})});
  req.on('error',reject);req.setTimeout(2000,()=>req.destroy(Error('test HTTP deadline')));req.end();
 });
 return {ledger,challenge,pause,entered,request};
}
test('CP056 cancel before redeem prevents session', {timeout:4000},async t=>{const x=await fixture(t,{pauseAt:99});const c=await x.request('/v1/link/cancel');assert.equal(c.body.status,'cancelled');assert.equal((await x.request('/v1/link/redeem')).status,401);assert.equal(x.ledger.db.prepare('SELECT COUNT(*) n FROM sessions').get().n,0)});
test('CP056 cancel while initial authority read is pending prevents consumption',{timeout:4000},async t=>{const x=await fixture(t,{pauseAt:1});const pending=x.request('/v1/link/redeem');await x.entered.promise;const c=await x.request('/v1/link/cancel');x.pause.resolve();const r=await pending;assert.equal(c.status,200);assert.equal(c.body.status,'cancelled');assert.equal(r.status,401);assert.equal(cookieOf(r,SESSION),undefined)});
test('CP056 cancel while post-consumption authority read is pending revokes exact issued session',{timeout:4000},async t=>{const x=await fixture(t);const pending=x.request('/v1/link/redeem');await x.entered.promise;const c=await x.request('/v1/link/cancel');x.pause.resolve();const r=await pending;assert.equal(c.status,200);assert.equal(c.body.status,'cancelled');assert.equal(r.status,401);assert.equal(cookieOf(r,SESSION),undefined);assert.equal(x.ledger.db.prepare('SELECT COUNT(*) n FROM sessions WHERE revoked=0').get().n,0)});
test('CP056 normal redemption still returns a valid session and is single-use',{timeout:4000},async t=>{const x=await fixture(t,{pauseAt:99});const r=await x.request('/v1/link/redeem');assert.equal(r.status,200);assert.ok(x.ledger.inspectSession(cookieOf(r,SESSION)));assert.equal((await x.request('/v1/link/redeem')).status,401)});
test('CP056 cancel after redeemed response revokes its exact session, repeat is idempotent',{timeout:4000},async t=>{const x=await fixture(t,{pauseAt:99});const r=await x.request('/v1/link/redeem');const token=cookieOf(r,SESSION);assert.ok(x.ledger.inspectSession(token));const c=await x.request('/v1/link/cancel');assert.equal(c.body.status,'cancelled');assert.equal(x.ledger.inspectSession(token),null);assert.equal((await x.request('/v1/link/cancel')).body.status,'cancelled')});
test('CP056 unknown or missing challenge is not a cancellation confirmation',{timeout:4000},async t=>{const x=await fixture(t,{pauseAt:99});for(const secret of [randomBytes(32).toString('base64url'),null,'bad']){const c=await x.request('/v1/link/cancel',secret);assert.equal(c.status,409);assert.equal(c.body.status,'unavailable')}});
test('CP056 cancellation cannot affect another challenge even for the same player',t=>{const ledger=makeLedger(t);const a=approve(ledger),b=approve(ledger),c=approve(ledger,REF2,ACTOR2);const ar=ledger.redeem(a.browserSecret),br=ledger.redeem(b.browserSecret),cr=ledger.redeem(c.browserSecret);assert.equal(ledger.cancelChallenge(a.browserSecret).status,'cancelled');assert.equal(ledger.inspectSession(ar.sessionToken),null);assert.equal(ledger.inspectSession(br.sessionToken).actorId,ACTOR);assert.equal(ledger.inspectSession(cr.sessionToken).actorId,ACTOR2)});
test('CP056 association survives a real SQLite close/reopen',t=>{const dir=mkdtempSync(join(tmpdir(),'cp056-link-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const opts={file:join(dir,'lab.sqlite'),pepper:PEPPER,clock:()=>TIME};let ledger=new IdentityLedger(opts);try{ledger.observeBinding({ref:REF,actor:ACTOR,epoch:1});const challenge=approve(ledger),r=ledger.redeem(challenge.browserSecret);ledger.close();ledger=new IdentityLedger(opts);assert.ok(ledger.inspectSession(r.sessionToken));assert.equal(ledger.cancelChallenge(challenge.browserSecret).status,'cancelled');assert.equal(ledger.inspectSession(r.sessionToken),null)}finally{ledger.close()}});
test('CP056 legacy consumed row without an association is not falsely confirmed',t=>{const ledger=makeLedger(t);const challenge=approve(ledger),r=ledger.redeem(challenge.browserSecret);ledger.db.exec('DELETE FROM challenge_sessions');assert.equal(ledger.cancelChallenge(challenge.browserSecret).status,'unavailable');assert.ok(ledger.inspectSession(r.sessionToken));ledger.revokeSession(r.sessionToken)});
test('CP056 if association persistence fails, redeem transaction rolls back',t=>{const ledger=makeLedger(t),challenge=approve(ledger);ledger.db.exec("CREATE TRIGGER fail_assoc BEFORE INSERT ON challenge_sessions BEGIN SELECT RAISE(ABORT,'fixture fault'); END");assert.throws(()=>ledger.redeem(challenge.browserSecret),/fixture fault/);assert.equal(ledger.challengeStatus(challenge.browserSecret).status,'approved');assert.equal(ledger.db.prepare('SELECT COUNT(*) n FROM sessions').get().n,0);ledger.db.exec('DROP TRIGGER fail_assoc');assert.equal(ledger.redeem(challenge.browserSecret).status,'redeemed')});
test('CP056 pruning expired challenge removes association without revoking an unrelated live session',t=>{let now=TIME;const ledger=new IdentityLedger({pepper:PEPPER,clock:()=>now});t.after(()=>ledger.close());ledger.observeBinding({ref:REF,actor:ACTOR,epoch:1});const a=approve(ledger),r=ledger.redeem(a.browserSecret);now=a.expiresAt+1;assert.equal(ledger.prune().challenges,1);assert.equal(ledger.db.prepare('SELECT COUNT(*) n FROM challenge_sessions').get().n,0);assert.ok(ledger.inspectSession(r.sessionToken));assert.equal(ledger.cancelChallenge(a.browserSecret).status,'unavailable')});
