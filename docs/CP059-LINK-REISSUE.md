# CP059 — Reemitir código somente após revogação confirmada (laboratório)

**Estado:** QA independente e patch candidato OPT-IN sobre PR33 `234e710b858b8f36b3328964950f48dc59c33f6a`, apoiada em PR30. Não foi integrado, mesclado, implantado nem homologado. Nenhum usuário, conta WhatsApp ou banco de produção foi acessado.

## Defeito comprovado

Em `createSessionHandler`, o endpoint `POST /v1/link/start` executava `ledger.issueChallenge(scope)`, depois `ledger.cancelChallenge(link)` **ignorando o resultado** e, por fim, respondia **201 issued**. O comportamento normal, com challenge anterior cancelável, era correto; contudo, um challenge `consumed` legado sem vínculo `challenge_sessions` (migração aditiva do CP056-SEC/PR33) gera `cancelChallenge(...).status='unavailable'`. A sessão anterior permanece ativa e a resposta 201 de substituição é uma **falsa confirmação**. O mesmo risco ocorre com cookie de challenge desconhecido ou resposta não confirmada de cancelamento.

Isso **não** representa aquisição de conta nem falha da confirmação privada; a reprodução inicia com identidade aprovada sintética. O risco é a integridade da transição e a mensagem do fluxo de vinculação.

## Patch candidato, não mesclado

`patches/cp059-reissue-fail-closed.patch` contém um único hunk, aplicado exclusivamente a `lab/cp014/session-gateway.mjs`. Foi produzido sobre o blob PR33 `a29e4ef3838586ff3ad022a3e2c6a3872ae23b0e` e gera o blob candidato `06bc0d45fba4c458e92ec38f499246e37d9c180a`.

O handler preserva a ordem **verificar emissão/quota → cancelar desafio anterior**. Quando há limite 429, o desafio antigo permanece utilizável. Se o cancelamento anterior não puder ser confirmado, a emissão nova é revogada por compensação, o cookie de vínculo antigo é limpo e o retorno passa a **409 unavailable**, nunca 201. Quando o cancelamento lança exceção, tenta-se a mesma compensação e o handler retorna 503 sem entregar o novo código; se a compensação falha, também não há resposta 201/cookie novo. Revogação bem-sucedida conserva 201 e cookie seguro; nenhuma sessão independente é revogada.

**Limite arquitetural importante:** esta é compensação entre duas transações síncronas SQLite, **não** substituição atomicamente transacional no ledger. A tentativa falha consome uma operação de rate limit e deixa um challenge novo marcado como `revoked` até poda; não deixa código novo ativo nem o revela. Um revisor deve avaliar uma futura operação transacional única no ledger antes de promoção. Nunca chamar essa variante de *exactly-once*.

## Testes e proveniência

Fontes de laboratório CP049 R3 com baseline CP048 reconstituídas por manifesto. A árvore de execução é uma reconstrução **parcial** dos módulos envolvidos, não um checkout integral do HEAD PR33 ou PR30. Foram sobrepostos os três blobs Git reais da PR33: `identity.mjs` `940d7ebeab264b2d9d7907925987f45e02017569`, `session-gateway.mjs` `a29e4ef3838586ff3ad022a3e2c6a3872ae23b0e` e teste CP056 `cb4aea70a2da92ab3042198e27ed707e15a63ad1`. Hash `blob <len>\\0<bytes>` de cada fonte conferido.

- Suíte exploratória expandida 14 testes: código PR33 original **6 PASS / 8 FAIL** (RED esperado); patch local **14/14 PASS**.
- Suíte de 13 testes publicada em `scripts/qa/cp059-reissue-guard.test.mjs` (blob `6d15d04bfb7e86aa53d3b4d90acc9e161b053cdd`) e patch **byte-idênticos ao GitHub**, em reconstrução limpa: fonte original **6 PASS / 7 FAIL** (RED), candidata **13/13 PASS**. Inclui um cenário SQLite persistido, fechado e reaberto com linha consumida legada sem associação.
- Regressão PR33 `scripts/tests/cp056-link-cancel-race.test.mjs` **11/11 PASS** com candidata, total **24/24 PASS**, exit 0.
- Teste cliente CP048 `scripts/qa/cp059-client-reissue.test.mjs`: **4/4 PASS**, total combinado **28/28 PASS** sem falsear confirmação após HTTP 409; erro permite nova tentativa após cookie antigo ser limpo.
- Cinco mutações locais (ignorar status, omitir limpeza, ignorar quota, não limpar cookie, não revogar antigo) resultaram todas em **exit ≠ 0**, com falha adversarial detectada. Testes Node v22.16.0, SQLite real e HTTP em 127.0.0.1, dados fictícios.
- O comando `npm run check` **não está certificado nesta árvore parcial**: o baseline R3 isolado não inclui `web/app.js` do HEAD completo; uma tentativa retornou MODULE_NOT_FOUND. Portanto não alegar CI/check global verde.

## Execução manual no HEAD exato da PR33

```sh
# Apenas laboratório local, checkout PR33, nada de produção:
node --test scripts/qa/cp059-reissue-guard.test.mjs
# RED esperado sem patch; não usar esse resultado para liberar merge.
git apply --check patches/cp059-reissue-fail-closed.patch
git apply patches/cp059-reissue-fail-closed.patch
node --test scripts/tests/cp056-link-cancel-race.test.mjs \
  scripts/qa/cp059-reissue-guard.test.mjs \
  scripts/qa/cp059-client-reissue.test.mjs
```

Os testes estão propositalmente em `scripts/qa/` (opt-in), **fora do glob automático `scripts/tests/*.test.mjs`**; não deixar um gate vermelho por design enquanto a candidata não foi aplicada.

## Coordenação e decisões pendentes

CP057 é a frente exclusiva de composição PR30 + PR32 + PR33 + PR35. Este trabalho **não altera** nenhum arquivo já possuído por aquela frente nem modifica a PR33 original: adiciona somente QA, patch e documentação numa branch DRAFT filha de PR33. Revisor de CP057 deve decidir posteriormente se aplica o patch ou redesenha uma operação atômica única em `IdentityLedger`, reconcilia as novas rotas e executa suite completa em checkout integral. CP058 TLS/browser e CP058 checkout público também têm proprietários separados.

**Gates ainda OFF:** GitHub Actions (faturamento/limite do proprietário bloqueia jobs pré-runner), navegador TLS do portal com sessão real, Core Node24/TS6, MariaDB GAME/LOGS, Keycloak/OIDC, WhatsApp e artes canônicas. Nenhum deploy, alteração de `main` ou decisão de produção nesta PR.
