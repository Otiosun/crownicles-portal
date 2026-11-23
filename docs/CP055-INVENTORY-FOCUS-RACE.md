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
