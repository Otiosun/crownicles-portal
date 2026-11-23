# CP055 — Corrigir disputa de foco na busca do inventário (P0)

**Status:** laboratório, PR draft baseada em CP052 (#22). Sem merge, deploy, Core, DB, WhatsApp ou aprovação visual.

## Problema reproduzido na árvore CP052 original

Em CP050 Chromium, após digitar `70` (nenhum item), trocar categoria e limpar a busca, `locator('#inventory-query').fill('')` às vezes terminava sem modificar o valor. Na falha, o campo ainda apresentava `70`, 0 resultados, indicador vazio visível; não houve evento `input`; o elemento com foco era o botão da categoria. A alteração de categoria havia agendado `requestAnimationFrame(() => categoryButton.focus())`; esse foco podia correr entre a obtenção do foco e a digitação. Resultado observado em 23/11: **1/35** falhas no clone original (reproduções anteriores CP053: 3/10), sem diagnóstico de navegador HTTPS real.

**Causa causal determinística:** o teste CP055 retém callbacks de `requestAnimationFrame`, clica outra categoria, foca o campo de pesquisa antes da restauração pendente, libera o callback e tenta limpar por teclado. A versão original retorna 7/14 (falha de preservação de foco, digitação e visibilidade). Não depende de sorte ou esperas arbitrárias.

## Correção mínima

`mountP0Portal` conserva agora `focusGeneration` e a identidade do elemento ativo **imediatamente depois** de agendar o foco. O callback de `requestAnimationFrame` só aplica a restauração se:

1. Continua sendo a **última** solicitação de foco de navegação, e
2. O elemento com foco continua exatamente o que havia quando a restauração foi agendada.

Se o usuário clica/digita em outro campo, o callback fica inerte. Se ocorrerem duas mudanças de categoria antes de um frame, apenas a última poderá aplicar o foco. O comportamento de foco quando não há interferência continua preservado. Zero alteração de render, slot, dados, filtros, sessão, endpoint, HTTPS, permissão ou texto visual.

Uma primeira correção só com comparação de `activeElement` resolveu a falha inicial, mas **criou** possível regressão com duas navegações em um frame: a primeira alteração roubaria o foco e inibiria a segunda. O teste CP055 reproduziu **13/14** na primeira correção e **14/14** após introduzir `focusGeneration`.

## Como testar

Na árvore da PR CP055, com Chromium e Playwright instalados:

```sh
python lab/ux-p0-010/test_focus_race.cp055.py
npm run test:p0
npm run test:p0:browser
npm run test:p0:https
```

**Resultados em reconstrução isolada CP049 R3+CP052 Git source-pinned+CP055:**
- Teste CP055 determinístico: original **10/14** (RED), correção incompleta **13/14** (RED), versão final **14/14** PASS.
- P0 Node original: **202/202** PASS (0 fail, 0 skip).
- Browser Chromium P0 original: **143/143** PASS em uma bateria completa (as sete suítes).
- HTTPS/CP049 Node: **12/12**, Python CookieJar **4/4**, sem mudança de arquivos TLS.
- Stress simples CP050 (última busca limpa sem salto de foco): após versão final, **35/35** PASS. Stress adicional solicitado de 120 repetições foi **INTERROMPIDO** por limite externo após registrar **81/81** PASS; 39 execuções restantes **NÃO** foram feitas e não contam como aprovação.
- Os arquivos `controller.mjs` e `test_focus_race.cp055.py` foram comparados com blobs Git exatos no PR; integração real com CP054 e com ART01 não é afirmada.

**Limites:** o Chromium usa `page.set_content`, fetch sintético com módulos reais, não navegador HTTPS efetivo nem ator autorizado. O bug é de foco local; esta correção não homologa Keycloak/OIDC, Core/MariaDB nativos, WhatsApp, CI runner, arte, runtime ou produção. Não afirmar que o problema é resolvido universalmente com apenas 116 execuções de laboratório.

## Integração e risco de PR

A base é PR#22 CP052. `lab/ux-p0-010/controller.mjs` é o único arquivo funcional modificado. Como CP054 PR#24 também altera esse arquivo para exibir atributos de item, **não usar merge cego** entre os dois: incorporar apenas o bloco `focusTo` source-pinned da CP055 sobre o controller de CP054, reexecutar as 8 suítes Chromium (+CP055), todos os Node P0 e HTTPS. PR#25 CP053-GATE e PR#26 CP053-PREVIEW alteram `package.json` e não devem ser sobrescritos.

Nenhuma alteração nesta entrega para `main`, PR#22, Core original, bot, WhatsApp, banco de jogo, produção ou flags. Todos os gates nativos permanecem OFF.
