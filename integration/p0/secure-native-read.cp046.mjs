/**
 * CP046: lab-only HTTP read route composer for Crownicles P0. No live endpoint.
 * - strict __Host cookie session only, no requested player ID / public target
 * - caller must supply an independently revocable, server-verifying resolver
 * - caller must supply owner-scoped, read-only native queries (not raw DB access)
 * - before/after verification + epoch/ref equality before publishing any payload
 * - one strict CP045 projection and UX guard before producing a JSON reply
 * Non-goals: implements neither OIDC, database, TLS termination nor login.
 */
import http from 'node:http';
import {normalizeNativeP0Read} from './native-projection.mjs';
import {isProjectedP0} from './projection-guard.mjs';

export const CP046_PATHS=Object.freeze({
  '/v1/me/profile':'profile',
  '/v1/me/inventory':'inventory'
});
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const NIL_UUID='00000000-0000-0000-0000-000000000000';
const BINDING_REF=/^[0-9a-f]{64}$/i;
const TOKEN=/^[A-Za-z0-9_-]{43}$/;
const COOKIE_NAME=/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
export const CP046_COOKIE='__Host-crownicles_session';
const MAX_URL=256,MAX_HEADERS=16*1024,MAX_REPLY=128*1024;
const HEADERS=Object.freeze({
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'private, no-store',
  'Pragma':'no-cache',
  'Vary':'Cookie',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer',
  'Cross-Origin-Resource-Policy':'same-origin'
});
const result=(status,body,extra={})=>Object.freeze({status,body,headers:Object.freeze({...HEADERS,...extra})});
const unavailable=status=>result(status,{state:'unavailable'});
const safeNow=clock=>{const t=clock();if(!Number.isSafeInteger(t)||t<0)throw Error('BAD_CLOCK');return t};
function verifiedSubject(s,now){
  try{
    if(!s||typeof s!=='object'||Array.isArray(s))return null;
    const actorId=s.actorId,bindingRef=s.bindingRef,bindingEpoch=s.bindingEpoch,expiresAt=s.expiresAt;
    if(typeof actorId!=='string'||!UUID.test(actorId)||actorId.toLowerCase()===NIL_UUID||
      typeof bindingRef!=='string'||!BINDING_REF.test(bindingRef)||
      !Number.isSafeInteger(bindingEpoch)||bindingEpoch<1||
      !Number.isSafeInteger(expiresAt)||expiresAt<=now)return null;
    return Object.freeze({actorId:actorId.toLowerCase(),bindingRef:bindingRef.toLowerCase(),bindingEpoch,expiresAt});
  }catch{return null;}
}
const same=(a,b)=>!!a&&!!b&&a.actorId===b.actorId&&a.bindingRef===b.bindingRef&&a.bindingEpoch===b.bindingEpoch&&a.expiresAt===b.expiresAt;
function checkRawHeaders(raw){
  if(!Array.isArray(raw)||raw.length%2!==0||raw.length>400)return false;
  const seen=new Set();let bytes=0;
  for(let i=0;i<raw.length;i+=2){
    const name=raw[i],value=raw[i+1];
    if(typeof name!=='string'||typeof value!=='string')return false;
    bytes+=Buffer.byteLength(name)+Buffer.byteLength(value);
    if(bytes>MAX_HEADERS||!COOKIE_NAME.test(name))return false;
    const lower=name.toLowerCase();
    if(['cookie','authorization','proxy-authorization','content-length','transfer-encoding','host'].includes(lower)){
      if(seen.has(lower))return false;
      seen.add(lower);
    }
  }
  return true;
}
function strictCookies(value){
  if(value===undefined)return {token:null};
  if(typeof value!=='string'||Buffer.byteLength(value)>MAX_HEADERS||/[\x00-\x1f\x7f,]/.test(value))return null;
  const found=new Set();let selected=null;
  for(const part of value.split(';')){
    const ix=part.indexOf('=');
    if(ix<=0)return null;
    const name=part.slice(0,ix).trim(),val=part.slice(ix+1).trim();
    if(!COOKIE_NAME.test(name)||found.has(name))return null;
    found.add(name);
    if(name===CP046_COOKIE)selected=val;
  }
  if(selected!==null&&!TOKEN.test(selected))return null;
  return {token:selected};
}
function parse(req){
  if(!req||typeof req!=='object'||Array.isArray(req)||typeof req.url!=='string'||
    Buffer.byteLength(req.url)>MAX_URL||!Object.hasOwn(CP046_PATHS,req.url)){
    return {status:404};
  }
  if(req.method!=='GET')return {status:405};
  if(req.signal!==undefined&&!(req.signal instanceof AbortSignal))return {status:400};
  if(req.body!==undefined&&req.body!==null)return {status:400};
  if(!checkRawHeaders(req.rawHeaders))return {status:400};
  const headers=req.headers;
  if(!headers||typeof headers!=='object'||Array.isArray(headers))return {status:400};
  for(let i=0;i<req.rawHeaders.length;i+=2){
    const name=req.rawHeaders[i].toLowerCase(),value=req.rawHeaders[i+1];
    if(name==='authorization'||name==='proxy-authorization'||name==='transfer-encoding')return {status:400};
    if(['cookie','content-length'].includes(name)&&headers[name]!==value)return {status:400};
  }
  if(own(headers,'authorization')||own(headers,'proxy-authorization')||own(headers,'transfer-encoding')||
      (own(headers,'content-length')&&!/^0+$/.test(headers['content-length'])))return {status:400};
  if(headers.origin!==undefined&&headers.origin!==null)return {status:403};
  if(typeof headers['sec-fetch-site']==='string'&&!['same-origin','none'].includes(headers['sec-fetch-site']))return {status:403};
  const cookies=strictCookies(headers.cookie);
  if(!cookies)return {status:400};
  return {section:CP046_PATHS[req.url],token:cookies.token};
}
function deadline(fn,ms,parentSignal){
  const local=new AbortController();let t,listener;
  const limit=new Promise((_,reject)=>{t=setTimeout(()=>{local.abort();reject(Error('DEADLINE'))},ms)});
  const parent=new Promise((_,reject)=>{
    if(!parentSignal)return;
    listener=()=>{local.abort();reject(Error('ABORTED'))};
    if(parentSignal.aborted)listener();else parentSignal.addEventListener('abort',listener,{once:true});
  });
  return Promise.race([Promise.resolve().then(()=>fn(local.signal)),limit,parent]).finally(()=>{
    clearTimeout(t);if(listener)parentSignal.removeEventListener('abort',listener);
  });
}
const millis=(n,label)=>{if(!Number.isSafeInteger(n)||n<1||n>30_000)throw RangeError('INVALID_'+label+'_DEADLINE')};

