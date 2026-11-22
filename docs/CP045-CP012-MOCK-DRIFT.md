# CP045 — fidelidade da fixture CP012 ao Core nativo

Auditoria em 22/11/2026; **somente laboratório, sem acesso a jogadores ou banco**.

## Problema de prova identificado

No ZIP CP012 original (SHA-256 `edeff51402b55638818971b4dea75ad894120633d224b9e3c1315958ba11eb1b`), `tests/native-inventory.test.cjs` declara `info.plantSlots:7` e uma função simulada `isPlantInventoryLinkedToHome:(count,h)=>Boolean(h?.link&&count>=7)`. Assim, o teste E01 podia aprovar `linkedToHomeStorage=true` num inventário de sete espaços, **fora do limite atual do Core**. O código de produção/candidato `candidate/InventoryFormatting.ts` chama a função nativa, e não o stub de sete slots.

Fonte oficial fixada `Crownicles/Crownicles@64d08c05f11949029317341735f6f73024f19f9b`:
- `Lib/src/constants/PlantConstants.ts` Git blob `5caf1c712ab49ca449f6f4210aed39c147c24ae7`: `DEFAULT_PLANT_SLOTS=1`, `MAX_PLANT_SLOTS=3`; IDs 1–10.
- `Core/src/core/utils/PlantDeliveryUtils.ts` Git blob `cb649c5de3688c248e18680e58bc2c0a442f8ade`: `isPlantInventoryLinkedToHome` exige a capacidade 3 **e** imóvel com jardim e armazenamento positivo.
- `Core/src/core/database/game/models/PlayerPlantSlot.ts` Git blob `d9c54405d0aa5d69113be9b06204e787b1894c18`: slots ocupados 0..N-1; sementes são outro tipo.

## Correção reproduzida sem alterar a fonte histórica

Sobre extração descartável do ZIP original, um patch textual limitado altera a fixture `plantSlots:7→3`, substitui o stub `count>=7` pela exigência fiel (capacidade 3 + `gardenPlots>0` e `gardenPlantStorageCapacity>0`), acrescenta esses campos ao mock `Home.getLevel().features`, e adiciona três testes:

1. **F01**: três espaços + jardim/armazenamento positivo podem vincular.
2. **F02**: um ou dois espaços + jardim não podem vincular.
3. **F03**: três espaços sem casa ou sem jardim não bastam.

A suíte CP012 original tinha **71/71**; a extração descartável corrigida executou **74/74** (71 originais + 3 novos) com Node22/TS5.8, `NODE_OPTIONS=--unhandled-rejections=strict`, sem skip. Não é evidência de Core Node24/TS6, transação MariaDB, propriedade real nem autenticação Keycloak. O original permanece **byte a byte** inalterado e pode ser comparado pelo SHA acima.

### Reproduzir
O artefato privado de auditoria contém `CP012-original.zip`, `CP045-CP012-native-mock-contract.patch`, TAP 74/74 e README:
```sh
mkdir /tmp/cp045-cp012 && cd /tmp/cp045-cp012
unzip /caminho/CP012-original.zip
patch -p1 < /caminho/CP045-CP012-native-mock-contract.patch
CROWNICLES_TYPESCRIPT_MODULE=/caminho/typescript node make-candidate.cjs
CROWNICLES_TYPESCRIPT_MODULE=/caminho/typescript NODE_OPTIONS=--unhandled-rejections=strict node --test tests/native-inventory.test.cjs gateway/projection.test.mjs
```

Este documento evita que o checkpoint CP012 antigo seja citado como **prova do limite de sete slots** ou de autorização real. A projeção/guarda CP045 usa os limites 1..3 e permanece candidata. A auditoria **não** altera Core upstream, bot/WhatsApp, PRs CP012/014 históricos ou MariaDB. CP027 e CI privado continuam bloqueados.
