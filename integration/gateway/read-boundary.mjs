/**
 * CP040 / laboratory-only read boundary.
 * Framework-neutral HTTP response builder; no server, DB, token verifier or
 * endpoint is started here. The integrator must supply a cryptographically
 * verified, revocable server-side session resolver and a SELECT-only,
 * owner-scoped, snapshot-consistent reader. DO NOT use this as a live route.
 */
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {normalizeBundle}=require('../../web/contract-adapter.js');

const PATH='/api/portal/v1/read';
const SECTIONS=Object.freeze(['property','chest','garden','pet','pantry']);
const SECTION_SET=new Set(SECTIONS);
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const NIL_UUID='00000000-0000-0000-0000-000000000000';
/* Subject proofs are server-only outputs of a cryptographic verifier.
 * The optional bound form lets the gateway compare binding epochs, not just
 * actor UUIDs, when a session is revoked/rebound during a slow SQL read.
 * Both before and after checks must consult live revocation/binding state. */
function verifiedProof(value){
  try {
    const actor=typeof value==='string'?value:value?.actor;
    if(typeof actor!=='string'||!UUID.test(actor)||actor.toLowerCase()===NIL_UUID)return null;
    if(typeof value==='string')return Object.freeze({kind:'legacy',actor:actor.toLowerCase()});
    if(!value||typeof value!=='object'||Array.isArray(value))return null;
    // Read accessors once; a broken connector must fail closed on any getter error.
    const bindingRef=value.bindingRef, bindingEpoch=value.bindingEpoch;
    if(typeof bindingRef!=='string'||!bindingRef||bindingRef.length>256||
       /[\x00-\x20\x7f]/.test(bindingRef)||
       !Number.isSafeInteger(bindingEpoch)||bindingEpoch<0)return null;
    return Object.freeze({kind:'bound',actor:actor.toLowerCase(),
      bindingRef,bindingEpoch});
  }catch{return null;}
}
function sameSession(before,after){
  return !!before&&!!after&&before.kind===after.kind&&before.actor===after.actor&&
    (before.kind==='legacy'||(before.bindingRef===after.bindingRef&&before.bindingEpoch===after.bindingEpoch));
}

const COOKIE_NAME=/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const MAX_URL=512;
const MAX_HEADER=16*1024;
const MAX_RESPONSE=128*1024;
const DEFAULT_AUTH_TIMEOUT_MS=2500;
const DEFAULT_READ_TIMEOUT_MS=5000;
const MAX_GATE_TIMEOUT_MS=30000;

function validateTimeout(value,name){
  if(!Number.isSafeInteger(value)||value<1||value>MAX_GATE_TIMEOUT_MS){
    throw new RangeError('INVALID_'+name+'_TIMEOUT');
  }
}
/**
 * A reply deadline, not hard cancellation of DB work. On timeout, AbortSignal
 * is triggered; adapters MUST honor it and explicitly cancel/rollback SQL.
 * A stuck adapter ignoring the signal may keep working after the reply.
 */
async function withDeadline(operation,timeoutMs,parentSignal){
  const controller=new AbortController();
  let timer, onParentAbort;
  const deadline=new Promise((_,reject)=>{
    timer=setTimeout(()=>{
      controller.abort();
      reject(new Error('PORTAL_DEADLINE_EXCEEDED'));
    },timeoutMs);
  });
  const disconnected=new Promise((_,reject)=>{
    if(!parentSignal)return;
    onParentAbort=()=>{
      controller.abort();
      reject(new Error('PORTAL_CLIENT_DISCONNECTED'));
    };
    if(parentSignal.aborted)onParentAbort();
    else parentSignal.addEventListener('abort',onParentAbort,{once:true});
  });
  try {
    if(parentSignal?.aborted)throw Error('PORTAL_CLIENT_DISCONNECTED');
    return await Promise.race([Promise.resolve().then(()=>operation(controller.signal)),deadline,disconnected]);
  } finally {
    clearTimeout(timer);
    if(parentSignal&&onParentAbort)parentSignal.removeEventListener('abort',onParentAbort);
  }
}
const BASE_HEADERS=Object.freeze({
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'private, no-store',
  'Pragma':'no-cache',
  'Vary':'Cookie, Authorization',
  'X-Content-Type-Options':'nosniff',
  'Cross-Origin-Resource-Policy':'same-origin'
});

