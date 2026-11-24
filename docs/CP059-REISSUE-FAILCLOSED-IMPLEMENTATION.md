# CP059 — Reemissão de vínculo com confirmação fail-closed (LAB)

**Estado:** correção funcional integrada somente em uma **PR DRAFT**, baseada na composição CP057 [PR #36](https://github.com/Otiosun/crownicles-portal/pull/36), commit pinado `99b6d1faa2427382eb86cf363d12bc1ce9f98b6e`. Não modifica a PR #36, `main`, CI workflows, produção, bots ou contas reais.

## Falha e contrato

O endpoint `POST /v1/link/start` emitia um novo código e ignorava o retorno de `ledger.cancelChallenge(link)`, respondendo `201 issued` mesmo quando a revogação de uma vinculação antiga não tinha sido confirmada. Com uma sessão vinculada a desafio consumido legado sem a tabela associativa `challenge_sessions` (migração CP056-SEC), a sessão velha podia continuar válida enquanto o cliente via o novo código. A falha foi demonstrada em SQLite com arquivo persistido e reaberto, além do caso equivalente em memória. Não há evidência de bypass de confirmação privada ou acesso a contas alheias.

**Contrato após CP059:**
- Sucesso de substituição requer revogação confirmada do desafio anterior. Se confirmado, preserva `201 issued` e cookie seguro de novo desafio.
- Se a revogação anterior retorna `unavailable` ou estado inesperado, o novo desafio emitido é cancelado compensatoriamente, limpa-se o cookie antigo, e a resposta é `409 unavailable`, sem código novo nem falso ACK.
- Se o cancelamento lança exceção, o handler tenta revogar a nova emissão e retorna `503`; se a compensação também não for confirmada, nunca devolve `201`/novo cookie.
- Rate limit `429` é verificado ANTES do cancelamento antigo: se a quota estiver esgotada, o desafio existente permanece utilizável. Origem não confiável continua recusada antes de qualquer mutação.
- Sessões independentes e de outros desafios/atores não são revogadas. A suite adicional confirma que após `409` o cookie antigo foi limpo, nenhuma nova emissão ficou utilizável e a próxima tentativa emite um único desafio seguro. O fluxo CP048 do navegador trata `409` como erro sem exibir código ou afirmar sessão confirmada, permitindo tentar novamente.

## Diferença restrita

1. `lab/cp014/session-gateway.mjs`: alteração mínima do ramo `/v1/link/start`, blob anterior **`a29e4ef3838586ff3ad022a3e2c6a3872ae23b0e`**, novo blob **`06bc0d45fba4c458e92ec38f499246e37d9c180a`**, idêntico ao patch candidatado e testado na PR #37.
2. `scripts/tests/cp059-reissue-guard.test.mjs`: 14 testes reais de HTTP loopback + SQLite, blob **`7ddf0a2ce7a0fc52e6caf91b0846dc00c6d195cf`**.
3. `scripts/tests/cp059-client-reissue.test.mjs`: quatro verificações do **módulo CP048 real**, blob **`9eca18faa1576d24e845dfc4c3ac6e19ecf0895b`**.
4. Este documento.

Os dois novos testes estão em `scripts/tests/` e, assim, passam a ser executados automaticamente por `npm run test:tools` e `npm run check`, diferentemente do pacote opt-in de QA [PR #37](https://github.com/Otiosun/crownicles-portal/pull/37). Não há alteração em `package.json`, no gate TAP CP057, browser Chromium, identidade criptográfica, schema de sessão nem configuração de Actions.

## Prova RED/GREEN source-pinned

Reconstituímos CP049 R3 com CP048 original e sobrepusemos **3/3 fontes exatas da PR33** (identidade, gateway, testes), conferindo Git SHA-1 por blob. Executamos a regressão com patch remoto e testes remotos **byte-idênticos**, confirmados por SHA, na mesma árvore. Node 22.16.0, SQLite real e HTTP local, dados sintéticos:

- Fonte PR33 original: CP059 **6 PASS / 7 FAIL** (RED), inclusive migração persistida com sessão consumida sem vínculo, resposta errada de substituição, status inválido, falha de compensação e cookie.
- Gateway candidato aplicado via `git apply --check` + `git apply`: **14/14 CP059 PASS**.
- Regressão CP056-SEC anterior: **11/11 PASS**.
- CP048 client flow: **4/4 PASS**.
- Total combinado: **29/29 PASS**, `exit 0`. Teste exploratório adicional de 14 cenários e 5 mutações de código também provou RED/GREEN e detectou os mutantes.

**Limites:** o patch envolve uma emissão e uma revogação compensatória em **transações separadas**, não uma operação SQLite atômica única. Falha de substituição pode consumir quota e criar um challenge temporário marcado `revoked`, não um código ativo; esse resíduo some na poda. Para homologação deve ser avaliada uma API de substituição transacional no ledger. Em caso de falha grave de armazenamento, não há prova de *exactly-once*. O QA local source-pinned é parcial; `npm run check` completo na árvore PR36+CP059 depende de execução na CI com steps reais/checkout autorizado e não pode ser inferido da suite de 28 testes. Browser TLS, Keycloak/OIDC, Core Node24/TS6, MariaDB GAME/LOGS, WhatsApp real, LGPD/licença e direção artística permanecem gates separados.

## Reproduzir

```bash
npm run check
node --test scripts/tests/cp059-reissue-guard.test.mjs scripts/tests/cp059-client-reissue.test.mjs
npm run gate:p0:lab
```

Não executar qualquer vinculação real: o teste e o servidor usados são estritamente sintéticos e localizados em loopback. Revisar o diff e as evidências remotas antes de promover a candidata. **Sem merge, deploy, ação em contas, banco ou WhatsApp real.**
