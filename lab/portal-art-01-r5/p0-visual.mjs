/**
 * R5 visual-only observer for P0, no authentication/authorization, no network.
 * Observes *displayed DOM* from pinned CP052 controller. Never reads cookies,
 * browser storage or profile packet internals. The state belongs to controller.
 * The decorative area is aria-hidden and cannot convey gameplay data.
 */
export function mountR5Visual(documentRef) {
  const content = documentRef.getElementById('content');
  const stage = documentRef.getElementById('visual-stage');
  const title = documentRef.getElementById('visual-label');
  const numeral = documentRef.getElementById('visual-number');
  const context = documentRef.getElementById('visual-context');
  if (!content || !stage || !title || !numeral || !context) throw Error('R5_VISUAL_CONTAINERS_REQUIRED');
  let last = null;
  const render = () => {
    const unauthenticated = !!content.querySelector('#login-heading') || !!content.querySelector('#link-heading');
    const profile = !!content.querySelector('#profile-heading');
    const inventory = !!content.querySelector('#inventory-heading');
    const detail = !!content.querySelector('#detail-heading');
    // On *any* unauthorized/indeterminate state, fail closed and purge the old
    // selection from this *decorative* representation.
    if (unauthenticated || (!profile && !inventory && !detail)) {
      last = null;
      stage.dataset.mode = 'closed';
      title.textContent = 'Sessão não confirmada';
      numeral.textContent = '◇';
      context.textContent = 'Somente leitura';
      return;
    }
    if (profile) {
      last = null;
      stage.dataset.mode = 'profile';
      title.textContent = 'Personagem';
      numeral.textContent = '◇';
      context.textContent = 'Consulta de perfil';
      return;
    }
    if (inventory) {
      const selected = content.querySelector('.item.selected[data-action="select"]');
      const group = content.querySelector('.tabs [data-action="category"][aria-pressed="true"]');
      let slot = null;
      if (selected) {
        const raw = selected.getAttribute('data-slot');
        if (/^(?:0|[1-9]\d{0,5})$/.test(raw || '')) slot = raw;
      }
      last = slot === null ? null : {slot, category: group?.textContent?.trim()?.slice(0,80) || 'Posição'};
      stage.dataset.mode = 'inventory';
      title.textContent = 'Pertences';
      numeral.textContent = slot ?? '—';
      context.textContent = last ? 'Posição selecionada' : 'Selecione uma posição';
      return;
    }
    // Detail's selected key is preserved only if previously seen as rendered
    // inventory. If direct detail load occurs, use anonymous symbol, not a guess.
    stage.dataset.mode = 'detail';
    title.textContent = 'Inspeção';
    numeral.textContent = last?.slot ?? '◇';
    context.textContent = last ? 'Posição em inspeção' : 'Leitura de detalhes';
  };
  const observer = new MutationObserver(render);
  observer.observe(content, {subtree:true, childList:true, attributes:true, attributeFilter:['class','aria-pressed','data-slot']});
  render();
  return {destroy(){observer.disconnect();last=null;title.textContent='';numeral.textContent='◇';context.textContent='';}};
}
