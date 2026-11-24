/** CP059 opt-in adversarial HTTP+SQLite tests for a PR33-derived reissue patch.
 * Run ONLY after applying patches/cp059-reissue-fail-closed.patch.
 * The unpatched PR33 is expected to FAIL these tests: that RED is the finding.
 * Fully synthetic identities, no WA, real user, production DB or network.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {IdentityLedger} from '../../lab/cp014/identity.mjs';
import {createSessionHandler} from '../../lab/cp014/session-gateway.mjs';

const REF='a'.repeat(64),ACTOR='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RATE='f'.repeat(64),ORIGIN='https://portal.example.test';
const LINK='__Host-crownicles_link',SESSION='__Host-crownicles_session';
const now=()=>1_700_000_000_000;
async function setup(t){
 const ledger=new IdentityLedger({pepper:Buffer.alloc(32,71),clock:now});
 ledger.observeBinding({ref:REF,actor:ACTOR,epoch:1});
 const handler=createSessionHandler({ledger,authority:{readBinding:async()=>({actor:ACTOR,epoch:1})},repo:{},
  rateScopeFor:async()=>RATE,origin:ORIGIN,clock:now});
 const server=http.createServer(handler);
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));ledger.close();});
 const send=(path,{link,session,origin=ORIGIN}={})=>new Promise((resolve,reject)=>{
  const cookie=[link&&LINK+'='+link,session&&SESSION+'='+session].filter(Boolean).join('; ');
  const req=http.request({hostname:'127.0.0.1',port:server.address().port,path,method:'POST',
   headers:{Origin:origin,...(cookie?{Cookie:cookie}:{})}},res=>{
    let body='';res.on('data',part=>body+=part);
    res.on('end',()=>{try{resolve({status:res.statusCode,data:JSON.parse(body),headers:res.headers})}catch(e){reject(e)}})
   });
  req.on('error',reject);req.setTimeout(2500,()=>req.destroy(Error('HTTP_TIMEOUT')));req.end();
 });
 const issue=()=>ledger.issueChallenge(RATE);
 const approve=challenge=>{
  const ctx={channel:'private',verified:true,ref:REF,actor:ACTOR,epoch:1,confirmed:true};
  const a=ledger.prepareApproval(challenge.code,ctx);
  assert.equal(a.status,'confirm');assert.equal(ledger.confirmApproval(a.approvalNonce,ctx).status,'approved');
 };
 return {ledger,send,issue,approve};
}
const countLive=ledger=>ledger.db.prepare("SELECT COUNT(*) n FROM challenges WHERE state IN ('pending','awaiting','approved')").get().n;
const cookies=r=>r.headers['set-cookie']??[];

test('CP059 pending previous code is revoked only after successful replacement',async t=>{
 const x=await setup(t),old=x.issue(),r=await x.send('/v1/link/start',{link:old.browserSecret});
 assert.equal(r.status,201);assert.equal(r.data.status,'issued');
 assert.equal(x.ledger.challengeStatus(old.browserSecret).status,'unavailable');
 assert.ok(cookies(r).some(c=>c.startsWith(LINK+'=')));
});
test('CP059 approved previous code cannot redeem after replacement',async t=>{
 const x=await setup(t),old=x.issue();x.approve(old);
 assert.equal((await x.send('/v1/link/start',{link:old.browserSecret})).status,201);
 assert.equal(x.ledger.redeem(old.browserSecret).status,'unavailable');
});
test('CP059 consumed linked code cancels only its associated live session',async t=>{
 const x=await setup(t),old=x.issue();x.approve(old);
 const r=x.ledger.redeem(old.browserSecret);assert.equal(r.status,'redeemed');
 assert.ok(x.ledger.inspectSession(r.sessionToken));
 assert.equal((await x.send('/v1/link/start',{link:old.browserSecret})).status,201);
 assert.equal(x.ledger.inspectSession(r.sessionToken),null);
});
test('CP059 legacy consumed link without association cannot be acknowledged as replaced',async t=>{
 const x=await setup(t),old=x.issue();x.approve(old);
 const r=x.ledger.redeem(old.browserSecret);
 x.ledger.db.exec('DELETE FROM challenge_sessions');
 const before=countLive(x.ledger);
 assert.equal(x.ledger.cancelChallenge(old.browserSecret).status,'unavailable');
 const out=await x.send('/v1/link/start',{link:old.browserSecret});
 assert.equal(out.status,409);assert.deepEqual(out.data,{status:'unavailable'});
 assert.equal(countLive(x.ledger),before,'no active orphan challenge');
 assert.ok(x.ledger.inspectSession(r.sessionToken),'do not falsely claim old session revoked');
});
test('CP059 legacy failure cannot revoke an unrelated independent session',async t=>{
 const x=await setup(t),old=x.issue();x.approve(old);
 const a=x.ledger.redeem(old.browserSecret);
 x.ledger.db.exec('DELETE FROM challenge_sessions');
 const separate=x.issue();x.approve(separate);const b=x.ledger.redeem(separate.browserSecret);
 assert.equal((await x.send('/v1/link/start',{link:old.browserSecret})).status,409);
 assert.ok(x.ledger.inspectSession(a.sessionToken));
 assert.ok(x.ledger.inspectSession(b.sessionToken));
});
test('CP059 rate limiting does not revoke an old pending code',async t=>{
 const x=await setup(t),old=x.issue();
 for(let i=0;i<4;i++)assert.equal(x.issue().status,'issued');
 const r=await x.send('/v1/link/start',{link:old.browserSecret});
 assert.equal(r.status,429);assert.equal(x.ledger.challengeStatus(old.browserSecret).status,'pending');
});
test('CP059 cross-origin attempt does not issue a replacement',async t=>{
 const x=await setup(t),old=x.issue(),before=countLive(x.ledger);
 const r=await x.send('/v1/link/start',{link:old.browserSecret,origin:'https://evil.invalid'});
 assert.equal(r.status,403);assert.equal(countLive(x.ledger),before);
 assert.equal(x.ledger.challengeStatus(old.browserSecret).status,'pending');
});
test('CP059 unknown previous link is 409, clears only link cookie, does not expose code',async t=>{
 const x=await setup(t),old=x.issue();x.approve(old);
 const valid=x.ledger.redeem(old.browserSecret);
 const before=countLive(x.ledger);
 const r=await x.send('/v1/link/start',{link:randomBytes(32).toString('base64url'),session:valid.sessionToken});
 assert.equal(r.status,409);assert.equal(countLive(x.ledger),before);
 assert.ok(cookies(r).some(c=>c.startsWith(LINK+'=;')&&c.includes('Max-Age=0')));
 assert.equal(cookies(r).some(c=>c.startsWith(SESSION+'=')),false);
 assert.equal(Object.hasOwn(r.data,'code'),false);
 assert.ok(x.ledger.inspectSession(valid.sessionToken));
});
test('CP059 exception during old-link cancellation compensates new code then returns 503',async t=>{
 const x=await setup(t),old=x.issue(),original=x.ledger.cancelChallenge.bind(x.ledger);
 x.ledger.cancelChallenge=secret=>secret===old.browserSecret?(()=>{throw Error('FAULT')})():original(secret);
 const before=countLive(x.ledger),r=await x.send('/v1/link/start',{link:old.browserSecret});
 assert.equal(r.status,503);assert.equal(countLive(x.ledger),before);
 assert.equal(cookies(r).some(c=>c.startsWith(LINK+'=')),false);
});
test('CP059 unexpected cancel status cannot leave a newly active code',async t=>{
 const x=await setup(t),old=x.issue(),original=x.ledger.cancelChallenge.bind(x.ledger);
 x.ledger.cancelChallenge=secret=>secret===old.browserSecret?{status:'other'}:original(secret);
 const before=countLive(x.ledger),r=await x.send('/v1/link/start',{link:old.browserSecret});
 assert.equal(r.status,409);assert.equal(countLive(x.ledger),before);
});
test('CP059 failure to compensate must never emit success or a new cookie',async t=>{
 const x=await setup(t),old=x.issue();
 x.ledger.cancelChallenge=()=>({status:'unavailable'});
 const r=await x.send('/v1/link/start',{link:old.browserSecret});
 assert.equal(r.status,503);assert.equal(Object.hasOwn(r.data,'code'),false);
 assert.equal(cookies(r).some(c=>c.startsWith(LINK+'=')),false);
});
test('CP059 201 result exposes neither actor nor internal binding or session credentials',async t=>{
 const x=await setup(t),old=x.issue(),r=await x.send('/v1/link/start',{link:old.browserSecret});
 assert.equal(r.status,201);const body=JSON.stringify(r.data);
 assert.equal(body.includes(ACTOR),false);assert.equal(body.includes(REF),false);
 assert.ok(cookies(r).every(c=>c.includes('Secure')&&c.includes('HttpOnly')&&c.includes('SameSite=Strict')));
});
