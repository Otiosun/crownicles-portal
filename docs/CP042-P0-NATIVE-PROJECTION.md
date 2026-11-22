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
node --test scripts/tests/p0-native-projection.test.mjs
\`\`\`

**22/22 testes Node 22 aprovados**, incluindo limites de slot e quatro categorias, duplicatas, item ID 0, ausência de plantas, campos sensíveis, flags opcionais, sentinelas do perfil e falha fechada. Comparação de duas fixtures CP014 legadas válidas com o projetor anterior: **paridade 2/2** na primeira execução (antes do ajuste dos talismãs); o ajuste preserva nomes CP014 quando todas as três flags estão presentes e não altera as duas fixtures de paridade.

Os pacotes de origem foram recuperados do Drive:
- **CP012**: ID \`1ksMlpV-p91V4vOtD2u8JCCG_Xymn38go\`; SHA-256 ZIP \`edeff51402b55638818971b4dea75ad894120633d224b9e3c1315958ba11eb1b\`; **71/71 testes** locais de seu próprio laboratório.
- **CP014**: ID \`1dMo8dZVsm9sH-9OH5OMZfSTWr3ZZ4flE\`; SHA-256 ZIP \`f74efef74fb65672a20d7f4d6d12378fd1bbaa4729ce7581e458c58bf0125e43\`; **83/83 testes** locais de seu laboratório.
- Fonte canônica fixada: \`Crownicles/Crownicles@64d08c05f11949029317341735f6f73024f19f9b\`; \`InventorySlot.ts\` blob SHA \`fda5fca65f061b9b81097ea7bc96b76e8796b8ec\`, \`InventoryInfo.ts\` blob SHA \`f21e98ad5bc246fbd4773e7d09f4c7e32edee420\`, \`InventoryConstants.ts\` blob SHA \`1e4c6b491bac12ce9cbf240ac02996a65c89e967\`.
- UX field map: https://docs.google.com/document/d/1JlVQZFYtErWtFZ1XSBE_0rvZXRjEkfcM/edit ; UX-P0-003: https://docs.google.com/document/d/1cTLW7lDiALRSF5baqHTTRHZJmmzqNkXS/edit

## Gates ainda não cumpridos

**Não houve execução MariaDB real (CP027 continua 0/12), não houve Keycloak/OIDC real, CI GitHub Actions, typecheck Core Node24/TS6, nem integração de HTTP/UX com jogadores.** O projetor puro deve permanecer separado do CP040 até que a leitura sob transação e identidade do servidor seja provada; o CP041 revalida sessão depois da consulta, mas continua sem implementação OIDC real. Não tratar \`ready\` da fixture como autorização.

**Revisão de produto:** catálogo de itens/tradução/arte e nome público precisam da fonte oficial e aprovação; não inferir do ID nem fabricar mecânicas. Ações Equip/Sell/Drink e mutações ficam fora do P0.
