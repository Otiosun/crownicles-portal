/**
 * Crownicles UX-P0-010 — same-origin server-projected P0 reader rendered through
 * the pinned UX-P0-008 state machine. No session token/actor ID, no fake items,
 * no item-changing commands and no catalog names or images without provenance.
 * This module is a laboratory visual integration, NOT a production login page.
 */
import {createP0BrowserReader} from '../../integration/p0/browser-reader.cp046.mjs';
import {itemAt,canInspect,P0_CATEGORIES} from '../ux-p0-003/machine.mjs';

const LABELS=Object.freeze({weapon:'Armas',armor:'Armaduras',potion:'Poções',object:'Objetos'});
const ESC=Object.freeze({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'});
const escapeText=value=>String(value).replace(/[&<>"']/g,ch=>ESC[ch]);
const slotLabel=slot=>slot===0?'Posição ativa':`Reserva ${slot}`;
const message=(title,description,action='')=>`<div class="message" role="status"><strong>${escapeText(title)}</strong><p>${escapeText(description)}</p></div>${action?`<div class="actions"><button class="primary" data-action="${action}">Tentar novamente</button></div>`:''}`;
const statusLabel=(section,state)=>{
  const label=section==='profile'?'seu personagem':'seus pertences';
  switch(state){
   case 'idle':return message('Nenhuma consulta realizada',`A leitura de ${label} ainda não começou.`);
   case 'loading':return message('Leitura em andamento',`Consultando ${label}…`);
   case 'restricted':return message('Acesso restrito',`Não é possível apresentar ${label} nesta sessão.`);
   case 'not_initialized':return message('Ainda não preparado',`O jogo ainda não preparou ${label} para consulta.`);
   default:return message('Serviço indisponível',`A consulta de ${label} não foi concluída.`, 'retry');
  }
};
const metric=(name,value)=>`<div class="metric"><span>${escapeText(name)}</span><strong>${escapeText(value)}</strong></div>`;
function profileView(s){
 const q=s.sections.profile;
 let out='<p class="eyebrow">Consulta / 01</p><h1 id="profile-heading" tabindex="-1">Seu personagem</h1><p class="lede">Dados obtidos do próprio personagem, em modo somente leitura.</p>';
 if(q.state!=='ready')return out+statusLabel('profile',q.state);
 const p=q.data;
 let metrics=[metric('Nível',p.level),metric('Vida',`${p.health.value} / ${p.health.max}`),metric('Experiência',`${p.experience.value} / ${p.experience.max}`),metric('Dinheiro',p.money)];
 out+=`<div class="metrics">${metrics.join('')}</div><p class="muted">Nome público, classe traduzida e imagens não são exibidos sem fonte canônica aprovada.</p><div class="actions"><button class="primary" data-action="inventory">Ver pertences</button><button data-action="refresh">Atualizar personagem</button></div>`;
 return out;
}
function inventoryView(s){
 const q=s.sections.inventory;
 let out='<p class="eyebrow">Consulta / 02</p><h1 id="inventory-heading" tabindex="-1">Pertences</h1><p class="lede">Selecione uma categoria e posição. Inspecionar não altera o jogo.</p>';
 if(q.state!=='ready')return out+statusLabel('inventory',q.state)+'<div class="actions"><button data-action="profile">Voltar ao personagem</button></div>';
 const c=q.data.categories.find(row=>row.category===s.category);
 if(!c)return out+statusLabel('inventory','unavailable');
 out+=`<div class="tabs" role="group" aria-label="Categorias">${P0_CATEGORIES.map(name=>`<button id="category-${name}" data-action="category" data-category="${name}" aria-pressed="${name===s.category}">${escapeText(LABELS[name])}</button>`).join('')}</div>`;
 out+=`<p class="muted">${escapeText(LABELS[s.category])} · capacidade: ${escapeText(c.capacity)} posições (não é quantidade de itens)</p><div class="item-list" role="group" aria-label="Posições do inventário">`;
 const rows=[{slot:0,display:c.active},...c.reserves].filter(row=>itemAt(q.data,s.category,row.slot));
 for(const row of rows){
  const selected=s.selected?.category===s.category&&s.selected?.slot===row.slot&&s.selected?.id===row.display.id;
  out+=`<button class="item ${selected?'selected':''}" id="item-${s.category}-${row.slot}" data-action="select" data-category="${s.category}" data-slot="${row.slot}" aria-pressed="${!!selected}"><span><span class="slot">${escapeText(slotLabel(row.slot))}</span><br><span class="itemid">ID ${escapeText(row.display.id)} · sem nome ou arte atribuída</span></span><span aria-hidden="true">${selected?'●':'○'}</span></button>`;
 }
 out+='</div>';
 if(s.selected)out+=`<div class="selection"><strong>Selecionado:</strong> ${escapeText(LABELS[s.selected.category])}, ${escapeText(slotLabel(s.selected.slot))}, ID ${escapeText(s.selected.id)}.<div class="actions"><button class="primary" data-action="inspect" ${canInspect(s)?'':'disabled'}>Inspecionar item</button></div></div>`;
 out+='<div class="actions"><button data-action="profile">Voltar ao personagem</button><button data-action="refresh">Atualizar pertences</button></div>';
 return out;
}
function detailView(s){
 const q=s.sections.inventory,sel=s.selected;
 if(!sel||q.state!=='ready'||s.view!=='detail')return inventoryView(s);
 const c=q.data.categories.find(x=>x.category===sel.category);
 const display=sel.slot===0?c?.active:c?.reserves.find(x=>x.slot===sel.slot)?.display;
 if(!display||display.id!==sel.id)return inventoryView(s);
 const facts=[['Categoria',LABELS[sel.category]],['Posição',slotLabel(sel.slot)],['ID de catálogo',display.id]];
 for(const key of ['attack','defense','speed']){
  const stat=display[key];if(!stat)continue;
  if(stat.baseValue!==undefined)facts.push([`${key} · base`,stat.baseValue]);
  if(stat.upgradeValue!==undefined)facts.push([`${key} · melhoria`,stat.upgradeValue]);
 }
 return `<p class="eyebrow">Consulta / 02 / Inspeção</p><h1 id="detail-heading" tabindex="-1">Inspecionar item</h1><p class="lede">Detalhes somente de leitura da posição selecionada.</p><dl class="facts">${facts.map(([a,b])=>`<div class="fact"><dt>${escapeText(a)}</dt><dd>${escapeText(b)}</dd></div>`).join('')}</dl><div class="message"><strong>Catálogo aguardando fonte</strong><p>Este item não recebe nome traduzido nem ilustração sem catálogo e licença validados.</p></div><div class="actions"><button class="primary" data-action="back">Voltar ao mesmo item</button></div>`;
}

/** All browser effects are local/same-origin. Calling verify only *attempts*
 *  cookie session retrieval; it does not claim the user is authenticated. */
export function mountP0Portal(documentRef,{fetcher=globalThis.fetch,focus=true,logoutTimeoutMs=4000,readTimeoutMs=12000}={}){
 if(!Number.isSafeInteger(logoutTimeoutMs)||logoutTimeoutMs<10||logoutTimeoutMs>10000)throw RangeError('LOGOUT_TIMEOUT_INVALID');
 if(!Number.isSafeInteger(readTimeoutMs)||readTimeoutMs<10||readTimeoutMs>30000)throw RangeError('READ_TIMEOUT_INVALID');
 if(!documentRef?.getElementById)throw TypeError('DOCUMENT_REQUIRED');
 const content=documentRef.getElementById('content');
 const navigation=documentRef.getElementById('navigation');
 const status=documentRef.getElementById('status');
 if(!content||!navigation||!status)throw TypeError('P0_DOM_CONTAINERS_REQUIRED');
 let checking=false,signingOut=false,announcement='';
 const focusTo=id=>{if(!focus)return;globalThis.requestAnimationFrame?.(()=>documentRef.getElementById(id)?.focus({preventScroll:true}));};
 const reader=createP0BrowserReader({fetcher,onChange:render});
 function render(state){
  navigation.innerHTML=state.authorized&&!checking?
   `<button data-action="profile" ${state.view==='profile'?'aria-current="page"':''}>Personagem</button><button data-action="inventory" ${state.view!=='profile'?'aria-current="page"':''}>Pertences</button><button data-action="forget">Encerrar sessão</button>`:
   '<p class="muted">Somente leitura</p>';
  if(checking){content.innerHTML='<h1 id="login-heading" tabindex="-1">Verificando sessão</h1>'+statusLabel('profile','loading');}
  else if(!state.authorized){
   content.innerHTML=`<p class="eyebrow">Acesso privado</p><h1 id="login-heading" tabindex="-1">Seu personagem</h1><p class="lede">É necessário ter uma sessão vinculada e confirmada no servidor. Esta tela não recebe credenciais nem permite escolher outro jogador.</p><div class="actions"><button class="primary" data-action="verify" ${signingOut?'disabled':''}>Verificar sessão existente</button></div>`;
  }else content.innerHTML=state.view==='detail'?detailView(state):state.view==='inventory'?inventoryView(state):profileView(state);
  status.textContent=announcement||(checking?'Verificando a sessão com o servidor.':state.authorized?'Resposta vinculada à sessão do servidor. Nenhum comando de jogo é enviado.':'Nenhuma sessão autenticada confirmada.');
 }
 async function readWithDeadline(section){
  const epoch=reader.getState().epoch;
  let timer;
  // This deadline covers BOTH fetch and stream consumption. BrowserReader's
  // own abortAll on AUTH_LOST signals pending fetches and invalidates epoch.
  // An adapter which ignores AbortSignal can finish later, but its stale epoch
  // cannot reintroduce cached data into the UI.
  const task=reader.read(section);
  const deadline=new Promise(resolve=>{timer=setTimeout(()=>{
   if(reader.getState().epoch===epoch){
    reader.dispatch({type:'AUTH_LOST'});
    announcement='A leitura excedeu o prazo. Os dados locais foram removidos; verifique a sessão novamente.';
   }
   resolve(null);
  },readTimeoutMs)});
  try{return await Promise.race([task,deadline]);}
  finally{clearTimeout(timer);}
 }
 async function verify(){
  if(checking||signingOut)return;
  checking=true;announcement='';reader.dispatch({type:'AUTH_ESTABLISHED'});
  try{
   await readWithDeadline('profile');
   const current=reader.getState();
   // The transport currently distinguishes malformed/non-200 from 200
   // 'unavailable' only inside its adapter. Conservatively treat both as
   // unverified; an unavailable profile MUST NOT become a claimed login.
   if(current.authorized&&current.sections.profile.state==='unavailable'){
    reader.dispatch({type:'AUTH_LOST'});
    announcement='Não foi possível confirmar a sessão. Verifique o serviço e tente novamente.';
   }
  }catch{
   reader.dispatch({type:'AUTH_LOST'});
   announcement='Falha ao verificar a sessão. Nenhum dado foi mantido.';
  }finally{
   checking=false;render(reader.getState());focusTo(reader.getState().authorized?'profile-heading':'login-heading');
  }
 }
 async function fetchSection(section){
  if(!reader.getState().authorized)return;
  announcement='';
  try{
   await readWithDeadline(section);
   const current=reader.getState();
   // A 503 or structurally invalid 200 cannot establish that an old session
   // still belongs to this actor. Clear BOTH sections instead of retaining
   // sensitive data from the last successfully verified request.
   if(current.authorized&&current.sections[section].state==='unavailable'){
    reader.dispatch({type:'AUTH_LOST'});
    announcement='Não foi possível confirmar a sessão durante a atualização. Dados locais removidos.';
   }
   render(reader.getState());
  }catch{
   reader.dispatch({type:'AUTH_LOST'});
   announcement='Falha de leitura. Dados locais removidos.';
   render(reader.getState());
  }
 }
 async function forget(){
  if(signingOut)return;
  signingOut=true;checking=false;reader.dispatch({type:'LOGOUT'});
  announcement='Dados locais removidos; revogando a sessão no servidor…';render(reader.getState());
  const cancel=new AbortController();let timer;
  const task=(async()=>{
   const reply=await fetcher('/v1/session/logout',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json'},signal:cancel.signal});
   if(reply?.status!==200||!/^application\/json(?:\s*;|\s*$)/i.test(reply.headers?.get('content-type')??''))return false;
   const reported=reply.headers?.get('content-length');
   if(reported!==null&&reported!==undefined&&(!/^[0-9]+$/.test(reported)||Number(reported)>1024))return false;
   const stream=reply.body;
   if(!stream||typeof stream.getReader!=='function')return false;
   const bytes=stream.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
   let text='',total=0;
   try{
    while(true){const {done,value}=await bytes.read();if(done)break;
     if(!(value instanceof Uint8Array))return false;
     total+=value.byteLength;if(total>1024)return false;
     text+=decoder.decode(value,{stream:true});
    }
    text+=decoder.decode();const data=JSON.parse(text);
    return !!data&&typeof data==='object'&&!Array.isArray(data)&&Object.keys(data).length===1&&data.status==='signed_out';
   }finally{try{await bytes.cancel()}catch{/* finished stream */}bytes.releaseLock()}
  })();
  const limit=new Promise((_,reject)=>{timer=setTimeout(()=>{cancel.abort();reject(Error('LOGOUT_TIMEOUT'))},logoutTimeoutMs)});
  try{
   const confirmed=await Promise.race([task,limit]);
   announcement=confirmed?'Sessão encerrada pelo servidor.':'Dados locais removidos. O servidor não confirmou a revogação; encerre também a sessão no serviço de origem.';
  }catch{announcement='Dados locais removidos. Não foi possível confirmar a revogação no servidor.';}
  finally{clearTimeout(timer);cancel.abort();signingOut=false;render(reader.getState());focusTo('login-heading');}
 }
 const onClick=ev=>{
  const button=ev.target?.closest?.('button[data-action]');
  if(!button||!documentRef.contains(button)||button.disabled)return;
  const action=button.dataset.action,view=reader.getState().view;
  if(action==='verify'){void verify();return;}
  if(action==='forget'){void forget();return;}
  if(!reader.getState().authorized||checking||signingOut)return;
  if(action==='profile'||action==='inventory'){
   reader.dispatch({type:action==='profile'?'GO_PROFILE':'GO_INVENTORY'});
   if(action==='inventory'&&reader.getState().sections.inventory.state==='idle')void fetchSection('inventory');
   focusTo(action==='profile'?'profile-heading':'inventory-heading');return;
  }
  if(action==='category'){reader.dispatch({type:'SET_CATEGORY',category:button.dataset.category});focusTo(`category-${button.dataset.category}`);return;}
  if(action==='select'){reader.dispatch({type:'SELECT_ITEM',category:button.dataset.category,slot:Number(button.dataset.slot)});focusTo(`item-${button.dataset.category}-${button.dataset.slot}`);return;}
  if(action==='inspect'){reader.dispatch({type:'OPEN_DETAIL'});focusTo('detail-heading');return;}
  if(action==='back'){const previous=reader.getState().selected;reader.dispatch({type:'BACK'});
   focusTo(view==='detail'&&previous?`item-${previous.category}-${previous.slot}`:'profile-heading');return;}
  if(action==='retry'||action==='refresh')void fetchSection(view==='profile'?'profile':'inventory');
 };
 documentRef.addEventListener('click',onClick);
 render(reader.getState());
 return Object.freeze({reader,verify,forget,destroy:()=>{reader.dispatch({type:'LOGOUT'});documentRef.removeEventListener('click',onClick)}});
}
