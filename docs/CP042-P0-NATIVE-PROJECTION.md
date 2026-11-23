> CP045 COMPOSIÇÃO: as afirmações históricas deste documento sobre maxPlantSlots=0 foram substituídas pelo contrato pinado PlantConstants.DEFAULT_PLANT_SLOTS=1/MAX_PLANT_SLOTS=3, PlantId 1..10 e testes de integração em docs/CP045-CONVERGENCE.md. Não usar este texto isoladamente como gate de produção.

# CP042 — Projeção P0 de Perfil e Inventário (laboratório, sem endpoint)

**22/11/2026. Escopo: somente a forma dos dados de saída.** Este pacote não verifica sessão, não consulta tabelas, não executa o Core, não publica HTTPS e não implementa a homepage. Seu uso na UI depende do contrato UX-P0-003/005/006/007 e da futura autenticação real.

## Lacuna resolvida parcialmente

O PR #1 e o CP040 cobrem \`property,chest,garden,pet,pantry\`, mas o primeiro fluxo **Personagem → Pertences → Inspeção → Retorno** exige \`profile\` e \`inventory\`, com fontes **CP014 PortalProfileQuery** e **CP012 PortalInventoryQuery**. **Baú da moradia (\`chest\`) não é inventário do jogador.** CP042 adiciona um projetor puro P0 em \`integration/p0/native-projection.mjs\`, **sem** adicionar essas seções à allowlist CP040, **sem** integrar CP012/014 ao servidor e **sem** mexer no PR visual.

## Propriedades de entrada e saída

