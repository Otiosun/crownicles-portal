# CP063 — Reemissão de vínculo atômica, resistente a requisições concorrentes

**Estado:** candidata DRAFT exclusivamente de laboratório sobre PR40 (`8210f76b7a6c68d115cd52a8b725308be5a7e167`), que deriva de PR39/PR36. Sem merge, deploy, produção, credenciais ou dados reais.

## Falha reproduzida antes do patch

No gateway CP059 (`lab/cp014/session-gateway.mjs` Git blob `06bc0d45fba4c458e92ec38f499246e37d9c180a`), duas requisições `POST /v1/link/start` que carregam **o mesmo cookie anterior**, podem ambas emitir um novo desafio válido. A primeira execução cancela o desafio antigo; a segunda considera o cancelamento repetido como `cancelled` (idempotência de `cancelChallenge`) e entrega outra resposta `201 issued`. Assim, dois códigos podem permanecer ativos quando só um deveria representar a transição do navegador. A falha também foi reproduzida em dois servidores com duas instâncias `DatabaseSync` usando o **mesmo arquivo SQLite**.

Reprodução determinística: `scripts/tests/cp063-atomic-reissue.test.mjs` retém a conclusão de `rateScopeFor` até as duas solicitações entrarem, libera ambas e exige **um único 201 + um 409**, sem duas linhas de desafio ativas. Original: **9/14 PASS, 5 FAIL** — falham duplicação no mesmo handle, duplicação em dois handles SQLite, reutilização do cookie revogado, replay do consumido e rollback de atualização que deixava challenge órfão.

## Contrato implementado

- Novo método `IdentityLedger.reissueChallenge(rateScope,browserSecret)` executa quota, validação do desafio anterior, emissão nova, revogação de sessão vinculada e revogação do desafio anterior **na mesma transação `BEGIN IMMEDIATE`/COMMIT ou ROLLBACK**.
- Um cookie anteriormente revogado é recusado com `409 unavailable`; não recebe novo código. Isso **não altera** a idempotência da API explícita `cancelChallenge`.
- Um desafio consumido só é substituído se houver uma associação `challenge_sessions` que identifique a sessão exata a revogar. Linhas legadas sem associação retornam `409`; a sessão desconhecida **não é declarada revogada**.
- Em falha de inserção, revogação do desafio ou da sessão, a transação reverte **também a quota e a nova emissão**. O HTTP retorna `503`, sem código ou cookie novo.
- `429` por limite não modifica a vinculação anterior. `POST` com Origin externo continua rejeitado antes da transação.
- Com cookie ausente, `issueChallenge` original permanece inalterado e retorna `201` normalmente.
- O retorno novo não expõe identidade do jogador, referência interna nem token de sessão. Todas as identidades e certificados usados nos ensaios são sintéticos.

## Escopo Git

Base exata PR40, commit `8210f76b7a6c68d115cd52a8b725308be5a7e167`.

1. `lab/cp014/identity.mjs` — **adiciona** método transacional, original blob `940d7ebeab264b2d9d7907925987f45e02017569`, final `265d9daa4740e6406d3fe74c7e80ddbd83fd2c17`.
2. `lab/cp014/session-gateway.mjs` — substitui compensação CP059 pelo método transacional, original `06bc0d45fba4c458e92ec38f499246e37d9c180a`, final `eaaa557a82fd77177f6014b107b0d4edffd8fe2a`.
3. `scripts/tests/cp059-reissue-guard.test.mjs` — **preserva a contagem e os três nomes legados exigidos pelo CP061**, atualizando somente três corpos de fault injection para o contrato transacional, final blob `04de71c873ac017bdae4f252f8a40a5758bf85aa`. Esses nomes históricos contêm a palavra compensação, mas o comentário no teste explicita que a execução agora exercita rollback em uma transação. A alternativa de renomear exigiria alterar o manifesto do gate CP061, reservado à composição CP062; não alterar aqui.
4. `scripts/tests/cp063-atomic-reissue.test.mjs` — **14 novos testes** determinísticos de HTTP e SQLite, incluindo duas conexões reais ao mesmo arquivo, blob `f68e87ae6e773e8b01198ba17dbf1704e7a29ccd`, cobertos por `npm run test:tools` e `npm run check`.
5. Este documento. Não modifica `package.json`, gate TAP/CP061, teste HTTPS/CP060, workflow Actions, frontend/UX, arte, Core, WA ou MariaDB.

## Evidências source-pinned

