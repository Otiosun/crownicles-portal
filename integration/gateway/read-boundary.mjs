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
const MAX_URL=512;
const MAX_HEADER=16*1024;
const MAX_RESPONSE=128*1024;
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
  if(typeof value!=='string'||value.length>MAX_HEADER||/[\x00-\x1F\x7F]/.test(value)) throw Error('BAD_CREDENTIAL');
  return value;
}
function parseReadRequest(request){
  if(!request || typeof request!=='object'||Array.isArray(request)) return {status:400};
  if(typeof request.url!=='string'||request.url.length===0||request.url.length>MAX_URL||
     !request.url.startsWith('/')||request.url.startsWith('//')||request.url.includes('#')||
     /[\x00-\x20\x7F]/.test(request.url)) return {status:400};
  let url;
  try {url=new URL(request.url,'https://portal.invalid');} catch {return {status:400};}
  if(url.pathname!==PATH) return {status:404};
  if(request.method!=='GET') return {status:405};
  if(request.body!==undefined&&request.body!==null) return {status:400};
  if([...url.searchParams.keys()].some(key=>key!=='sections'))return {status:400};
  const values=url.searchParams.getAll('sections');
  if(values.length!==1)return {status:400};
  const names=values[0].split(',');
  if(names.length<1||names.length>SECTIONS.length||names.some(n=>!SECTION_SET.has(n))||
     new Set(names).size!==names.length) return {status:400};
  let authorization,cookie;
  try {
    authorization=getCredential(request.headers,'authorization');
    cookie=getCredential(request.headers,'cookie');
  }catch{return {status:400};}
  return {sections:Object.freeze(names),credentials:Object.freeze({authorization,cookie})};
}

/**
 * resolveVerifiedSubject({authorization,cookie}) -> keycloak UUID or null;
 * must verify signature/issuer/audience/time/revocation, not parse unverified JWT.
 * readSnapshot({actor,sections,now}) -> PortalReadBundle, within a real READ ONLY
 * repeatable-read transaction and with DB ownership predicates. The caller,
 * not the browser, owns transaction and identity.
 */
export function createPortalReadBoundary({resolveVerifiedSubject,readSnapshot}={}){
  if(typeof resolveVerifiedSubject!=='function'||typeof readSnapshot!=='function'){
    throw TypeError('VERIFIED_SESSION_AND_SNAPSHOT_READER_REQUIRED');
  }
  return async function handlePortalRead(request){
    let parsed;
    try {parsed=parseReadRequest(request);}catch{return unavailable(400);}
    if(parsed.status) return parsed.status===405?
      response(405,{state:'unavailable'},{Allow:'GET'}):unavailable(parsed.status);
    if(!parsed.credentials.authorization&&!parsed.credentials.cookie)return unavailable(401);
    let actor;
    try {actor=await resolveVerifiedSubject(parsed.credentials);}catch{return unavailable(401);}
    if(typeof actor!=='string'||!UUID.test(actor))return unavailable(401);
    let raw;
    try {
      raw=await readSnapshot(Object.freeze({actor,sections:parsed.sections,now:new Date()}));
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
    return Object.freeze({status:200,headers:BASE_HEADERS,body});
  };
}

export const READ_BOUNDARY_POLICY=Object.freeze({path:PATH,sections:SECTIONS,maxUrlBytes:MAX_URL,maxResponseBytes:MAX_RESPONSE});