/**
 * resolveFreshSession({token,signal,phase}) MUST verify a server-side session
 * against live authority/revocation state on BOTH phases. No memoized JWT.
 * readNativeOwn({actorId,section,signal}) MUST query the owner's native record
 * in a read-only REPEATABLE READ transaction. It returns a source-tagged
 * {actorId,state,packet} and never accepts a target id from the request.
 */
export function createP0NativeReadGateway({resolveFreshSession,readNativeOwn,clock=Date.now,
  authTimeoutMs=2500,readTimeoutMs=5000}={}){
  if(typeof resolveFreshSession!=='function'||typeof readNativeOwn!=='function')throw TypeError('AUTHENTICATED_READ_CALLBACKS_REQUIRED');
  millis(authTimeoutMs,'AUTH');millis(readTimeoutMs,'READ');
  return async request=>{
    let parsed;
    try{parsed=parse(request)}catch{return unavailable(400)}
    if(parsed.status)return parsed.status===405?result(405,{state:'unavailable'},{Allow:'GET'}):unavailable(parsed.status);
    if(!parsed.token)return unavailable(401);
    if(request.signal?.aborted)return unavailable(503);
    let proof;
    try{const s=await deadline(signal=>resolveFreshSession({token:parsed.token,signal,phase:'before-read'}),authTimeoutMs,request.signal);
      proof=verifiedSubject(s,safeNow(clock));}
    catch{return unavailable(request.signal?.aborted?503:401)}
    if(!proof)return unavailable(401);
    let native;
    try{native=await deadline(signal=>readNativeOwn(Object.freeze({actorId:proof.actorId,section:parsed.section,signal})),readTimeoutMs,request.signal)}
    catch{return unavailable(503)}
    if(!native||typeof native!=='object'||Array.isArray(native)||native.actorId!==proof.actorId)return unavailable(503);
    const projected=normalizeNativeP0Read(parsed.section,native);
    if(native.state==='ready'&&projected.state!=='ready')return unavailable(503);
    if(projected.state==='ready'&&!isProjectedP0(parsed.section,projected.data))return unavailable(503);
    let body;
    try{body={state:projected.state,asOf:new Date(safeNow(clock)).toISOString()};
      if(projected.state==='ready')body.data=projected.data;
      if(Buffer.byteLength(JSON.stringify(body))>MAX_REPLY)return unavailable(503);
    }catch{return unavailable(503)}
    // The final session check must be independently backed by live authority.
    // No response containing data may leave this function before it succeeds.
    let fresh;
    try{const s=await deadline(signal=>resolveFreshSession({token:parsed.token,signal,phase:'after-read'}),authTimeoutMs,request.signal);
      fresh=verifiedSubject(s,safeNow(clock))}
    catch{return unavailable(request.signal?.aborted?503:401)}
    if(!same(proof,fresh))return unavailable(401);
    if(request.signal?.aborted)return unavailable(503);
    return result(200,body);
  };
}

