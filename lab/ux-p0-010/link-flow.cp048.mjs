/**
 * CP048: browser-only challenge flow for the ORIGINAL CP014 private-confirmation
 * protocol. Never accepts player IDs or a browser-side private confirmation.
 * Browser never reads/writes the HttpOnly __Host-crownicles_link/session cookies.
 * Pure transport; security and rate limits MUST be enforced server-side.
 */
const PATHS=Object.freeze({start:'/v1/link/start',check:'/v1/link/status',redeem:'/v1/link/redeem',cancel:'/v1/link/cancel'});
const CODE=/^[2-9A-HJ-NP-Z]{4}(?:-[2-9A-HJ-NP-Z]{4}){2}$/;
const STATUSES=new Set(['pending','awaiting_confirmation','approved']);
const MAX_JSON=2048;
const TYPE=/^application\/json(?:\s*;|\s*$)/i;
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const safeRecord=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const exact=(o,names)=>safeRecord(o)&&Object.keys(o).every(k=>names.includes(k));
const fresh=()=>Object.freeze({phase:'idle',code:null,expiresAt:null,message:''});
async function readJson(response){
 if(!TYPE.test(response?.headers?.get?.('content-type')??''))throw Error('BAD_MIME');
 const declared=response.headers?.get?.('content-length');
 if(declared!==null&&declared!==undefined&&(!/^[0-9]+$/.test(declared)||Number(declared)>MAX_JSON))throw Error('BAD_SIZE');
 if(!response.body||typeof response.body.getReader!=='function')throw Error('NO_STREAM');
 const reader=response.body.getReader();const decoder=new TextDecoder('utf-8',{fatal:true});let size=0,text='';
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   if(!(value instanceof Uint8Array))throw Error('BAD_BYTES');
   size+=value.byteLength;if(size>MAX_JSON)throw Error('BAD_SIZE');
   text+=decoder.decode(value,{stream:true});
  }
  text+=decoder.decode();const obj=JSON.parse(text);
  if(!safeRecord(obj))throw Error('BAD_SHAPE');
  return obj;
 }finally{try{await reader.cancel()}catch{}reader.releaseLock()}
}
const validExpiry=(x,now,maxAheadMs)=>Number.isSafeInteger(x)&&x>now-30000&&x<=now+maxAheadMs;
export function createP0LinkFlow({fetcher=globalThis.fetch,clock=Date.now,onChange=()=>{},onLinked=async()=>false,timeoutMs=5000}={}){
 if(typeof fetcher!=='function'||typeof clock!=='function'||typeof onChange!=='function'||typeof onLinked!=='function')throw TypeError('CP048_CALLBACK_REQUIRED');
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<10||timeoutMs>30000)throw RangeError('CP048_TIMEOUT_INVALID');
 let state=fresh(),serial=0,active=null,disposed=false;
 const now=()=>{const value=clock();if(!Number.isSafeInteger(value)||value<0)throw Error('BAD_CLOCK');return value};
 const publish=next=>{if(disposed)return state;state=Object.freeze(next);onChange(state);return state};
 const abort=()=>{if(active)active.abort();active=null};
 const still=s=>!disposed&&s===serial;
 const issue=async(method,path,signal)=>{
  const controller=new AbortController();let timer;
  const onAbort=()=>controller.abort();
  signal.addEventListener('abort',onAbort,{once:true});
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('CP048_DEADLINE'))},timeoutMs)});
  const task=(async()=>{
   const res=await fetcher(path,{method,credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json'},signal:controller.signal});
   return {status:res?.status??503,data:await readJson(res)};
  })();
  try{return await Promise.race([task,timeout]);}
  finally{clearTimeout(timer);signal.removeEventListener('abort',onAbort);controller.abort();}
 };
 const run=async(type,expected,working,fn)=>{
  if(disposed||active||!expected.includes(state.phase))return false;
  const seq=++serial,controller=new AbortController();active=controller;
  const prior=state;publish({...prior,phase:working,message:''});
  try{
   const result=await issue(type==='check'?'GET':'POST',PATHS[type],controller.signal);
   if(!still(seq))return false;
   await fn(result,prior,seq);
   return true;
  }catch{
   if(still(seq))publish({phase:'error',code:null,expiresAt:null,message:'O serviço não respondeu de forma verificável. Tente novamente.'});
   return false;
  }finally{if(active===controller)active=null;}
 };
 const clearIfExpired=()=>{
  if(!state.expiresAt)return false;
  if(now()<state.expiresAt)return false;
  ++serial;abort();publish({phase:'expired',code:null,expiresAt:null,message:'O código expirou. Inicie uma nova vinculação.'});return true;
 };
 const start=()=>run('start',['idle','error','expired','cancelled','rate_limited'],'requesting',async({status,data},before,seq)=>{
  if(status===429&&exact(data,['status'])&&data.status==='rate_limited'){
   publish({phase:'rate_limited',code:null,expiresAt:null,message:'Muitas solicitações. Aguarde antes de tentar novamente.'});return;
  }
  if(status!==201||!exact(data,['status','code','expiresAt'])||data.status!=='issued'||!CODE.test(data.code)||!validExpiry(data.expiresAt,now(),6*60_000))throw Error('INVALID_START');
  publish({phase:'issued',code:data.code,expiresAt:data.expiresAt,message:'Envie o código somente à conversa privada oficial e confirme lá.'});
 });
 const check=async()=>{
  if(clearIfExpired())return false;
  return run('check',['issued','pending','awaiting_confirmation','approved'],'checking',async({status,data},before)=>{
   if(status!==200||!exact(data,['status','expiresAt'])||!validExpiry(data.expiresAt,now(),6*60_000)||!STATUSES.has(data.status)){
    // Server refuses missing/revoked/expired challenge; no old code is retained.
    publish({phase:'expired',code:null,expiresAt:null,message:'A vinculação não está mais disponível. Gere um novo código.'});return;
   }
   if(data.expiresAt!==before.expiresAt)throw Error('EXPIRY_DRIFT');
   publish({phase:data.status,code:before.code,expiresAt:before.expiresAt,
     message:data.status==='approved'?'Confirmação privada recebida. Finalize o acesso.':data.status==='awaiting_confirmation'?'Aguardando sua confirmação no canal privado.':'Aguardando o código ser apresentado no canal privado.'});
  });
 };
 const redeem=async()=>{
  if(clearIfExpired())return false;
  return run('redeem',['approved'],'redeeming',async({status,data},before,seq)=>{
   if(status!==200||!exact(data,['status','expiresAt'])||data.status!=='redeemed'||!validExpiry(data.expiresAt,now(),9*60*60_000))throw Error('INVALID_REDEEM');
   // The cookie is HttpOnly. A successful redeem response alone is NOT an
   // authenticated session: verify by reading /v1/me/profile afterward.
   publish({phase:'verifying',code:null,expiresAt:null,message:'Confirmando leitura da sessão…'});
   const verified=await onLinked();
   if(!still(seq))return;
   if(verified!==true)throw Error('SESSION_NOT_VERIFIED');
   publish({phase:'linked',code:null,expiresAt:null,message:'Sessão confirmada pelo servidor.'});
  });
 };
 const cancel=async()=>{
  if(disposed||['idle','cancelled','linked'].includes(state.phase))return false;
  ++serial;abort();publish({phase:'cancelling',code:null,expiresAt:null,message:'Descartando código e solicitando cancelamento…'});
  const seq=serial,controller=new AbortController();active=controller;
  try{
   const {status,data}=await issue('POST',PATHS.cancel,controller.signal);
   if(!still(seq))return false;
   if(status!==200||!exact(data,['status'])||data.status!=='cancelled')throw Error('CANCEL_NOT_CONFIRMED');
   publish({phase:'cancelled',code:null,expiresAt:null,message:'Código cancelado no servidor.'});return true;
  }catch{
   if(still(seq))publish({phase:'error',code:null,expiresAt:null,message:'Código removido desta tela; cancelamento no servidor não confirmado. Espere sua expiração.'});
   return false;
  }finally{if(active===controller)active=null;}
 };
 // Clear only local state. Consumed challenges are already invalid on server;
 // outstanding unconsumed challenges still expire or require explicit cancel.
 const reset=({notify=true}={})=>{++serial;abort();if(!disposed){state=fresh();if(notify)onChange(state)}};
 const destroy=()=>{reset({notify:false});disposed=true};
 return Object.freeze({start,check,redeem,cancel,reset,destroy,getState:()=>state});
}