function response(status,payload,extra={}) {
  return Object.freeze({status,headers:Object.freeze({...BASE_HEADERS,...extra}),body:JSON.stringify(payload)});
}
const unavailable=(status)=>response(status,{state:'unavailable'});
function getCredential(headers,name){
  let value;
  if(headers && typeof headers.get==='function') value=headers.get(name);
  else if(headers && typeof headers==='object' && !Array.isArray(headers)){
    const keys=Object.keys(headers).filter(k=>k.toLowerCase()===name);
    if(keys.length>1) throw Error('AMBIGUOUS_CREDENTIAL');
    value=keys.length?headers[keys[0]]:undefined;
  }
  if(value===undefined||value===null||value==='') return null;
  if(typeof value!=='string'||Buffer.byteLength(value,'utf8')>MAX_HEADER||/[\x00-\x1F\x7F]/.test(value)||!value.trim()) throw Error('BAD_CREDENTIAL');
  if(name==='authorization' && !/^Bearer [A-Za-z0-9._~+/-]+=*$/i.test(value)) throw Error('INVALID_BEARER_FORMAT');
  return value;
}
function parseReadRequest(request){
  if(!request || typeof request!=='object'||Array.isArray(request)) return {status:400};
  if(request.signal!==undefined&&!(request.signal instanceof AbortSignal))return {status:400};
  // Node IncomingMessage may silently discard repeated Authorization headers.
  // rawHeaders retains them; prevent credential selection by parser behavior.
  if(request.rawHeaders!==undefined){
    const raw=request.rawHeaders;
    if(!Array.isArray(raw)||raw.length%2!==0||raw.length>400)return {status:400};
    const critical=new Set(['authorization','cookie','content-length','transfer-encoding']);
    const seen=new Set();
    let totalBytes=0;
    for(let i=0;i<raw.length;i+=2){
      if(typeof raw[i]!=='string'||typeof raw[i+1]!=='string')return {status:400};
      totalBytes+=Buffer.byteLength(raw[i],'utf8')+Buffer.byteLength(raw[i+1],'utf8');
      if(totalBytes>MAX_HEADER)return {status:400};
      const name=raw[i].toLowerCase();
      if(critical.has(name)&&seen.has(name))return {status:400};
      seen.add(name);
    }
  }
  if(typeof request.url!=='string'||request.url.length===0||Buffer.byteLength(request.url,'utf8')>MAX_URL||
     !request.url.startsWith('/')||request.url.startsWith('//')||request.url.includes('#')||
     /[\x00-\x20\x7F]/.test(request.url)) return {status:400};
  let url;
  try {url=new URL(request.url,'https://portal.invalid');} catch {return {status:400};}
  // URL() normalizes dot-segments: reject altered raw paths before routing.
  if(request.url.split('?')[0]!==PATH || url.pathname!==PATH) return {status:404};
  if(request.method!=='GET') return {status:405};
  if(request.body!==undefined&&request.body!==null) return {status:400};
  // An undeclared GET body may be smuggled upstream; reject advertised payloads.
  // The real HTTP adapter must also enforce transfer framing and body limits.
  let contentLength,transferEncoding;
  try {
    contentLength=getCredential(request.headers,'content-length');
    transferEncoding=getCredential(request.headers,'transfer-encoding');
  } catch {return {status:400};}
  if(transferEncoding!==null || (contentLength!==null && !/^0+$/.test(contentLength)))return {status:400};
  if([...url.searchParams.keys()].some(key=>key!=='sections'))return {status:400};
  const values=url.searchParams.getAll('sections');
  if(values.length!==1)return {status:400};
  const names=values[0].split(',');
  if(names.length<1||names.length>SECTIONS.length||names.some(n=>!SECTION_SET.has(n))||
     new Set(names).size!==names.length) return {status:400};
  // Parsers and caches can disagree on escaped parameter names, trailing '&'
  // or mixed separators. Accept just the plain form and URLSearchParams form.
  const rawQuery=request.url.slice(PATH.length+1);
  if(rawQuery!=='sections='+names.join(',')&&
     rawQuery!=='sections='+names.join('%2C'))return {status:400};
  let authorization,cookie;
  try {
    authorization=getCredential(request.headers,'authorization');
    cookie=getCredential(request.headers,'cookie');
  }catch{return {status:400};}
  if(cookie){
    // Duplicate request-cookie names (possibly from multiple Cookie headers)
    // must not let different session parsers select different principals.
    if(cookie.includes(',')) return {status:400};
    const namesSeen=new Set();
    for(const part of cookie.split(';')){
      const equal=part.indexOf('=');
      // A Cookie header contains cookie-pairs, never a bare opaque token.
      // The session resolver still verifies cryptographic authenticity.
      if(equal<=0)return {status:400};
      const rawName=part.slice(0,equal);
      const name=rawName.trimStart(); // SP after ';' is allowed.
      if(!COOKIE_NAME.test(name)||namesSeen.has(name))return {status:400};
      namesSeen.add(name);
    }
  }
  if(authorization&&cookie) return {status:400}; // no ambiguous dual principal
  return {sections:Object.freeze(names),credentials:Object.freeze({authorization,cookie})};
}

