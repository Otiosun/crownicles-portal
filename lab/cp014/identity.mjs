/** CP013 isolated identity ledger. NOT a production login server.
 * Public/browser handlers must never expose observeBinding/prepareApproval/confirmApproval.
 * Authority context must be created by an authenticated private-WA adapter, not incoming JSON.
 */
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomInt, createHmac } from 'node:crypto';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const REF=/^[a-f0-9]{64}$/;
const TOKEN=/^[A-Za-z0-9_-]{43}$/;
const ALPHABET='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CHALLENGE_MS=5*60_000, PREVIEW_MS=2*60_000, SESSION_MS=8*60*60_000, WINDOW_MS=10*60_000;
const token=()=>randomBytes(32).toString('base64url');
const code=()=>Array.from({length:12},()=>ALPHABET[randomInt(ALPHABET.length)]).join('');
const formatCode=s=>s.match(/.{4}/g).join('-');
const normalizeCode=s=>typeof s==='string'&&/^(?:[2-9A-HJ-NP-Z]{12}|[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4})$/i.test(s)?s.toUpperCase().replaceAll('-',''):null;
const invalid=()=>({status:'unavailable'});
const validEpoch=v=>Number.isSafeInteger(v)&&v>=1;
export class IdentityLedger {
 constructor({file=':memory:',pepper,clock=Date.now}){
  if(!Buffer.isBuffer(pepper)||pepper.length<32)throw Error('LEDGER_PEPPER_REQUIRED');
  this.secret=Buffer.from(pepper);this.clock=clock;this.db=new DatabaseSync(file);this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
  CREATE TABLE IF NOT EXISTS bindings(ref TEXT PRIMARY KEY, actor TEXT UNIQUE, epoch INTEGER NOT NULL CHECK(epoch>0));
  CREATE TABLE IF NOT EXISTS challenges(browser TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, state TEXT NOT NULL CHECK(state IN ('pending','awaiting','approved','consumed','revoked')), created INTEGER NOT NULL, expires INTEGER NOT NULL, ref TEXT, actor TEXT, epoch INTEGER, approval TEXT UNIQUE, approval_expires INTEGER);
  CREATE TABLE IF NOT EXISTS sessions(secret TEXT PRIMARY KEY, ref TEXT NOT NULL, actor TEXT NOT NULL, epoch INTEGER NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0,1)));
  CREATE INDEX IF NOT EXISTS challenges_ref ON challenges(ref,state);
  CREATE INDEX IF NOT EXISTS sessions_ref ON sessions(ref,revoked);
  CREATE TABLE IF NOT EXISTS rate(scope TEXT NOT NULL, operation TEXT NOT NULL, window INTEGER NOT NULL, attempts INTEGER NOT NULL, PRIMARY KEY(scope,operation,window));`);
 }
 close(){this.db.close();this.secret.fill(0)}
 now(){const n=this.clock();if(!Number.isSafeInteger(n)||n<0)throw Error('INVALID_CLOCK');return n}
 digest(domain,value){return createHmac('sha256',this.secret).update(domain+'\0'+value).digest('hex')}
 tx(fn){this.db.exec('BEGIN IMMEDIATE');try{let r=fn();this.db.exec('COMMIT');return r}catch(e){this.db.exec('ROLLBACK');throw e}}
 binding(ref){return this.db.prepare('SELECT ref,actor,epoch FROM bindings WHERE ref=?').get(ref)}
 invalidate(ref){this.db.prepare("UPDATE challenges SET state='revoked' WHERE ref=? AND state IN ('awaiting','approved')").run(ref);this.db.prepare('UPDATE sessions SET revoked=1 WHERE ref=? AND revoked=0').run(ref)}
 current(ref,actor,epoch){const b=this.binding(ref);return !!b&&b.actor===actor&&b.epoch===epoch&&actor!==null}
 // TRUSTED authority feed only. Epoch must be persisted by actual WA adapter, not inferred by browser.
 observeBinding({ref,actor,epoch}){
  if(!REF.test(ref??'')||!(actor===null||UUID.test(actor??''))||!validEpoch(epoch))throw Error('INVALID_AUTHORITY_BINDING');
  return this.tx(()=>{let b=this.binding(ref);if(b&&epoch<b.epoch)return {status:'stale'};
   if(b&&epoch===b.epoch){if(b.actor===actor)return {status:'unchanged'};this.db.prepare('UPDATE bindings SET actor=NULL WHERE ref=?').run(ref);this.invalidate(ref);return {status:'conflict_quarantined'};}
   const collision=actor===null?null:this.db.prepare('SELECT ref FROM bindings WHERE actor=? AND ref<>?').get(actor,ref);
   if(collision){this.db.prepare('UPDATE bindings SET actor=NULL WHERE ref=?').run(collision.ref);this.invalidate(collision.ref);this.db.prepare('INSERT INTO bindings(ref,actor,epoch) VALUES(?,NULL,?) ON CONFLICT(ref) DO UPDATE SET actor=NULL,epoch=excluded.epoch').run(ref,epoch);this.invalidate(ref);return {status:'conflict_quarantined'};}
   this.db.prepare('INSERT INTO bindings(ref,actor,epoch) VALUES(?,?,?) ON CONFLICT(ref) DO UPDATE SET actor=excluded.actor,epoch=excluded.epoch').run(ref,actor,epoch);
   this.invalidate(ref);return {status:'updated'};});
 }
 // Scope is opaque/HMACed by trusted ingress. Never take arbitrary client-supplied IP scope.
 limit(scope,operation,now,max){let w=Math.floor(now/WINDOW_MS);let key=this.digest('rate',scope);this.db.prepare('INSERT INTO rate(scope,operation,window,attempts) VALUES(?,?,?,1) ON CONFLICT(scope,operation,window) DO UPDATE SET attempts=attempts+1').run(key,operation,w);return this.db.prepare('SELECT attempts FROM rate WHERE scope=? AND operation=? AND window=?').get(key,operation,w).attempts<=max}
 issueChallenge(rateScope){
  if(!REF.test(rateScope??''))throw Error('TRUSTED_RATE_SCOPE_REQUIRED');
  return this.tx(()=>{let now=this.now();if(!this.limit(rateScope,'issue',now,5))return {status:'rate_limited'};
   // Random collision is astronomically unlikely; still retry only collision-specific conflicts.
   for(let i=0;i<4;i++){let raw=code(),browserSecret=token();let inserted=this.db.prepare("INSERT OR IGNORE INTO challenges(browser,code,state,created,expires) VALUES(?,?,'pending',?,?)").run(this.digest('browser',browserSecret),this.digest('code',raw),now,now+CHALLENGE_MS);if(inserted.changes===1)return {status:'issued',code:formatCode(raw),browserSecret,expiresAt:now+CHALLENGE_MS};}
   throw Error('CHALLENGE_COLLISION_LIMIT');});
 }
 privateContext(ctx){return !!ctx&&ctx.channel==='private'&&ctx.verified===true&&REF.test(ctx.ref??'')&&UUID.test(ctx.actor??'')&&validEpoch(ctx.epoch)&&this.current(ctx.ref,ctx.actor,ctx.epoch)}
 // This returns a preview nonce to the bot only. The bot must show anti-relay warning + explicit confirmation.
 prepareApproval(rawCode,ctx){return this.tx(()=>{let now=this.now();if(!this.privateContext(ctx))return invalid();if(!this.limit(ctx.ref,'preview',now,8))return {status:'rate_limited'};let raw=normalizeCode(rawCode);if(!raw)return invalid();
  let row=this.db.prepare('SELECT * FROM challenges WHERE code=?').get(this.digest('code',raw));if(!row||row.state!=='pending'||row.expires<=now)return invalid();let nonce=token(),expires=Math.min(row.expires,now+PREVIEW_MS);
  let r=this.db.prepare("UPDATE challenges SET state='awaiting',ref=?,actor=?,epoch=?,approval=?,approval_expires=? WHERE browser=? AND state='pending' AND expires>?").run(ctx.ref,ctx.actor,ctx.epoch,this.digest('approval',nonce),expires,row.browser,now);
  return r.changes===1?{status:'confirm',approvalNonce:nonce,expiresAt:expires}:invalid();});}
 confirmApproval(approvalNonce,ctx){return this.tx(()=>{let now=this.now();if(!this.privateContext(ctx)||ctx.confirmed!==true)return invalid();if(!this.limit(ctx.ref,'confirm',now,8))return {status:'rate_limited'};if(!TOKEN.test(approvalNonce??''))return invalid();
  let r=this.db.prepare("UPDATE challenges SET state='approved' WHERE approval=? AND state='awaiting' AND ref=? AND actor=? AND epoch=? AND expires>? AND approval_expires>?").run(this.digest('approval',approvalNonce),ctx.ref,ctx.actor,ctx.epoch,now,now);return r.changes===1?{status:'approved'}:invalid();});}
 challengeStatus(browserSecret){if(!TOKEN.test(browserSecret??''))return invalid();let n=this.now(),r=this.db.prepare('SELECT state,expires,ref,actor,epoch,approval_expires FROM challenges WHERE browser=?').get(this.digest('browser',browserSecret));if(!r||r.expires<=n||!['pending','awaiting','approved'].includes(r.state))return invalid();if(r.state!=='pending'&&!this.current(r.ref,r.actor,r.epoch))return invalid();if(r.state==='awaiting'&&r.approval_expires<=n)return invalid();return {status:r.state==='awaiting'?'awaiting_confirmation':r.state,expiresAt:r.expires}}
 cancelChallenge(browserSecret){if(!TOKEN.test(browserSecret??''))return invalid();return this.tx(()=>{let r=this.db.prepare("UPDATE challenges SET state='revoked' WHERE browser=? AND state IN ('pending','awaiting','approved')").run(this.digest('browser',browserSecret));return r.changes===1?{status:'cancelled'}:invalid();});}
 redeem(browserSecret){if(!TOKEN.test(browserSecret??''))return invalid();return this.tx(()=>{let now=this.now(),digest=this.digest('browser',browserSecret);let r=this.db.prepare("SELECT * FROM challenges WHERE browser=? AND state='approved' AND expires>?").get(digest,now);if(!r||!this.current(r.ref,r.actor,r.epoch))return invalid();
   let changed=this.db.prepare("UPDATE challenges SET state='consumed',approval=NULL WHERE browser=? AND state='approved' AND expires>?").run(digest,now);if(changed.changes!==1)return invalid();let session=token(),expires=now+SESSION_MS;this.db.prepare('INSERT INTO sessions(secret,ref,actor,epoch,created,expires) VALUES(?,?,?,?,?,?)').run(this.digest('session',session),r.ref,r.actor,r.epoch,now,expires);return {status:'redeemed',sessionToken:session,expiresAt:expires};});}
 // Internal verifier only; result must not be sent to browser.
 inspectSession(sessionToken){if(!TOKEN.test(sessionToken??''))return null;let r=this.db.prepare('SELECT s.ref,s.actor,s.epoch,s.expires FROM sessions s JOIN bindings b ON b.ref=s.ref AND b.actor=s.actor AND b.epoch=s.epoch WHERE s.secret=? AND s.revoked=0 AND s.expires>?').get(this.digest('session',sessionToken),this.now());return r?{bindingRef:r.ref,actorId:r.actor,expiresAt:r.expires,bindingEpoch:r.epoch}:null}
 verifySession(sessionToken){let r=this.inspectSession(sessionToken);if(!r)return null;let {bindingRef,...out}=r;return out}
 inspectApprovedChallenge(browserSecret){if(!TOKEN.test(browserSecret??''))return null;let r=this.db.prepare("SELECT c.ref,c.actor,c.epoch FROM challenges c JOIN bindings b ON b.ref=c.ref AND b.actor=c.actor AND b.epoch=c.epoch WHERE c.browser=? AND c.state='approved' AND c.expires>?").get(this.digest('browser',browserSecret),this.now());return r?{bindingRef:r.ref,actorId:r.actor,bindingEpoch:r.epoch}:null}
 revokeSession(sessionToken){if(!TOKEN.test(sessionToken??''))return false;return this.db.prepare('UPDATE sessions SET revoked=1 WHERE secret=? AND revoked=0').run(this.digest('session',sessionToken)).changes===1}
 prune(){return this.tx(()=>{let now=this.now(),c=this.db.prepare('DELETE FROM challenges WHERE expires<=?').run(now).changes,s=this.db.prepare('DELETE FROM sessions WHERE expires<=?').run(now).changes,r=this.db.prepare('DELETE FROM rate WHERE window<?').run(Math.floor(now/WINDOW_MS)-1).changes;return {challenges:c,sessions:s,rate:r}})}
}
export const limits=Object.freeze({CHALLENGE_MS,PREVIEW_MS,SESSION_MS,WINDOW_MS});
