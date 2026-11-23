# CP055 — impedir roubo de foco após troca de categoria (busca CP050)

**Status:** laboratório DRAFT, dependência CP052 PR #22 HEAD `31f9c9e90dcc9e4659163d7c6d6ab3fc04aacceb`. Nenhum merge, deploy, bot, Core, DB, WA ou dado real.

## Defeito capturado
CP053-PREVIEW identificou `test_inventory_search.cp050.py` não determinístico: na busca por ID 70, clique em categoria seguido de `fill('')`, 3/10 repetições mantiveram valor 70 e zero itens. O controlador CP052 usa `requestAnimationFrame` para focar o botão da categoria após o render, mas uma nova interação pode focar a entrada de busca **antes de o frame pendente executar**. O frame antigo toma o foco do campo em edição, interrompendo a sequência de preenchimento.

## Correção estritamente local
Em `lab/ux-p0-010/controller.mjs`, `focusTo` registra versão da intenção e, ao executar o frame, só foca o destino quando **não existe outro elemento conectado e ativamente focado** (exceto o próprio destino). A navegação convencional mantém o foco esperado; uma busca começada mais tarde ganha prioridade. Não altera `inventoryQuery`, filtro, APIs, sessão, escolha de item, UX machine ou catálogo.

## Provas
- Repro isolada controller-like no Chromium real: foco antigo `requestAnimationFrame` versus `fill('')` falhou **9/40**; mesma sequência com guarda de foco passou **40/40** (320–390 px, transporte sem servidor). É prova do mecanismo da corrida, **não** da árvore integral do portal.
- CP050 suite herdada recebe 4 asserções determinísticas novas no teste Chromium já invocado por `npm run test:p0:browser`: interceptar **somente** o frame gerado pelo clique sintético em categoria, restaurar `requestAnimationFrame` nativo, editar o input, liberar frame atrasado, confirmar manutenção do foco/itens; verificar também foco de categoria quando não há interação posterior. As asserções derrubam o foco antigo e preservam o novo.

## Integração
PR #24 CP054 é **irmã de CP055** sobre #22 e também modifica `lab/ux-p0-010/controller.mjs`; resolver conflitos de `controller.mjs` combinando atributos CP054 com `focusTo` CP055. `package.json` é intocado aqui para não colidir com PRs #24/#25/#26. O CP053-GATE PR25 aceita >=20 verificações CP050; após CP055, o marcador deve aumentar para 24.

**Não homologado:** CI GitHub ainda pré-runner, browser HTTPS real Secure/SameSite/HttpOnly não executado, MariaDB CP027 0/12, Core Node24/TS6, Keycloak/OIDC e confirmação WA real OFF. A repetição da suite CP050 **contra checkout real CP055** é requisito antes de merge; o laboratório local acima usa a reprodução mínima.

## QA de árvore funcional recomposta (23/11, aproximadamente 15h BRT)

**Esta seção substitui a limitação antiga “suite integral CP052+CP055 ainda não executada”, exclusivamente para a árvore funcional parcial do laboratório descrita aqui.** Não significa checkout integral do monorepo ou CI aprovado.

- Base oficial CP049-R2, obtida do Drive, ZIP SHA256 `2d912b91094bd324e5480c01eb8b03aadb222dc83a9af08a0f8a243a3d83cced` (736.180 bytes). A base inclui CP048 original e a sua árvore `project/`. Overlay CP049 sobre CP048, depois overlay de **19 fontes exatas da HEAD da PR28**, todas **19/19 hashes Git blob** checadas localmente.
- `node --check lab/ux-p0-010/controller.mjs` e `python -m py_compile ...test_inventory_search.cp050.py` PASS.
- `npm run test:p0`: **202/202 PASS**, zero fail/skip.
- `npm run test:p0:browser`: **147/147 PASS**: 46+10+14+19+24+11+23, zero failure. Executou módulo ESM real, DTO/guard real e browser com fixtures injetadas; NÃO sessão HTTPS nativa em Chromium.
- `npm run test:p0:https`: **12/12 Node + 4/4 Python CookieJar PASS** (OpenSSL autossinado com CA local).
- Prova **RED real no controlador CP052 original**: substituiu apenas a função `focusTo` da árvore de teste por bytes exatos do blob Git `f2a7170484b80d1bf1e0f707b2c2a50ecc227394`. O teste CP050 atualizado apresentou **23/24, exit 1**, isolando `CP055 stale focus cannot steal search after a later fill`. Com a HEAD CP055 blob controlador `5efe5e448c68c9570879e01e7f955fc3c221f759`, a mesma suite obteve **24/24, exit 0**.
- Repetições observadas da suite CP050 corrigida: uma rodada completa verde e múltiplas rodadas focadas verdes; a bateria interrompida pelo limite do executor não é contada como sucesso integral.

### Composição **somente local** com CP054 PR #24

Na mesma base CP052 recomposta, os 5 arquivos modificados da branch CP054 PR24 foram recuperados e auditados por SHA Git **5/5**. Mesclou-se **apenas no scratch**, no `controller.mjs` de CP054, o guard de foco CP055, preservando a suite CP050 modificada e os scripts CP054. Git blob resultante da composição `413ff69aa50b839abf272f064e71239be3a39583` (não publicado como código canônico).

- `npm run test:p0`: **210/210 PASS**, zero fail/skip.
- `npm run test:p0:browser`: **251/251 PASS**, 8 suítes: 46+10+14+19+24+11+23+104. Execução completa terminou **exit 0**; uma tentativa anterior foi interrompida pelo limite da ferramenta, não por falha da suite.
- `npm run test:p0:https`: **12/12 Node + 4/4 Python PASS**.
- O novo teste CP054 específico também passou separadamente **104/104**.

**Dependências para integração:** preservar ambos os patches em `controller.mjs`, não trocar CP055 por CP054 nem vice-versa; manter `test_inventory_search.cp050.py` com 24 verificações. PR24 e PR28 continuam DRAFT separadas. Não executar merge, deploy ou ativação antes dos gates reais e revisão independente.

**Limite permanente:** os ZIPs de laboratório são parciais. `npm run check` global do monorepo (incluindo `web/`, `test:tools` e baseline Core) NÃO foi executado nesta prova; CI Github pré-runner, cookies de navegador HTTPS real, OIDC, MariaDB CP027 (0/12), WA oficial, arte e licença seguem não homologados.