Árvore CP057 PR36 reconstruída de ZIP de QA imutável do Drive, com **138/138 objetos Git verificados** e adição das fontes Git exatas PR40 para runner/gate e testes CP059. O código CP059 gateway reconstruído foi validado pelo Git blob `06bc0d45...` antes do patch. Código candidato/testes CP063 testados localmente e confrontados com GitHub por blob exato.

- **RED:** 9/14 PASS, 5/14 FAIL esperado, código CP059 anterior.
- **GREEN:** 14/14 PASS, zero skip/fail, implementação CP063.
- **Regressões juntas:** CP056 11 + CP059 14 + CP059 cliente 4 + CP063 14 = **43/43 PASS**, exit 0.
- **`npm run check`:** audit:imports PASS, `test:web` 43/43, `test:integration` 24/24, `test:tools` 129/129, `test:p0` 239/239 = **435 execuções** de quatro suítes, contagens com repetição intencional, 0 fail/skip, **exit 0**. O primeiro `npm run check` deu RED 128/129 em tools porque os nomes do manifesto CP061 foram mudados; preservamos os nomes e a segunda execução concluiu integralmente exit0.
- **Gate agregado:** primeira tentativa do comando `npm run gate:p0:lab` imprimiu `CP055_STAGE_P0=PASS; CASES=239` e `CP055_STAGE_HTTPS=PASS; CASES=16`, mas a execução foi interrompida pelo limite externo antes de concluir Chromium e preview. **NÃO registrar gate agregado como exit0 local sem execução completa controlada.**

### Adendo de QA após publicação da PR

- **GitHub Actions real PR#43:** run [45476676684](https://github.com/Otiosun/crownicles-portal/actions/runs/45476676684), job `web-contracts` `138738614690`, **8/8 etapas SUCCESS**, incluindo `npm install` e `npm run check`. O runner não executou browser P0 nem native Core/WA/DB nesta execução.
- **Estresse CP063:** **40/40 processos independentes** executando 14 testes cada, **560/560 PASS**, 0 falhas/skip, duração total medida 7,6s em Node22.16/SQLite local. É repetição com interleaving controlado, não prova de tráfego produtivo.
- **Mutações causais:** **6/6 detectadas (exit1)** em cópias locais: omitir revogação da sessão, permitir replay de cookie revogado, ignorar rate limit, omitir revogação do desafio anterior, trocar erro de vínculo legado e desligar a transação. Após cada mutação a fonte foi restaurada e Git blob verificado como `265d9daa4740e6406d3fe74c7e80ddbd83fd2c17`.
- **Chromium histórico:** 11 scripts executados separadamente em três lotes, todos com **exit0**: 46+10+14+19+20+11+23+104+24+14+130 = **415/415 verificações**. Comprova integração de controlador real com fixture ESM/DOM, não navegador HTTPS autenticado por cookie real.
- **Prévia HTTPS sintética CP053:** `npm run test:p0:preview` **1/1, exit0**. P0 Node239 e HTTPS16 foram observados como PASS por etapa em gate parcial, mas duas tentativas da invocação agregada foram interrompidas externamente antes de Chromium; **gate CLI agregado=NOT_VERIFIED** nesta sessão. Os lotes Chromium separados não transformam esse resultado em `gate:p0:lab` completo.
- Os testes novos CP063 estão em `test:tools`, mas **não** no manifesto obrigatório de nomes P0 CP061, que exige apenas os 18 CP059. Próximo integrador pode promover explicitamente CP063 ao gate depois da composição PR42+PR43, sem alterar silenciosamente o parser/runner durante este lease.

## Testes manuais

```sh
node --test scripts/tests/cp063-atomic-reissue.test.mjs
node --test scripts/tests/cp056-link-cancel-race.test.mjs scripts/tests/cp059-reissue-guard.test.mjs scripts/tests/cp059-client-reissue.test.mjs scripts/tests/cp063-atomic-reissue.test.mjs
npm run check
npm run gate:p0:lab
```

## Limites e handoff

CP063 protege **uma emissão por cookie antigo** e restaura atomicidade dentro de um ledger SQLite. **Não prova** deduplicação de novas sessões em navegadores com cookies diferentes, disponibilidade em múltiplos processos com chaves HMAC divergentes, interoperabilidade real WA/OIDC/MariaDB, política SameSite cross-site ou todos os comportamentos de navegador TLS. Não confundir teste local/CI do portal com homologação do Core e bot. CP062 está compondo gate CP061 + teste nativo CP060 em PR separada; esta branch é **disjunta no código servidor/ledger**, mas precisa ser reconciliada pelo integrador depois, sem auto-merge de workflows experimentais.

Não publicar, não alterar `main`, não criar contas ou credenciais reais. Continuam pendentes as oito validações nativas e a aprovação artística.
