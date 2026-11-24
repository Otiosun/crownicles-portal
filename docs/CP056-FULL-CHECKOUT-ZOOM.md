# CP056 — checkout integral PR30, acessibilidade 200% e gate de regressão

**Status:** DRAFT empilhado sobre a PR #30 (HEAD base fixo `a4a55f37ac9f858afdae9ed58bcd79377b32f527`). Não é aprovação de interface, autenticação nem release.

## 1. Prova de checkout integral

Não foi possível usar `git clone` (resolução de `github.com` indisponível neste executor). Foi obtida a árvore Git via API, recursivamente, no commit exato da PR #30: **132 blobs, sem truncamento**. Todos os 132 conteúdos foram obtidos da API do GitHub; arquivos WebP também foram transferidos como bytes originais, e a comparação `SHA-1("blob "+length+"\\0"+bytes)` coincidiu com o manifesto da árvore **132/132**. O ZIP CP049 original foi usado apenas como ponto de partida; todos os arquivos foram sobrepostos e conferidos por blob, sem assumir que fontes parciais fossem o checkout completo.

Na árvore intacta da PR #30, com Node **22.16.0**, `npm run check` terminou em **exit 0**: `test:web` 43/43; `test:integration` 24/24; `test:tools` 75/75; `test:p0` 210/210 (**352** testes, 0 falhas, 0 skips). `npm run gate:p0:lab` terminou **exit 0**: Node 210; HTTPS 12 Node +4 Python; Chromium 285; preview HTTPS de laboratório 1 (**512** contagens de verificações heterogêneas). É execução contra checkout funcional integral; não CI remoto.

## 2. Defeito de responsividade demonstrado

No controlador P0 de laboratório real e seu HTML `lab/ux-p0-010/preview.html`, a tela `Pertences → Inspecionar item` ultrapassava o viewport de **320 px** com fonte ampliada a **200%**: `scrollWidth=333`, `innerWidth=320`. A causa visual é o texto longo sem pontos de quebra na mensagem informativa, não uma falha do filtro ou da autorização.

Correção mínima: acrescentar somente `overflow-wrap:anywhere` à regra CSS `.message`. Não muda textos, atributos nativos, leitores, sessão, foco, API ou estado. A saída após a alteração voltou a `scrollWidth=320`.

## 3. Regressão causal e suíte adicionada

Novo `python lab/ux-p0-010/test_zoom_overflow.cp056.py` (Playwright/Chromium) usa o controlador ESM **real** da PR #30 com o `test_preview.py` já existente, que fornece transporte de fixture exclusivamente sintético. Exercita 320/390/430/768/1440 px em 100% e 200%, percorrendo acesso não verificado, perfil, inventário, seleção, detalhes, retorno, quatro categorias e logout. Testa overflow do documento **e de descendentes**.

Com HTML **original e hash exato** `3ac5cb71638ff8cc722ad55179b9474dd3dcf688`: **RED 129/130**, exit 1, falha específica `320px/200%/detail`. Restaurado o CSS corrigido: **GREEN 130/130**, exit 0. Os demais 129 cenários permanecem verdes; 5 resoluções e ambas escalas preservadas.

O teste foi conectado ao `test:p0:browser` do `package.json`, e ao gate fail-closed no manifesto `scripts/p0-lab-convergence.cp053.mjs` como `CP056 ZOOM BROWSER:` exigindo **>=130/130**. O verificador rejeita marcador ausente, 129/130 e contagem reduzida 129/129. Suíte do próprio gate: **18/18** Node PASS, sem skip.

## 4. Provas pós-correção

Na árvore **com os deltas da CP056**:
- `npm run check`: **353/353** no total (43 web +24 integration +76 tools +210 P0), zero falhas/skips, exit 0.
- `npm run gate:p0:lab`: **642** contagens agregadas, Node 210 + HTTPS 16 + Chromium **415** (285 originais +130 CP056) + preview sintética 1, exit 0. Não interpretar 642 como testes nativos de produção.
- `git hash-object` dos cinco paths alterados/adicionados confrontado com GitHub antes do PR; nenhuma outra fonte alterada.

## 5. Limites sem exceção

Esta prova não habilita Node24/TS6 do Core real, banco MariaDB CP027 (0/12), Keycloak/OIDC, confirmação WhatsApp oficial, sessões de jogadores, cookies SameSite/HttpOnly em **Chromium navegando HTTPS real**, runner CI do GitHub (jobs anteriores falharam **sem steps**) nem a aprovação artística ART01. Também não resolve AGPL, localização pt-BR ou diretrizes finais de marca. Testes de browser utilizam `page.set_content` e módulos reais com fixture, não uma sessão de jogador.

**Review exigida:** revisar os cinco paths restritos, executar `npm run check`, `npm run gate:p0:lab`, verificar 320 px + 200%, manter esta PR empilhada na PR30 DRAFT sem merger cego nem deploy. Não tocar main, Base40, bot, WA, dados, banco, Core ou CI.