/**
 * resolveVerifiedSubject({authorization,cookie},{signal,phase}) -> keycloak UUID
 * or {actor,bindingRef,bindingEpoch}; called BEFORE and AFTER reads;
 * must verify signature/issuer/audience/time/revocation and binding epoch from
 * authoritative state in BOTH passes, not parse or cache unverified JWTs.
 * Default requires {actor,bindingRef,bindingEpoch}; unbound UUID strings are
 * accepted ONLY when allowUnboundMockSubjects=true for legacy fixtures.
 * readSnapshot({actor,sections,now}) -> PortalReadBundle, within a real READ ONLY
 * repeatable-read transaction and with DB ownership predicates. The caller,
 * not the browser, owns transaction and identity.
 */
export function createPortalReadBoundary({
  resolveVerifiedSubject,readSnapshot,
  authTimeoutMs=DEFAULT_AUTH_TIMEOUT_MS,
  readTimeoutMs=DEFAULT_READ_TIMEOUT_MS,
  allowUnboundMockSubjects=false
}={}){
  if(typeof resolveVerifiedSubject!=='function'||typeof readSnapshot!=='function'){
    throw TypeError('VERIFIED_SESSION_AND_SNAPSHOT_READER_REQUIRED');
  }
  validateTimeout(authTimeoutMs,'AUTH');
  validateTimeout(readTimeoutMs,'READ');
  if(typeof allowUnboundMockSubjects!=='boolean')throw TypeError('MOCK_SUBJECT_POLICY_INVALID');
  return async function handlePortalRead(request){
    let parsed;
    try {parsed=parseReadRequest(request);}catch{return unavailable(400);}
    if(parsed.status) return parsed.status===405?
      response(405,{state:'unavailable'},{Allow:'GET'}):unavailable(parsed.status);
    if(!parsed.credentials.authorization&&!parsed.credentials.cookie)return unavailable(401);
    // Request.signal comes from a trusted HTTP adapter; client-provided headers
    // never control it. A disconnected client must not start an expensive read.
    if(request.signal?.aborted)return unavailable(503);
    let actor;
    try {
      actor=await withDeadline(signal=>resolveVerifiedSubject(parsed.credentials,Object.freeze({signal,phase:'before-read'})),authTimeoutMs,request.signal);
    }catch{return unavailable(request.signal?.aborted?503:401);}
    const proof=verifiedProof(actor);
    if(!proof||(!allowUnboundMockSubjects&&proof.kind!=='bound'))return unavailable(401);
    let raw;
    try {
      raw=await withDeadline(signal=>readSnapshot(Object.freeze({actor:proof.actor,sections:parsed.sections,now:new Date(),signal})),readTimeoutMs,request.signal);
    }catch{return unavailable(503);}
    let projected;
    try {projected=normalizeBundle(raw);}catch{return unavailable(503);}
    if(!projected || projected.state!=='ready'||projected.version!==1||
       !projected.sections||typeof projected.sections!=='object')return unavailable(503);
    const names=Object.keys(projected.sections);
    if(names.length!==parsed.sections.length || names.some(name=>!parsed.sections.includes(name)))return unavailable(503);
    let body;
    try {body=JSON.stringify(projected);}catch{return unavailable(503);}
    if(!body || Buffer.byteLength(body,'utf8')>MAX_RESPONSE)return unavailable(503);
    // Revalidate *after* the DB read and projection. A logout, revocation,
    // actor switch, or binding epoch change must not publish stale private data.
    // This resolver must NOT cache the earlier verification across stages.
    let fresh;
    try {
      fresh=await withDeadline(signal=>resolveVerifiedSubject(parsed.credentials,
        Object.freeze({signal,phase:'after-read'})),authTimeoutMs,request.signal);
    }catch{return unavailable(request.signal?.aborted?503:401);}
    const freshProof=verifiedProof(fresh);
    if(!sameSession(proof,freshProof))return unavailable(401);
    if(request.signal?.aborted)return unavailable(503);
    return Object.freeze({status:200,headers:BASE_HEADERS,body});
  };
}

export const READ_BOUNDARY_POLICY=Object.freeze({path:PATH,sections:SECTIONS,maxUrlBytes:MAX_URL,maxResponseBytes:MAX_RESPONSE,defaultAuthTimeoutMs:DEFAULT_AUTH_TIMEOUT_MS,defaultReadTimeoutMs:DEFAULT_READ_TIMEOUT_MS,maxTimeoutMs:MAX_GATE_TIMEOUT_MS});
