/** ART01 R6 | A presentation-only observer of the real CP052 controller DOM.
 * No access to tokens, cookies, hidden game fields, authorization, or fetch.
 * The auth controller is authoritative: this module cannot unlock data.
 */
export function mountR6Visual(doc, {MutationObserverClass=globalThis.MutationObserver}={}) {
  const content=doc.getElementById('content'),stage=doc.getElementById('visual-stage');
  const label=doc.getElementById('visual-label'),number=doc.getElementById('visual-number'),context=doc.getElementById('visual-context');
  const rail=doc.querySelector('.rail');
  if(!content||!stage||!label||!number||!context || typeof MutationObserverClass !== 'function') throw Error('R6_CONTAINERS_REQUIRED');
  let last=null;
  const reset=()=>{
    last=null;stage.dataset.mode='closed';stage.hidden=true;if(rail)rail.hidden=true;
    label.textContent='';number.textContent='◇';context.textContent='';
  };
  const update=()=>{
    // A login heading is displayed not only on startup, but also on
    // in-flight verification and after 401/logout. Fail closed before anything else.
    if(content.querySelector('#login-heading') || content.querySelector('#link-heading')) {reset();return;}
    const profile=content.querySelector('#profile-heading');
    const inventory=content.querySelector('#inventory-heading');
    const detail=content.querySelector('#detail-heading');
    if(!profile&&!inventory&&!detail){reset();return;}
    stage.hidden=false;if(rail)rail.hidden=false;
    if(profile){last=null;stage.dataset.mode='profile';label.textContent='Personagem';number.textContent='◇';context.textContent='Consulta de perfil';return;}
    if(inventory){
      stage.dataset.mode='inventory';label.textContent='Pertences';
      const selected=content.querySelector('.item.selected[data-action="select"]');
      const category=selected?.getAttribute('data-category');
      const slot=selected?.getAttribute('data-slot');
      const knownCat=category && /^(weapon|armor|potion|object)$/.test(category);
      const knownSlot=slot!==null && /^(0|[1-9][0-9]{0,5})$/.test(slot||'');
      last=knownCat&&knownSlot?{category,slot}:null;
      number.textContent=last?.slot??'—';
      context.textContent=last?'Posição selecionada':'Escolha uma posição';
      return;
    }
    stage.dataset.mode='detail';label.textContent='Inspeção';
    number.textContent=last?.slot??'◇';
    context.textContent=last?'Posição em inspeção':'Leitura de detalhes';
  };
  const mo=new MutationObserverClass(update);
  mo.observe(content,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-pressed','data-category','data-slot']});
  update();
  return Object.freeze({destroy(){mo.disconnect();reset();}});
}
