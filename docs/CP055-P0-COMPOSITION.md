# CP055 — Convergência P0 do portal (somente laboratório)

**Status em 23/11/2026:** PR #30 DRAFT, **não mesclar/deploy**. Integração técnica de PR24 CP054 + PR25 CP053-GATE + PR26 CP053-PREVIEW + **única correção de foco proveniente de PR29 (W03)**. O módulo de UI mantém os atributos CP054; o catálogo/busca CP050–052 permanecem. Nada aqui muda Core, WA, DB, `main`, autenticação real ou direcionamento visual.

## Grafo e proveniência

1. Base: `feature/cp054-native-item-inspection-20261123` PR24 HEAD `13eaf641a362ad24748df048c9fa097d5729a4fd` (já inclui CP052 PR22 e predecessoras).
2. Arquivos de PR25 CP053-GATE: `scripts/p0-lab-convergence.cp053.mjs`, `scripts/tests/p0-lab-convergence.cp053.test.mjs` e `docs/CP053-P0-LAB-CONVERGENCE.md`; os três blobs copiados eram bit-identical aos originais PR25. Gate/teste mudados **apenas após** cópia para reconhecer a composição.
3. Arquivos de PR26 CP053-PREVIEW: launcher, teste e doc, todos com blobs Git idênticos aos originais PR26. Fixture `https-cookie-fixture.cp049.mjs` substituída pelo **mesmo blob** PR26 `bf5e3cae9c817ab47dc3457a6f4d99eafb1d24fb`; exige explicitamente `CROWNICLES_P0_LAB_STATIC=1`.
4. **Foco W03 PR29**: a única correção funcional integrada é o bloco `focusGeneration` + captura de `document.activeElement` de PR29, controller origem blob `aef0069c23376ce1b81a9d826772f63e23bd8222`. No controller combinado CP054 o blob resultante é `f00a3587ae708caff92d54da11df6c86a0743289`. Não fundir PR29 novamente na mesma árvore sem checar o diff; manter a autoria/proveniência W03.
5. `package.json` contém os scripts de CP054/CP053-GATE/CP053-PREVIEW e **duas** regressões de foco CP055 (W03 + integração), sem sobrescrever nenhuma.

## Defeito e teste causal

Versão anterior programava `requestAnimationFrame(focus)` que podia ocorrer **depois** que uma digitação começou; assim, a busca por ID/nome perdia foco, com falha intermitente em `fill('')`. Prova de laboratório antes da integração: 60 ciclos de navegação falharam 4 vezes; teste determinístico por interleaving de callback antigo deu 21/24, enquanto foco corrigido deu 24/24 em 320/390/1440. A correção guardada de **W03** também demonstrou 14/14 nos testes W03 e 24/24 nos testes do integrador, preservando foco de categoria quando não disputado. Não há novo endpoint nem consulta ao servidor ao filtrar.

## Gate composto, realizado numa cópia isolada

`npm run gate:p0:lab` coordena **quatro processos que são obrigatórios**:
- Node P0 **210/210** (0 fail/skip);
- HTTPS Node **12/12** e Python CookieJar **4/4**;
- Chromium sintético **285/285** em **10 suites**: 46+10+14+19+20+11+23+104+24+14;
- prévia HTTPS loopback sintética Node **1/1**, servindo assets públicos e recusando módulos privados, com desafio fictício e logout.

**Total somado: 512 verificações distribuídas por 4 baterias (não 512 testes homogêneos).** Fonte da árvore de laboratório inicial: rebuild CP049 R3 e overlay CP054 com blobs conferidos contra PR24; fixture, launcher, gate e outros scripts principais conferidos byte-a-byte pelos hashes Git. Bateria local adversarial de validador equivalente **16/16** PASS; **suite alterada da PR25 publicada na branch contém 17 casos e ainda precisa ser executada no checkout integral exato**. Gate local já executado PASS sobre o código funcional, incluindo W03.

NÃO HOMOLOGADO: `npm run check` e `npm test` globais em um **checkout integral do repositório** (a cópia local contém apenas o laboratório), testes CI remotos (runners pre-steps), browser real HTTPS com cookies efetivos (execução bloqueada por política do executor), Core Node24/TS6, CP027 0/12 MariaDB real, Keycloak/OIDC, WA privado oficial, revisão de arte/pt-BR/AGPL. Todas as condições nativas permanecem OFF.

## Revisão e integração posterior

- Checar mudanças HEAD e base das PRs #24/#25/#26/#29 antes de qualquer promoção.
- **Não mesclar branches irmãs cegamente**: o CP055 já reconcilia `package.json` e incorpora o bloco de foco PR29. Um segundo merge separado pode duplicar/sobrescrever o mesmo comportamento.
- Em checkout integral e ambiente autorizado, rodar: `npm run check`, `npm run gate:p0:lab`, `node --test scripts/tests/p0-lab-convergence.cp053.test.mjs`; exigir 0 falhas/skips, logs reais, e auditoria de segurança.
- `gate:p0:lab` continua **somente laboratório**; não habilita deploy nem conta real.
