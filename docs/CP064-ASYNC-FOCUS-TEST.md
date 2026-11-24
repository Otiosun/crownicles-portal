# CP064 — esperar o foco assíncrono no teste Chromium P0

**24/11/2026 · QA de navegador em laboratório, candidato, não é mudança do produto.**

## Defeito reproduzível do teste

Fonte pinada de `lab/ux-p0-010/test_preview.py` na PR42 HEAD `135362b2eb0d9f93b5aaea62f0fbe969a1388542`, Git blob `31f970adc64fcbd59834a1e4ea26b4e3b82d0133`. A suíte chama `ready(page,'inventory')` (espera a leitura concluir) e **imediatamente** exige que `document.activeElement.id === 'inventory-heading'`. Mas o controlador agenda a recuperação do foco em `requestAnimationFrame`, que pode ocorrer **depois** da conclusão do estado `ready`. Isso permite um falso negativo sem bug funcional da interface.

Com o **código de produção do controlador intacto**, injetamos **somente na fixture do teste** `window.requestAnimationFrame=fn=>setTimeout(fn,100)` para simular o próximo quadro adiado por carga do executor. A versão original da suíte deu **RED 45/46**, com exatamente `FAIL Async inventory load restores heading focus`; a UI já alcançava o foco correto logo depois. Experimento controlado com atrasos de **0, 16, 50, 100 e 200ms** mostrou que a asserção instantânea começa a falhar com 50ms, mas a asserção *eventual* alcança `inventory-heading` em todos os cinco casos.

## Correção mínima da suíte (sem alterar o site)

Adicionar `page.wait_for_function("document.activeElement?.id==='inventory-heading'",timeout=3000)` imediatamente antes da asserção original `ck(...)`. Isso aguarda a condição de UX **real** por até três segundos e falha se o foco **não** se estabelecer; não remove a asserção, não injeta foco manual e não troca o objeto testado.

Sobre a mesma fixture sintética de RAF 100ms, sem qualquer outro ajuste: **GREEN 46/46**, exit0. Sem atraso artificial, a mesma suíte deve continuar passando. Um timeout ou foco no elemento errado continua sendo falha, não sucesso falso.

## Limite de atribuição à falha da PR42

A PR42 observou `gate:p0:lab:native-browser` falhar no estágio Chromium depois de P0 239 e HTTPS 16 passarem. O log de diagnóstico identifica `completed_browser_markers=0`, `fail_markers=1`, `exception=UNKNOWN`; não inclui o nome da asserção. Nosso experimento demonstra **uma causa possível e reproduzível**, **NÃO comprova** que era a causa exata daquele run. A CI GitHub `npm run check` não executa essa suíte Chromium; somente uma execução futura do gate de navegador em runner autorizado poderá confirmar a hipótese. Não interpretar uma CI normal verde como prova do gate CLI.

## Coordenação

Branch PR DRAFT originada exatamente de PR42 HEAD `135362b2eb0d9f93b5aaea62f0fbe969a1388542`. Só `lab/ux-p0-010/test_preview.py` e este documento; não tocar gate TAP, workflow CP060, `controller.mjs`, frontend, banco/WA/Core/OIDC, PR42, PR44 de reconsulta, CP063 concorrência de códigos, main ou produção. Manter validação de UX e dados sintéticos.