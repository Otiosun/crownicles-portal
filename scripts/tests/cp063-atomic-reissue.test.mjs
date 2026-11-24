/** CP063: source-pinned atomic reissue behavior; synthetic HTTP / SQLite only.
 * Proves same-cookie concurrent reissue cannot issue two live codes, and that
 * fault injection rolls back the old token/session and new candidate together.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {IdentityLedger} from '../../lab/cp014/identity.mjs';
import {createSessionHandler} from '../../lab/cp014/session-gateway.mjs';
const REF='e'.repeat(64),ACTOR='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SCOPE='d'.repeat(64),ORIGIN='https://portal.example.test',LINK='__Host-crownicles_link';
const PEPPER=Buffer.alloc(32,67),NOW=1_800_000_000_000;
const count=(ledger,states="'pending','awaiting','approved'")=>ledger.db.prepare("SELECT count(*) n FROM challenges WHERE state IN ("+states+")").get().n;
function approve(ledger,challenge){const ctx={channel:'private',verified:true,ref:REF,actor:ACTOR,epoch:1,confirmed:true};
 const a=ledger.prepareApproval(challenge.code,ctx);assert.equal(a.status,'confirm');assert.equal(ledger.confirmApproval(a.approvalNonce,ctx).status,'approved');}
async function setup(t,{file=':memory:',parallel=1,scopeFor}={}){
 const first=new IdentityLedger({file,pepper:PEPPER,clock:()=>NOW});first.observeBinding({ref:REF,actor:ACTOR,epoch:1});
 const ledgers=[first];for(let i=1;i<parallel;i++)ledgers.push(new IdentityLedger({file,pepper:PEPPER,clock:()=>NOW}));
 const servers=[];
 for(const ledger of ledgers){const server=http.createServer(createSessionHandler({ledger,origin:ORIGIN,
  authority:{readBinding:async()=>({actor:ACTOR,epoch:1})},repo:{},clock:()=>NOW,rateScopeFor:scopeFor??(async()=>SCOPE)}));
  server.listen(0,'127.0.0.1');await once(server,'listening');servers.push(server);}
 t.after(async()=>{for(const s of servers){s.closeAllConnections();await new Promise(r=>s.close(r));}for(const l of ledgers)l.close();});
 const request=(path,link,serverIndex=0,origin=ORIGIN)=>new Promise((resolve,reject)=>{
  const server=servers[serverIndex],req=http.request({host:'127.0.0.1',port:server.address().port,path,method:'POST',
   headers:{Origin:origin,...(link?{Cookie:LINK+"="+link}:{})}},res=>{
     let body='';res.on('data',x=>body+=x);res.on('end',()=>{try{resolve({status:res.statusCode,data:JSON.parse(body),headers:res.headers})}catch(e){reject(e)}})});
  req.on('error',reject);req.setTimeout(2500,()=>req.destroy(Error('CP063_HTTP_TIMEOUT')));req.end();
 });
 return {ledger:first,ledgers,servers,request,issue:()=>first.issueChallenge(SCOPE)};
}
function cookies(result){return result.headers['set-cookie']??[];}
function countIssued(results){return results.filter(r=>r.status===201).length;}

test('CP063 two simultaneous requests with SAME old cookie issue exactly ONE usable new code',async t=>{
 let arrivals=0;let release;const both=new Promise(resolve=>release=resolve);
 const x=await setup(t,{scopeFor:async()=>{arrivals++;if(arrivals===2)release();await both;return SCOPE;}});
 const old=x.issue();const responses=await Promise.all([x.request('/v1/link/start',old.browserSecret),x.request('/v1/link/start',old.browserSecret)]);
 assert.equal(countIssued(responses),1,JSON.stringify(responses.map(r=>r.status)));
 assert.deepEqual(responses.map(r=>r.status).sort((a,b)=>a-b),[201,409]);
 assert.equal(count(x.ledger),1,'one active replacement, not two');
 assert.equal(x.ledger.challengeStatus(old.browserSecret).status,'unavailable');
 assert.equal(responses.filter(r=>r.status===201)[0].data.status,'issued');
 assert.equal(responses.filter(r=>r.status===409)[0].data.code,undefined);
});
test('CP063 two distinct SQLite connections cannot accept same old cookie twice',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'cp063-shared-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 let arrivals=0;let release;const both=new Promise(resolve=>release=resolve);
 const x=await setup(t,{file:join(dir,'ledger.sqlite'),parallel:2,
  scopeFor:async()=>{if(++arrivals===2)release();await both;return SCOPE;}});
 const old=x.issue();const res=await Promise.all([x.request('/v1/link/start',old.browserSecret,0),x.request('/v1/link/start',old.browserSecret,1)]);
 assert.equal(countIssued(res),1);assert.equal(count(x.ledger),1);
});
test('CP063 consumed linked challenge revokes exact old session and rejects replay',async t=>{
 const x=await setup(t),old=x.issue();approve(x.ledger,old);const created=x.ledger.redeem(old.browserSecret);
 assert.ok(x.ledger.inspectSession(created.sessionToken));
 assert.equal((await x.request('/v1/link/start',old.browserSecret)).status,201);
 assert.equal(x.ledger.inspectSession(created.sessionToken),null);
 assert.equal((await x.request('/v1/link/start',old.browserSecret)).status,409);
 assert.equal(count(x.ledger),1);
});
test('CP063 stale legacy consumed code without association must not issue a new code',async t=>{
 const x=await setup(t),old=x.issue();approve(x.ledger,old);const created=x.ledger.redeem(old.browserSecret);
 x.ledger.db.exec('DELETE FROM challenge_sessions');const before=count(x.ledger);
 const r=await x.request('/v1/link/start',old.browserSecret);
 assert.equal(r.status,409);assert.equal(r.data.status,'unavailable');assert.equal(count(x.ledger),before);
 assert.ok(x.ledger.inspectSession(created.sessionToken));
 assert.ok(cookies(r).some(c=>c.includes(LINK+'=;')&&c.includes('Max-Age=0')));
});
test('CP063 unknown or malformed old browser cookie never yields 201',async t=>{
 const x=await setup(t);for(const old of [randomBytes(32).toString('base64url'),'bad','z'.repeat(43)]){
  const n=count(x.ledger),r=await x.request('/v1/link/start',old);
  assert.equal(r.status,409);assert.equal(count(x.ledger),n);assert.equal(r.data.code,undefined);
 }
});
test('CP063 already-revoked old cookie cannot be reused for reissue',async t=>{
 const x=await setup(t),old=x.issue();assert.equal(x.ledger.cancelChallenge(old.browserSecret).status,'cancelled');
 const r=await x.request('/v1/link/start',old.browserSecret);assert.equal(r.status,409);assert.equal(count(x.ledger),0);
});
test('CP063 a valid approved code cannot redeem after replacement',async t=>{
 const x=await setup(t),old=x.issue();approve(x.ledger,old);
 const r=await x.request('/v1/link/start',old.browserSecret);assert.equal(r.status,201);
 assert.equal(x.ledger.redeem(old.browserSecret).status,'unavailable');assert.equal(count(x.ledger),1);
});
test('CP063 rate limit prevents replacement and leaves existing code valid',async t=>{
 const x=await setup(t),old=x.issue();for(let i=0;i<4;i++)assert.equal(x.issue().status,'issued');
 const before=count(x.ledger),r=await x.request('/v1/link/start',old.browserSecret);
 assert.equal(r.status,429);assert.equal(count(x.ledger),before);
 assert.equal(x.ledger.challengeStatus(old.browserSecret).status,'pending');
});
test('CP063 database failure issuing new code rolls back old challenge and quota',async t=>{
 const x=await setup(t),old=x.issue();const before=count(x.ledger),rate=x.ledger.db.prepare('SELECT attempts n FROM rate').get().n;
 x.ledger.db.exec("CREATE TRIGGER cp063_deny_insert BEFORE INSERT ON challenges BEGIN SELECT RAISE(ABORT,'CP063_TEST_INSERT_FAILURE'); END");
 const r=await x.request('/v1/link/start',old.browserSecret);
 assert.equal(r.status,503);assert.equal(count(x.ledger),before);
 assert.equal(x.ledger.challengeStatus(old.browserSecret).status,'pending');
 assert.equal(x.ledger.db.prepare('SELECT attempts n FROM rate').get().n,rate);
});
test('CP063 database failure revoking old code rolls back NEW code and its quota',async t=>{
 const x=await setup(t),old=x.issue(),before=count(x.ledger);
 x.ledger.db.exec("CREATE TRIGGER cp063_deny_revoke BEFORE UPDATE OF state ON challenges WHEN NEW.state='revoked' BEGIN SELECT RAISE(ABORT,'CP063_TEST_REVOKE_FAILURE'); END");
 const rate=x.ledger.db.prepare('SELECT attempts n FROM rate').get().n;
 const r=await x.request('/v1/link/start',old.browserSecret);
 assert.equal(r.status,503);assert.equal(count(x.ledger),before);assert.equal(x.ledger.challengeStatus(old.browserSecret).status,'pending');
 assert.equal(x.ledger.db.prepare('SELECT attempts n FROM rate').get().n,rate);
});
test('CP063 rollback of session revocation preserves old session and prevents new code',async t=>{
 const x=await setup(t),old=x.issue();approve(x.ledger,old);const session=x.ledger.redeem(old.browserSecret);
 x.ledger.db.exec("CREATE TRIGGER cp063_deny_sess BEFORE UPDATE OF revoked ON sessions BEGIN SELECT RAISE(ABORT,'CP063_TEST_SESSION_FAILURE'); END");
 const r=await x.request('/v1/link/start',old.browserSecret);
 assert.equal(r.status,503);assert.ok(x.ledger.inspectSession(session.sessionToken));assert.equal(count(x.ledger),0);
});
test('CP063 no old cookie keeps ordinary challenge issuance',async t=>{
 const x=await setup(t),r=await x.request('/v1/link/start');assert.equal(r.status,201);assert.equal(count(x.ledger),1);
 assert.match(r.data.code,/^[2-9A-HJ-NP-Z]{4}(?:-[2-9A-HJ-NP-Z]{4}){2}$/);
});
test('CP063 cross-origin POST rejected before issuing or modifying',async t=>{
 const x=await setup(t),old=x.issue(),before=count(x.ledger);
 assert.equal((await x.request('/v1/link/start',old.browserSecret,0,'https://evil.invalid')).status,403);
 assert.equal(count(x.ledger),before);assert.equal(x.ledger.challengeStatus(old.browserSecret).status,'pending');
});
test('CP063 reissuing two distinct old cookies preserves independent valid challenges',async t=>{
 const x=await setup(t),a=x.issue(),b=x.issue();
 const r=await Promise.all([x.request('/v1/link/start',a.browserSecret),x.request('/v1/link/start',b.browserSecret)]);
 assert.deepEqual(r.map(x=>x.status),[201,201]);assert.equal(count(x.ledger),2);
});
