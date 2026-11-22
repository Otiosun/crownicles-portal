# CP043 — convergência do guard de Perfil/Inventário com a projeção CP042

**22/11/2026 · laboratório isolado · sem merge/deploy/API/banco real.**

## Defeito e escopo

A proteção `isProjectedP0('inventory', data)` da ponte UX [PR #10](https://github.com/Otiosun/crownicles-portal/pull/10) recebia DTOs projetados, mas (a) aceitava reserva com `slot >= category.capacity` e (b) rejeitava talismãs `kind:'reported'` contendo apenas uma das três flags booleanas que o pacote nativo declara individualmente opcionais.

A [projeção CP042 PR #11](https://github.com/Otiosun/crownicles-portal/pull/11) preserva cada campo presente sem fabricar as flags ausentes e exige reserva `0 < slot < capacity`. A origem autoritativa pinada é o [Core/Lib](https://github.com/Crownicles/Crownicles/tree/64d08c05f11949029317341735f6f73024f19f9b):
- `Core/src/core/database/game/models/InventorySlot.ts`, Git blob `fda5fca65f061b9b81097ea7bc96b76e8796b8ec`: `isEquipped()` se `slot===0`.
- `Core/src/core/database/game/models/InventoryInfo.ts`, Git blob `f21e98ad5bc246fbd4773e7d09f4c7e32edee420`: capacidade por categoria (total, incluindo o equipado).
- `Lib/src/packets/commands/CommandInventoryPacket.ts`, Git blob `5b1f291a8e9804522ca46703537dd097f51ed781`: `hasTalisman?`, `hasCloneTalisman?` e `hasRemoteHarvestTalisman?` são três opcionais independentes.

## Comportamento implementado

- Cada reserva exige `slot > 0 && slot < category.capacity` (e unicidade por slot); duas reservas podem portar o **mesmo ID de item** se seus slots forem distintos e permitidos. Item ativo ID `0` permanece válido.
- `talismans.kind='not_reported'` só admite `kind`. `kind='reported'` exige ao menos **uma** flag presente, restringe nomes às três flags canônicas, e verifica booleano em cada flag presente. Ausência não vira `false`.
- Não são criadas contas, itens, campos, nomes públicos, endpoints, URLs nem regras de jogo. Este guard é defesa secundária de DTO **no cliente** e não substitui autorização SQL/OIDC no servidor.

**Atenção à diferença histórica:** os projetores CP012/014 antigos reprovavam flags parcialmente preenchidas (fail-closed), apesar de o pacote tipado torná-las opcionais. CP043 escolhe alinhar o guard ao contrato de saída **da candidata CP042**, preservando integralmente a aceitação dos DTOs históricos completos. Não afirmar que isto já é uma alteração aprovada para o servidor real.

## Prova red → green (Node 22 local)

1. O `projection-guard.mjs` foi reconstruído **byte a byte**, hash Git original `a4aaa9d58796593c58df4c8512c7ff1f1869cbd1`, conferido contra PR #10.
2. Um teste diferencial externo importando o projetor CP042 **real** reproduziu 7 falhas em 12 cenários: rejeição de flags parciais e aceitação de posições inválidas. Resultado original: **5/12**.
3. Com as duas correções aplicadas, os mesmos 12 passaram (**12/12**). Hash Git local/branch corrigida `48ad5cb3a640ba2269ebadb464f6305488d28553`.
4. A suíte histórica do PR #10 tinha **53 casos** e, após correção de comportamento, 2 fixtures precisaram de atualização: `Guard-03` passou a declarar capacidade 3 para permitir slot 2; a expectativa de rejeição de talismã parcialmente reportado passou a exigir rejeição do estado `reported` sem nenhuma flag.
5. Foram adicionados **8 testes CP043** à suíte histórica, inclusive **1.200 combinações determinísticas slot/capacidade** e **600 combinações de flags opcionais**, totalizando **61/61 testes do guard** aprovados localmente. A comparação externa com a fonte CP042 executada na mesma bateria soma **79/79** (61 guard + 12 contrato cruzado + 6 plantas), sem contar aqueles 12 como testes versionados neste PR.
6. O arquivo original de testes foi conferido pelo blob `31265019210140208352e872af9a512d93739b4a`, e a versão corrigida pelo blob `7909e349fed80cb4176d395663eee4c6e731b476`.

Reprodução da suíte **versionada**: `node --test integration/p0/projection-guard.test.mjs` na branch deste PR. O laboratório externo de 12 casos importa o CP042 do PR #11, por isso não está incluído em uma execução isolada da branch PR #10. A evidencia offline pode ser executada quando ambas as fontes estiverem disponíveis.

## Integração ampliada e testes padrão

O `package.json` desta branch agora inclui o script `test:p0` e o acrescenta ao `npm test`, consequentemente ao `npm run check` existente (o workflow `.github/workflows/quality.yml` chama `npm run check`). Isso fecha uma lacuna anterior: a ponte de UX e seus testes não eram descobertos pelo test runner principal. O comando `npm run test:p0` executou **89/89 PASS** localmente (61 do guard e 28 da ponte). O CI GitHub Actions ainda falha antes do runner; nenhuma execução remota foi homologada.

Além do limite de reserva, o guard passou a exigir `plants.plantSlots[].slot < plants.maxPlantSlots`, conforme o modelo fixado `PlayerPlantSlot.initializeSlots` (Git blob `d9c54405d0aa5d69113be9b06204e787b1894c18`, slots de plantas **0..count-1**). A semente ocupa outro `slotType` e permanece possível mesmo com capacidade de plantas zero. **Três testes novos** cobrem limite exato, posição 9000 e semente com capacidade zero. A candidata CP042 do PR #11 também foi corrigida, com **28/28 testes** próprios.

O conjunto local composto das suítes PR #10/12 (89), PR #11 (28) e dos diferenciais cruzados externos (12+6) foi executado conjuntamente e resultou **135/135 PASS**, sem sobreposição de nomes de casos. Isso é QA local de módulos/fixtures, não teste nativo de MariaDB, Core, Keycloak ou navegador real.

## Prova vertical CP014 → HTTP loopback → ponte UX

Além das 135 verificações locais de DTO/guard/ponte/CP042, foram executadas **14 novas provas de interoperabilidade**, usando os arquivos **originais** `gateway/{session-gateway,projection,fixture}.mjs` do ZIP CP014 (verificação SHA-256). Sete testes passam diretamente por `authorizedRead`: Perfil/Inventário prontos, A/B sintéticos, sessão revogada durante consulta, troca de epoch, dados legados inválidos retidos e campos ausentes preservados. Sete testes adicionais sobem HTTP loopback no endereço `127.0.0.1` e verificam 24 requisições concorrentes A/B, cookies repetidos, Authorization impróprio, logout seguido de 401, GET com `content-length` impróprio e método desconhecido. **14/14 PASS**, bateria agregada **149/149 PASS** após extração limpa.

**Importante:** o servidor CP014 é HTTP local e injeta um ledger e repositório sintéticos. Não possui Keycloak real, MariaDB, TLS público ou sessões de jogadores. A execução end-to-end do navegador real permanece pendente. A suíte versionada deste PR continua **89/89** via `npm run test:p0`.

O [pacote E2E no Drive privado](https://drive.google.com/file/d/1iBsWUgyS2YTx16K6lotl1a0hAbWYt38O/view) contém 27 arquivos com SHA-256 conferido (ZIP 61.875 bytes; SHA-256 `d350e18de0146c695433194f6c0dda2fe17f10bd159efeba5fe88c8309e8f506`), provas red/green, comandos e fontes CP014 sem mutação, sem credenciais reais.

## Sensibilidade dos testes por mutação isolada

Foram montados **três mutantes temporários** do guard original corrigido, todos fora da branch e descartados após teste:

| Regressão intencional | Testes versionados CP043 que reprovam |
|---|---|
| Remover `r.slot < c.capacity` | 2 testes |
| Permitir `reported` sem nenhuma flag | 3 testes |
| Remover `s.slot < maxPlantSlots` | 2 testes |

Os mutantes não foram enviados ao GitHub. Sem inferir cobertura completa de ataque ou prova formal de segurança.

## Dependências e decisão de integração

Este PR é criado **sobre a branch do PR #10**, sem modificar a branch do outro trabalhador. Não pode ser mesclado automaticamente em `main`. Ao incorporar CP042 posteriormente, exigir teste diferencial servidor→DTO→guard→máquina UX com autenticação de sessão e versionamento do contrato. A prova de compatibilidade **não** é API pronta nem prova de segurança de dados reais.

**Gates pendentes:** CP027 MariaDB real 0/12; GitHub Actions com job sem etapas/log disponível; Keycloak/OIDC real; Core Node24/pnpm10/TS6 e Sequelize patch pinado; testes UX e autenticação com jogadores. Nenhum deles é liberado por estes testes de Node22.
