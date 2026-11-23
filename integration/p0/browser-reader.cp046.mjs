/** CP046: browser-side P0 HTTP transport; no UI design, auth or game action.
 * Uses the P0 state machine and server-projected DTO guard through the
 * existing response bridge; no JWT, player selector or manual Cookie header.
 */
import {initialState,transition} from '../../lab/ux-p0-003/machine.mjs';
import {startRead,finishRead} from './response-bridge.mjs';
const PATHS=Object.freeze({profile:'/v1/me/profile',inventory:'/v1/me/inventory'});
const MAX_JSON_BYTES=128*1024;
const typeMatches=header=>typeof header==='string'&&/^application\/json(?:\s*;|\s*$)/i.test(header);
async function boundedBody(response){
  if(!typeMatches(response.headers?.get('content-type')))throw Error('MIME_REJECTED');
  const size=response.headers?.get('content-length');
  if(size!==null&&size!==undefined&&(!/^[0-9]+$/.test(size)||Number(size)>MAX_JSON_BYTES))throw Error('TOO_LARGE');
  if(!response.body||typeof response.body.getReader!=='function')throw Error('STREAM_REQUIRED');
  const reader=response.body.getReader();
  const decoder=new TextDecoder('utf-8',{fatal:true});let total=0,text='';
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(!(value instanceof Uint8Array))throw Error('NON_BYTES');
      total+=value.byteLength;
      if(total>MAX_JSON_BYTES)throw Error('TOO_LARGE');
      text+=decoder.decode(value,{stream:true});
    }
    text+=decoder.decode();
    const body=JSON.parse(text);
    if(!body||typeof body!=='object'||Array.isArray(body))throw Error('INVALID_JSON');
    return body;
  }finally{try{await reader.cancel()}catch{/* already drained */}reader.releaseLock()}
}
export function createP0BrowserReader({fetcher=globalThis.fetch,onChange=()=>{}}={}){
  if(typeof fetcher!=='function'||typeof onChange!=='function')throw TypeError('BROWSER_READER_CALLBACKS_REQUIRED');
  let state=initialState(),counter=0;
  const outstanding=new Set();
  const publish=next=>{state=next;onChange(next);return next};
  const abortAll=()=>{for(const item of outstanding)item.abort();outstanding.clear()};
  const dispatch=event=>{
    if(event?.type==='AUTH_ESTABLISHED'||event?.type==='AUTH_LOST'||event?.type==='LOGOUT')abortAll();
    return publish(transition(state,event));
  };
  const read=async section=>{
    if(!Object.hasOwn(PATHS,section))throw TypeError('P0_SECTION_REQUIRED');
    const started=startRead(state,section,++counter);
    if(!started.token)return {accepted:false,state};
    publish(started.state);
    const controller=new AbortController();outstanding.add(controller);
    let reply;
    try{
      const res=await fetcher(PATHS[section],{
        method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',
        headers:{Accept:'application/json'},signal:controller.signal
      });
      if(res?.status===401)reply={status:401};
      else if(res?.status===200)reply={status:200,body:await boundedBody(res)};
      else reply={status:res?.status??503};
    }catch{reply={status:503};}
    finally{outstanding.delete(controller)}
    const before=state;
    const next=finishRead(state,started.token,reply);
    if(next!==before)publish(next);
    if(reply.status===401&&next.authorized===false)abortAll();
    return {accepted:true,state};
  };
  return Object.freeze({read,dispatch,getState:()=>state});
}
