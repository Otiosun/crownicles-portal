/** CP013 loopback HTTP lab. No real WA, OIDC, TLS or Core. Authority and repository injected.
 * All browser-visible state is minimized; the trusted private-DM adapter is separate.
 */
import http from 'node:http';
import {readOwn} from './projection.mjs';
const LINK='__Host-crownicles_link',SESSION='__Host-crownicles_session';
const cookie=(name,value,age)=>`${name}=${value}; Path=/; Max-Age=${Math.max(0,Math.floor(age))}; Secure; HttpOnly; SameSite=Strict`;
const authError={status:401,body:{error:'unauthorized'}};
function parsedCookies(req){let out={};for(let part of (req.headers.cookie||'').split(';')){let eq=part.indexOf('=');if(eq<0)continue;let k=part.slice(0,eq).trim();if(k!==LINK&&k!==SESSION)continue;if(Object.hasOwn(out,k))throw Error('DUPLICATE_COOKIE');out[k]=part.slice(eq+1).trim()}return out}
async function authorityMatches(authority,claim){if(!claim)return false;try{let current=await authority.readBinding(claim.bindingRef);return !!current&&current.actor===claim.actorId&&current.epoch===claim.bindingEpoch}catch{return false}}
export async function verifyFreshSession({ledger,authority,token}){let first=ledger.inspectSession(token);if(!first||!await authorityMatches(authority,first))return null;let last=ledger.inspectSession(token);return last&&last.bindingRef===first.bindingRef&&last.actorId===first.actorId&&last.bindingEpoch===first.bindingEpoch&&last.expiresAt===first.expiresAt?last:null}
export async function authorizedRead({section,token,ledger,authority,repo,clock=Date.now}){let before=await verifyFreshSession({ledger,authority,token});if(!before)return authError;let out=await readOwn({section,session:before,repo,now:clock()});let after=await verifyFreshSession({ledger,authority,token});if(!after||after.actorId!==before.actorId||after.bindingEpoch!==before.bindingEpoch||after.bindingRef!==before.bindingRef)return authError;return out}
export function createSessionHandler({ledger,authority,repo,rateScopeFor,origin='https://portal.example.test',clock=Date.now}){
 if(!origin.startsWith('https://')||new URL(origin).origin!==origin)throw Error('EXACT_HTTPS_ORIGIN_REQUIRED');
 return async(req,res)=>{
  const send=(status,body,cookies=[])=>{if(cookies.length)res.setHeader('set-cookie',cookies);res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','cross-origin-resource-policy':'same-origin'});res.end(JSON.stringify(body))};
  try{let path=req.url;if(typeof path!=='string'||path.includes('?')||path.includes('#')||req.headers['transfer-encoding']||Number(req.headers['content-length']||0)>0)return send(400,{error:'invalid_request'});
   const methodByPath={ '/v1/link/start':'POST','/v1/link/status':'GET','/v1/link/redeem':'POST','/v1/link/cancel':'POST','/v1/session/logout':'POST','/v1/me/inventory':'GET','/v1/me/profile':'GET' };
   if(!Object.hasOwn(methodByPath,path))return send(404,{error:'not_found'});
   if(req.method!==methodByPath[path]){res.setHeader('allow',methodByPath[path]);return send(405,{error:'method_not_allowed'})}
   if(req.method==='POST'&&req.headers.origin!==origin)return send(403,{error:'origin_rejected'});
   if(req.headers.authorization!==undefined)return send(400,{error:'invalid_request'});
   let cookies;try{cookies=parsedCookies(req)}catch{return send(400,{error:'invalid_request'})}let link=cookies[LINK],session=cookies[SESSION];
   if(path==='/v1/link/start'){let scope=await rateScopeFor(req),c=ledger.issueChallenge(scope);if(c.status==='rate_limited')return send(429,{status:c.status});if(link)ledger.cancelChallenge(link);return send(201,{status:'issued',code:c.code,expiresAt:c.expiresAt},[cookie(LINK,c.browserSecret,(c.expiresAt-clock())/1000)]);}
   if(path==='/v1/link/status')return send(200,ledger.challengeStatus(link));
   if(path==='/v1/link/cancel'){const cancelled=ledger.cancelChallenge(link);return cancelled.status==='cancelled'?send(200,{status:'cancelled'},[cookie(LINK,'',0)]):send(409,{status:'unavailable'},[cookie(LINK,'',0)])}
   if(path==='/v1/link/redeem'){
    let approved=ledger.inspectApprovedChallenge(link);if(!approved||!await authorityMatches(authority,approved))return send(401,{status:'unavailable'});
    let r=ledger.redeem(link);if(r.status!=='redeemed')return send(401,{status:'unavailable'});
    let fresh=await verifyFreshSession({ledger,authority,token:r.sessionToken});if(!fresh||fresh.bindingRef!==approved.bindingRef||fresh.actorId!==approved.actorId||fresh.bindingEpoch!==approved.bindingEpoch){ledger.revokeSession(r.sessionToken);return send(401,{status:'unavailable'})}
    if(session)ledger.revokeSession(session);return send(200,{status:'redeemed',expiresAt:r.expiresAt},[cookie(SESSION,r.sessionToken,(r.expiresAt-clock())/1000),cookie(LINK,'',0)]);
   }
   if(path==='/v1/session/logout'){ledger.revokeSession(session);return send(200,{status:'signed_out'},[cookie(SESSION,'',0)])}
   let out=await authorizedRead({section:path.endsWith('inventory')?'inventory':'profile',token:session,ledger,authority,repo,clock});return send(out.status,out.body);
  }catch{return send(503,{error:'service_unavailable'})}
 };
}
export function createSessionLab(options){return http.createServer(createSessionHandler(options))}