- \`normalizeNativeP0Read(section,readResult)\` aceita apenas \`section='profile'|'inventory'\` e estados nativos \`ready/restricted/not_initialized/unavailable\`. \`ready\` requer um \`packet\` no formato da fonte; estados não prontos são retornados sem dados, IDs ou anexos antigos.
- Os 19 campos nativos do perfil são projetados por allowlist explicitamente (com opcionais omitidos, não substituídos por zero). \`rank=-1\` permanece sentinela; \`effect.timeLeft\` conserva milissegundos negativos; o nome público do jogador não é fabricado; \`keycloakId\` é removido.
- Inventário tem quatro categorias \`weapon,armor,potion,object\`, slot equipado 0, reservas com identidade \`{category,slot,id}\`, materiais, plantas e indicadores opcionais dos talismãs. \`id=0\` no item ativo é preservado.
- **Correção nova:** a projeção histórica CP014 aceitava reserva \`slot=9000\` quando o \`capacity=2\`; a projeção CP042 exige \`0 < slot < capacity\`, além de unicidade do slot, categoria coerente e item de reserva não vazio.
- A capacidade vem de \`InventoryInfo.slotLimitForCategory\`/campos \`weaponSlots/armorSlots/potionSlots/objectSlots\`; o modelo fixado \`InventorySlots.isEquipped()\` define o equipado como \`slot===0\` (Crownicles Core 6.2.0.b). Por isso, se a capacidade da categoria é 2, apenas o slot de reserva 1 cabe na projeção.
- Talismãs possuem flags **independentemente opcionais** na fonte. Um campo presente \`hasTalisman\` vira \`expedition\`; \`hasCloneTalisman\` vira \`clone\`; \`hasRemoteHarvestTalisman\` vira \`remoteHarvest\`. Os ausentes permanecem ausentes, não \`false\`. Com todas as flags, a nomenclatura é idêntica à projeção CP014. Plantas não reportadas continuam distintas de plantas reportadas vazias.
- \`Infinity\` de máximo de atributo vira \`{kind:'unbounded'}\`; ausência de máximo vira \`{kind:'unknown'}\`, sem introduzir um limite inexistente.
- Objetos malformados geram \`{state:'unavailable'}\`, sem serializar mensagens de erro e sem expor campos adicionais. Isso **não** prova isolamento por proprietário na origem: o pacote nativo deve ler somente o ator autorizado.

## Testes reproduzíveis

\`\`\`sh
node --test scripts/tests/p0-native*.test.mjs
\`\`\`

**28/28 testes Node 22 aprovados**, incluindo limites de slot e quatro categorias, duplicatas, item ID 0, ausência de plantas, campos sensíveis, flags opcionais, sentinelas do perfil e falha fechada. Comparação de duas fixtures CP014 legadas válidas com o projetor anterior: **paridade 2/2** na primeira execução (antes do ajuste dos talismãs); o ajuste preserva nomes CP014 quando todas as três flags estão presentes e não altera as duas fixtures de paridade.

Os pacotes de origem foram recuperados do Drive:
- **CP012**: ID \`1ksMlpV-p91V4vOtD2u8JCCG_Xymn38go\`; SHA-256 ZIP \`edeff51402b55638818971b4dea75ad894120633d224b9e3c1315958ba11eb1b\`; **71/71 testes** locais de seu próprio laboratório.
- **CP014**: ID \`1dMo8dZVsm9sH-9OH5OMZfSTWr3ZZ4flE\`; SHA-256 ZIP \`f74efef74fb65672a20d7f4d6d12378fd1bbaa4729ce7581e458c58bf0125e43\`; **83/83 testes** locais de seu laboratório.
- `ItemCategory` canônico confirmado em `Lib/src/constants/ItemConstants.ts`, blob `5a86aa9a542373d8bd2a53a6fbc8c0e8821b5cd4`: enum sequencial `WEAPON=0, ARMOR=1, POTION=2, OBJECT=3`; não confundir com um catálogo de nomes/imagens. 
- Fonte canônica fixada: \`Crownicles/Crownicles@64d08c05f11949029317341735f6f73024f19f9b\`; \`InventorySlot.ts\` blob SHA \`fda5fca65f061b9b81097ea7bc96b76e8796b8ec\`, \`InventoryInfo.ts\` blob SHA \`f21e98ad5bc246fbd4773e7d09f4c7e32edee420\`, \`InventoryConstants.ts\` blob SHA \`1e4c6b491bac12ce9cbf240ac02996a65c89e967\`.
- UX field map: https://docs.google.com/document/d/1JlVQZFYtErWtFZ1XSBE_0rvZXRjEkfcM/edit ; UX-P0-003: https://docs.google.com/document/d/1cTLW7lDiALRSF5baqHTTRHZJmmzqNkXS/edit

## QA adversarial adicional

`scripts/tests/p0-native-fuzz.test.mjs` executa **2.000 permutações determinísticas** de slot/capacidade com semente `0xC042BA5E` nas quatro categorias e confirma que apenas `0 < slot < capacity` produz resposta `ready`. Ainda verifica exclusão de campos internos em cada categoria e 120 alternâncias entre dados sintéticos e estado `restricted`, sem retenção de payload anterior. Os três testes são parte dos **28/28** acima, não se somam a eles. A cobertura é sintética; não é fuzzing exaustivo de modelos MariaDB.

## Auditoria cruzada com PR #10 (ponte UX independente)

A [ponte PR #10](https://github.com/Otiosun/crownicles-portal/pull/10) usa `integration/p0/projection-guard.mjs` em outra branch, não importada por este projetor. O contrato **não está automaticamente homologado entre as branches**. Duas incompatibilidades verificadas estaticamente:

1. O guard só aceita `kind:'reported'` para talismãs com **três** booleanos obrigatórios; CP042 preserva a ausência de cada flag independentemente, conforme opcionais do pacote `CommandInventoryPacketRes`. A suíte diferencial do PR #10 rejeita explicitamente parcialidade CP012/014 antiga; é uma **decisão contratual a reconciliar**, não um bug demonstrado no jogo real.
2. O guard valida `positive(r.slot)`, mas não impõe `r.slot<category.capacity`. Seu teste `Guard-03` adiciona reserva no **slot 2** com capacidade **2** e a aprova. Para demonstrar IDs duplicados em slots diferentes, o fixture deve declarar capacidade **3 ou maior**; reservar exatamente em `slot=capacity` deve falhar.

A prova cruzada de **5/5 testes** CP042↔UX-P0-003 usa a máquina ESM e **não** o novo guard do PR #10. Pacote isolado no [Drive do projeto](https://drive.google.com/file/d/1ACQVYpfYj87jPYzESbSp_T5vOfXTzM_f/view), com fontes, fixture, TAP e hashes. A divergência foi registrada na issue #8 e no PR #10, sem editar o trabalho alheio.

## Novo limite canônico: posições de plantas (CP042-PATCH-PLANTS)

O código fixado de `Core/src/core/database/game/models/PlayerPlantSlot.ts` (Git blob `d9c54405d0aa5d69113be9b06204e787b1894c18`) inicializa plantas em slots **0 até `plantSlotCount-1`**; o slot de sementes é outra família (`slotType=SEED,slot=0`). Portanto, cada `plants.plantSlots[].slot` reportado pelo jogador precisa satisfazer `0 <= slot < maxPlantSlots`. A presença de um `seed` não consome capacidade de plantas. O projetor agora rejeita `slot===maxPlantSlots` e `slot=9000` no inventário com `maxPlantSlots=2`, preservando resposta `{state:'unavailable'}` sem nenhum payload; aceita `maxPlantSlots=0` com lista vazia e semente independente.

Foram adicionados **3 testes** à suíte de 25, total **28/28 PASS** com Node22 em laboratório. O [guard do PR #12](https://github.com/Otiosun/crownicles-portal/pull/12) também foi ajustado; um conjunto cruzado real com CP042, guard e ponte UX passou **135/135** testes locais agregados (contagens das suítes versionadas e diferenciais, sem MariaDB/Keycloak). A versão original dos projetores CP012/014 não tinha essa validação de capacidade; a divergência é deliberada, fail-closed, não um erro confirmado em dados de produção.

## Gates ainda não cumpridos

**Não houve execução MariaDB real (CP027 continua 0/12), não houve Keycloak/OIDC real, CI GitHub Actions, typecheck Core Node24/TS6, nem integração de HTTP/UX com jogadores.** O projetor puro deve permanecer separado do CP040 até que a leitura sob transação e identidade do servidor seja provada; o CP041 revalida sessão depois da consulta, mas continua sem implementação OIDC real. Não tratar \`ready\` da fixture como autorização.

**Revisão de produto:** catálogo de itens/tradução/arte e nome público precisam da fonte oficial e aprovação; não inferir do ID nem fabricar mecânicas. Ações Equip/Sell/Drink e mutações ficam fora do P0.
