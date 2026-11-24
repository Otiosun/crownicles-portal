import test from 'node:test';
import assert from 'node:assert/strict';
import {mountP0Portal} from '../../lab/ux-p0-010/controller.mjs';

// Minimal DOM contract: production renderer and browser reader, but only a
// synthetic server response. No request to an external address or cookie.
function mounted(reply=()=>new Response('',{status:401})) {
  const content={innerHTML:'',querySelector(){return null;},querySelectorAll(){return []}};
  const navigation={innerHTML:''}, status={textContent:''};
  const handlers=new Map(),calls=[];
  const dom={
    getElementById(id){return {content,navigation,status}[id]??null;},
    addEventListener(name,fn){handlers.set(name,fn);},
    removeEventListener(name){handlers.delete(name);},
    contains(){return true;}
  };
  const portal=mountP0Portal(dom,{focus:false,fetcher:async(path,options)=>{
    calls.push({path,options});return reply(path,options);
  }});
  function settle(section,domainState) {
    if(!portal.reader.getState().authorized)portal.reader.dispatch({type:'AUTH_ESTABLISHED'});
    if(section==='inventory')portal.reader.dispatch({type:'GO_INVENTORY'});
    const epoch=portal.reader.getState().epoch;
    const requestId=section==='profile'?121:122;
    portal.reader.dispatch({type:'FETCH_STARTED',section,epoch,requestId});
    portal.reader.dispatch({type:'FETCH_FINISHED',section,epoch,requestId,domainState});
  }
  function retry(){
    handlers.get('click')({target:{closest(selector){assert.equal(selector,'button[data-action]');return {dataset:{action:'retry'},disabled:false};}}});
  }
  async function flushed(){await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));}
  return {portal,content,navigation,status,calls,settle,retry,flushed,close:()=>portal.destroy()};
}

test('CP062 — not_initialized Personagem renders accessible read-only retry',()=>{
  const ui=mounted();
  try{
    ui.settle('profile','not_initialized');
    assert.match(ui.content.innerHTML, /Ainda não preparado/);
    assert.match(ui.content.innerHTML, /<button class="primary" data-action="retry">Tentar novamente<\/button>/);
    assert.doesNotMatch(ui.content.innerHTML, /class="metrics"/);
    assert.equal(ui.portal.reader.getState().sections.profile.data,null);
  }finally{ui.close()}
});

test('CP062 — not_initialized Pertences renders retry with safe Profile return',()=>{
  const ui=mounted();
  try{
    ui.settle('inventory','not_initialized');
    assert.match(ui.content.innerHTML, /data-action="retry"/);
    assert.match(ui.content.innerHTML, /data-action="profile">Voltar ao personagem/);
    assert.doesNotMatch(ui.content.innerHTML, /data-action="select"/);
  }finally{ui.close()}
});

test('CP062 — retry uses existing GET transport, no bearer and 401 revokes session',async()=>{
  let n=0;
  const ui=mounted(()=>++n===1?
    new Response(JSON.stringify({state:'not_initialized',asOf:'2026-11-23T04:00:00.000Z'}),{status:200,headers:{'content-type':'application/json'}}):
    new Response('',{status:401}));
  try{
    ui.portal.reader.dispatch({type:'AUTH_ESTABLISHED'});
    await ui.portal.reader.read('profile');
    assert.equal(ui.portal.reader.getState().sections.profile.state,'not_initialized');
    ui.retry();await ui.flushed();
    assert.equal(ui.calls.length,2);
    assert.equal(ui.calls[1].path,'/v1/me/profile');
    assert.equal(ui.calls[1].options.method,'GET');
    assert.equal(ui.calls[1].options.credentials,'same-origin');
    assert.equal(ui.calls[1].options.cache,'no-store');
    assert.equal(ui.calls[1].options.redirect,'error');
    assert.equal(Object.keys(ui.calls[1].options.headers).some(k=>['cookie','authorization'].includes(k.toLowerCase())),false);
    assert.equal(ui.portal.reader.getState().authorized,false);
    assert.equal(ui.portal.reader.getState().sections.profile.data,null);
    assert.doesNotMatch(ui.content.innerHTML, /data-action="retry"/);
  }finally{ui.close()}
});

test('CP062 — retry 503 removes any earlier Profile and Inventory state',async()=>{
  let n=0;
  const ui=mounted(()=>++n===1?
    new Response(JSON.stringify({state:'not_initialized',asOf:'2026-11-23T04:00:00.000Z'}),{status:200,headers:{'content-type':'application/json'}}):
    new Response('',{status:503}));
  try{
    ui.portal.reader.dispatch({type:'AUTH_ESTABLISHED'});
    ui.portal.reader.dispatch({type:'GO_INVENTORY'});
    await ui.portal.reader.read('inventory');
    assert.equal(ui.portal.reader.getState().sections.inventory.state,'not_initialized');
    ui.retry();await ui.flushed();
    assert.equal(ui.calls.length,2);
    assert.equal(ui.calls[1].path,'/v1/me/inventory');
    assert.equal(ui.portal.reader.getState().authorized,false);
    assert.equal(ui.portal.reader.getState().sections.profile.data,null);
    assert.equal(ui.portal.reader.getState().sections.inventory.data,null);
  }finally{ui.close()}
});

test('CP062 — restricted does not masquerade as not_initialized recovery',()=>{
  const ui=mounted();
  try{
    ui.settle('profile','restricted');
    assert.match(ui.content.innerHTML, /Acesso restrito/);
    assert.doesNotMatch(ui.content.innerHTML, /data-action="retry"/);
  }finally{ui.close()}
});
