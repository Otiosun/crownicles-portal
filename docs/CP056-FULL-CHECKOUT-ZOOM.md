# CP056 — checkout integral PR30, inspeção a 200% e QA isolada

**Status:** DRAFT empilhado sobre a PR #30 (base exata `a4a55f37ac9f858afdae9ed58bcd79377b32f527`). Esta PR altera **somente três paths**: `lab/ux-p0-010/preview.html`, `lab/ux-p0-010/test_zoom_overflow.cp056.py` e esta documentação. NÃO modificar `package.json` nem o gate TAP; estes arquivos têm dono em outra frente, PR #32, com trabalho concorrente PR #34.

## 1. Checkout integral comprovado

Sem DNS externo para `git clone`, a API do GitHub foi usada para obter o Git tree recursivo no commit pinado da PR #30: **132 blobs, sem truncamento**. Conteúdo integral transferido com base64, incluindo seis imagens WebP, confrontado com o hash Git de cada arquivo: **132/132**. O ZIP CP049 anterior foi apenas um ponto de partida; todos os bytes finais foram confrontados com a árvore atual. Não chamar esse processo de clone Git normal.

Nessa árvore antes do patch, com Node **22.16.0**:
- `npm run check`: **352/352** (web43 +integration24 +tools75 +P0 210), 0 fail/skip; exit 0.
- `npm run gate:p0:lab`: **210 Node +16 HTTPS (12 Node, 4 Python) +285 Chromium +1 preview TLS sintética =512** verificações heterogêneas, exit 0. A CI GitHub real permanece pré-runner.

## 2. Defeito reproduzido no navegador

No controlador ESM de laboratório exato da PR30, em `Pertences → Inspecionar item`, viewport **320px** com texto **200%** apresentou `document.documentElement.scrollWidth=333`, maior que a largura 320. A causa: texto longo no aviso de inspeção sem quebra suficiente.

Patch único: acrescentar `overflow-wrap:anywhere` à regra CSS `.message` em `preview.html`. Os mesmos campos, dados, filtros, atribuição de foco, autenticação e APIs permanecem intactos; após o patch, `scrollWidth=320` no mesmo cenário.

## 3. Teste RED/GREEN verificável

Novo teste opt-in: `python lab/ux-p0-010/test_zoom_overflow.cp056.py`. O Chromium usa os módulos ESM reais do laboratório com o transporte sintético `test_preview.py`, sem usuário ou navegador HTTPS real.

Cobertura: 320/390/430/768/1440 px, fonte 100%/200%, antes da verificação, perfil, inventário, seleção, detalhe, retorno, quatro categorias e logout; verifica overflow do documento **e dos descendentes** e ausência de detalhes privados depois do logout.

- Original `preview.html` Git blob `3ac5cb71638ff8cc722ad55179b9474dd3dcf688`: **RED 129/130**, exit1, somente `320px/200%/detail` falhou.
- Corrigido Git blob `e7d407acb43d7e140074a4a6f79c692977ddcb3f`: **GREEN 130/130**, exit0, 0 fails/skips; teste novo Git blob `67da039c66f87aa7d2cbbc79fda1e8d10fc3a22f` corresponde aos bytes testados.

Na árvore íntegra com o patch CSS e teste Python, `npm run check` e `npm run gate:p0:lab` permanecem aprovados com os mesmos **352/512** baselines do commit base. O teste CP056 é **executado separadamente**, não se anuncia que o gate já contabiliza os 130 checks.

## 4. Responsabilidade e integração

PR #32 tem precedência sobre o motor TAP e suas regressões; PR #34 é trabalho concorrente na mesma área. Para impedir colisão, **quaisquer commits temporários locais de CP056 no `package.json` e no gate foram revertidos byte a byte ao SHA do commit base**. O diff final da PR35 não deve conter esses arquivos. O integrador/revisor poderá acrescentar a bateria CP056 ao manifesto Chromium após resolver PR32 vs PR34, exigindo marcador `CP056 ZOOM BROWSER: 130 / 130` e verificando o `npm run check` completo e o gate composto. Não reaplicar patches temporários do gate dessa frente.

## 5. Limites

Sem execução de Core Node24/TS6 nativo, MariaDB CP027 (0/12), Keycloak/OIDC, confirmação WhatsApp oficial, cookies de navegador HTTPS com SameSite/HttpOnly verificados, runner CI com steps, licença/pt-BR e ART01 aprovado. Esta é validação de laboratório com controlador real e dados sintéticos, não certificação produtiva. Não tocar main, Core, bot, WA, DB, jogadores ou deploy.