/** Mountable lab-only handler; the caller must supply its own TLS and routing. */
export function createP0NativeHttpHandler(options){
  const read=createP0NativeReadGateway(options);
  return async(req,res)=>{
    const controller=new AbortController();
    const onAbort=()=>controller.abort();
    req.once('aborted',onAbort);
    res.once('close',()=>{if(!res.writableEnded)controller.abort()});
    let response;
    try{response=await read({url:req.url,method:req.method,headers:req.headers,rawHeaders:req.rawHeaders,
      signal:controller.signal});}catch{response=unavailable(503)}
    if(!res.destroyed&&!res.writableEnded){res.writeHead(response.status,response.headers);res.end(JSON.stringify(response.body))}
  };
}
/**
 * HTTP plaintext is allowed ONLY on an explicit loopback address in tests.
 * Node's default listen(port) binds a wildcard and can expose session cookies
 * to the local network. Reject implicit host, sockets, pipes, file descriptors,
 * DNS names and public interfaces synchronously, before creating a listener.
 * A production deployment must NOT use this laboratory server factory.
 */
export function createP0NativeLabServer(options){
  const server=http.createServer(createP0NativeHttpHandler(options));
  const listen=server.listen.bind(server);
  server.listen=(...args)=>{
    const first=args[0];
    let host;
    if(first&&typeof first==='object'&&!Array.isArray(first)){
      if(Object.hasOwn(first,'path')||Object.hasOwn(first,'fd'))throw Error('CP046_LAB_LOOPBACK_ONLY');
      host=first.host;
    }else if(typeof first==='number'&&Number.isSafeInteger(first)&&first>=0){
      host=typeof args[1]==='string'?args[1]:undefined;
    }
    if(host!=='127.0.0.1'&&host!=='::1')throw Error('CP046_LAB_LOOPBACK_ONLY');
    return listen(...args);
  };
  return server;
}

/** Narrow adaptation of the original CP014 authority contract (lab only). */
export function createCP014Resolver({ledger,authority}){
  if(typeof ledger?.inspectSession!=='function'||typeof authority?.readBinding!=='function')throw TypeError('CP014_AUTHORITY_REQUIRED');
  return async({token,signal})=>{
    if(signal.aborted)return null;
    const first=ledger.inspectSession(token);
    if(!first)return null;
    const current=await authority.readBinding(first.bindingRef);
    if(signal.aborted||current?.actor!==first.actorId||current?.epoch!==first.bindingEpoch)return null;
    const second=ledger.inspectSession(token);
    if(!second||second.actorId!==first.actorId||second.bindingRef!==first.bindingRef||
      second.bindingEpoch!==first.bindingEpoch||second.expiresAt!==first.expiresAt)return null;
    return second;
  };
}
