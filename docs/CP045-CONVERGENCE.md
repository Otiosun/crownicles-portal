# CP045 — convergência funcional P0 (revisão isolada, sem merge)
Data: 2026-11-22. Escopo: Perfil/Inventário/Plantas → verificação de DTO → máquina UX.

## Linhagem preservada
Base de integração: PR #12 head 06ac2a7f65bbe46c7527652a438acbb7cf5824de, que já contém UX PR #4 e ponte PR #10, sem alterar suas branches.
Adicionados sob pin: projeção nativa PR #13 (blob 9b7882cdef18e779f935de749e7823bda32772b2), suíte CP044-A c88a15..., guarda cliente PR #14 (blob 1deea5c33ede49f31a17c76b0a45ef1ebec6fe0f), suíte CP044-B dc409..., fontes/testes e notas do PR #11.
Todos os quatro PRs originais seguem DRAFT e inalterados; esta branch não é candidato de deploy.

## Falha reproduzida ao compor o código
No pacote da rodada CP043 havia **cinco** expectativas históricas aceitando maxPlantSlots=0. Os dois testes adicionais falharam na execução da composição com código CP044: RED 165/167, com erro ready esperado mas unavailable recebido. Três testes nas fontes versionadas também precisavam ser corrigidos (expectativa; não a implementação). O Core pinado PlantConstants.ts define DEFAULT_PLANT_SLOTS=1, MAX_PLANT_SLOTS=3; PlantId usa 1..10. PlayerPlantSlot.initializeSlots cria índices 0..plantSlotCount-1 e slot de SEED independente.
Em CP045, estas cinco expectativas passam a exigir que maxPlantSlots=0 seja inválido para uma seção 'reported'; a semente continua independente e válida quando maxPlantSlots=1.

## Evidência do laboratório
- Node 22.16.0 sem banco/OIDC: bateria completa offline de contrato/projeção/ponte/UX foi 167/167 PASS, 0 skips (evidência após mudanças).
- `npm run test:p0` exige CP042_REQUIRED=1 e executa 107/107 PASS em checkout composto, incluindo as duas suítes novas CP044.
- CP012/014 originais e segurança da sessão foram testados anteriormente em outras branches; a árvore CP045 **não** integra CP040/CP041 de leitura HTTP nem prova autorização real. Não somar CP041 à contagem desta bateria.
- A árvore retém o PR #12 intacto fora dos paths listados; changeset de projeção e guard só no candidato isolado.
- CI GitHub Actions do Portal reporta falha pré-steps, runner/steps não observados; esta bateria é LOCAL.
- CP027 MariaDB 0/12; Node24/TS6 do Core privado não compilado; Keycloak/OIDC/HTTPs real e testes com jogadores NÃO homologados.

## Próximo corte para o produto
Auditar e aceitar o contrato de seção profile/inventory e as fontes oficiais de nome/catálogo/licença; executar testes em Core e MariaDB isolados com identidade de servidor e conta SELECT-only; executar UX P0 real com browser e jogadores. Não publicar endpoint/mutações nem avançar estilo do site antes dos gates.

## CP045-B — Home/garden link one-way source invariant
The pinned `Core/src/core/utils/PlantDeliveryUtils.ts` Git blob `cb649c5de3688c248e18680e58bc2c0a442f8ade` computes `isPlantInventoryLinkedToHome` using both `PlantConstants.hasHomeStorageLink(plantSlots)` and a home with a garden/positive storage capacity. Therefore `linkedToHomeStorage: true` is **impossible** when `maxPlantSlots<3`, but `maxPlantSlots===3` does **not** imply a link unless the player actually owns a home/garden. Both server projection and client guard now enforce ONLY this one-way invariant; they never fabricate a home or require the link at capacity 3. Four new regression cases: RED 2/4 on CP044 baseline; GREEN 4/4 after patch. Entire isolated local suite GREEN **171/171**, no skips; `npm run test:p0` GREEN **111/111** once the four cases are included.
