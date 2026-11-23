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

## R2 — consulta CP012 transpILADA → projetor CP045 → guard UX

O patch de teste foi ampliado sem tocar o ZIP histórico CP012: acrescentamos F04–F06, que executam `readExistingInventoryForPortal` do candidato TS transformado sob mocks de ORM, e entregam o resultado diretamente a **módulos reais da árvore PR #15** (Git blob `83df9fbf82c4c381a620a4ca4244631f3eab5db8` e `c73829014d159341d7fd7ace6860dd392be6c92e`).

- **F04:** os dois atores sintéticos A/B geram DTOs `ready` aceitos pelo guard, com item próprio distinto; identidade privada não chega à saída.
- **F05:** três regras de vínculo são aplicadas também ao fluxo gerado pelo candidato, com `maxPlantSlots=1` + jardim mostrando vínculo `false`, sem inventar casa.
- **F06:** um candidato sob fixture impossível de quatro espaços é rejeitado no projetor CP045 com `{state:'unavailable'}`.

A suíte expandida ficou em **77/77 PASS (71 originais CP012 + 6 casos F01–F06)**, zero skips, Node22/TS5.8/strict. É um ensaio integrado de **código candidato transpilado** com ORM simulado; não executa DB MariaDB, Sequelize real, transação SQL, autenticação, HTTPS real ou o Core Node24/TS6.

**Pacote privado R2 reproduzível:** [Drive — CP045 CP012 native→P0](https://drive.google.com/file/d/1ximeBG8JQpttXNa7KfmPCJltsHInKPpd/view?usp=drivesdk), ZIP **42.622 bytes**, SHA-256 `d3d4fb975570a441b38f7a08dab08694fc5c5740c9c9160b82ae9436e95f3678`. Contém ZIP original CP012, patch único, os dois arquivos CP045 imutáveis, TAP e README, manifesto **6/6 verificado**. Extração limpa, aplicação do patch e **77/77 reexecutados** com os módulos originais conferidos pelos blobs Git exatos. O R1 de 74 testes fica arquivado para rastrear a evolução; usar o R2 como evidência vigente.

**Não somar 77 aos 171 testes da composição como se fossem 248 testes independentes de banco**: compartilham conceitos, fixtures e projetores, e ambos seguem pré-gate.

## R3 — Perfil CP014 + Inventário CP012, um slice P0 de duas fontes nativas

O R2 de Inventário (77/77) foi estendido à seção **Perfil** sem alterar seu ZIP original CP014 (SHA-256 `f74efef74fb65672a20d7f4d6d12378fd1bbaa4729ce7581e458c58bf0125e43`). Usando uma cópia descartável da suíte `tests/native-profile.test.cjs`, foram acrescentados três testes:
- `CP045-Profile-Native-01`: `PortalProfileQuery` TS transpilada → `normalizeNativeP0Read('profile', ...) ` do CP045 → `isProjectedP0('profile', ...)`; mesma estrutura e valores da projeção histórica CP014.
- `CP045-Profile-Native-02`: dois atores A/B com moedas distintas (2450/777), guard `true`, identidades privadas removidas.
- `CP045-Profile-Native-03`: estados `restricted/not_initialized/unavailable` não transportam payload mesmo se o mock incluir pacote/ID privados.

**CP014: 86/86 PASS** (83 originais + 3), **CP012: 77/77 PASS** (71 originais + 6), Node22/TS5.8, strict. Fonte original dos comandos candidatos TS, dependências simuladas (inclusive ranking SQLite do CP014), sem MariaDB real.

**Pacote único R3** [Drive privado](https://drive.google.com/file/d/1vDDOijQH3Z57QfyIkYBHPLTfaf-mIGD5/view?usp=drivesdk), 109.633 bytes, SHA-256 `0f6544828b9622451b16e77859ef9fe0d2041c65ef3ff1db02a36dfdbb5f50d6`. Possui os dois ZIPs originais, dois patches, TAP 77+86, módulos CP045 por Git blob `83df9f...` e `c73829...`, README e 9/9 hashes SHA. **Reprodução via extração limpa confirmou 77/77 e 86/86, zero skips, e dois hashes Git idênticos.** Preferir R3 no próximo handoff; R1/R2 continuam preservados só para auditoria, sem sumir com evidências.

**Status correto:** essas duas suítes simuladas NÃO homologam Core Node24/TS6, MariaDB, conta SELECT-only, Keycloak/OIDC, HTTPS/browser real nem jogadores. O conjunto 171/171 CP045 já referenciado é outra bateria, com dependências compartilhadas. Não fundir contagens como testes independentes de produção.
