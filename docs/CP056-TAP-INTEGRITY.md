# CP056 — integridade de evidência TAP no gate P0

**Estado:** correção de laboratório em branch independente, DRAFT, empilhada sobre a candidata integrada CP055/PR#30. Não publica a interface, não substitui o CI e não libera produção.

## Defeito confirmado antes da correção

O `parseTapSummaries` de `scripts/p0-lab-convergence.cp053.mjs` verificava os totais no rodapé e a existência de ao menos uma linha `ok`, mas **não comparava a quantidade real de registros de testes com `# tests`**. Um subprocesso com exit 0 e texto abaixo recebia `CP055_STAGE_P0=PASS; CASES=210`, apesar de apenas um registro:

```text
TAP version 13
ok 1 - sole executed fixture
1..210
# tests 210
# pass 210
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

A lacuna também atingia HTTPS Node, quando os marcadores Python/runner eram fornecidos. Não se trata de ataque à produção observado: é uma falsificação adversarial **do texto de evidência** aceita pelo gate anterior. A ausência de logs de testes na CI GitHub é um bloqueio distinto e continua sem solução.

## Mudança técnica

A CP056 valida agora:

- exatamente um cabeçalho e plano TAP raiz;
- número de registros `ok` reais coerente com `# tests`;
- `ok` de suítes `describe()` descontados corretamente de `# tests` por `# suites`;
- número de registros de nível raiz e identificadores sequenciais iguais ao plano raiz;
- rejeição de `not ok`, `# SKIP`, `# TODO`, registro ausente, duplicado e numeração adulterada;
- retenção do comportamento de falha por exit code/sinal/timeouts e dos quatro estágios existentes.

A validação é **estrutural**; não prova criptograficamente que um executor não adulterou o texto. O `npm` original continua fixado, sem novos comandos, rede ou credenciais.

## Prova RED/GREEN na fonte real

Fonte original PR30, blob `6acd31fb639c86193e6122ba40b4f14d5976c134`, testes originais `e70533cab6cf5c59b8d1882cb59ccf7a62732bef`. A nova suíte adversarial CP056 executada *contra a versão original* terminou **2/8 PASS, 6/8 FAIL (RED esperado)**. Após a correção, executar as 17 verificações ajustadas mais os 9 testes CP056 deu **26/26 PASS, 0 FAIL/SKIP (GREEN)** em Node 22.16.0, incluindo TAP real de subtestes aninhados e `describe()` com contagem separada de suítes.

Hashes Git blob finais:
- `scripts/p0-lab-convergence.cp053.mjs`: `db8322a23291185413553cfcb58985075fb87fae`
- `scripts/tests/p0-lab-convergence.cp053.test.mjs`: `3adfb26dcc7b75bdc0ad868825493c18f9e14a28`
- `scripts/tests/p0-tap-ledger.cp056.test.mjs`: `6960fb9fd801935fab81eb38f6e92650a28f2cab`

Reconstituição local de CP048/CP049 R3 e **26/26 blobs** do HEAD PR30 conferidos por SHA-1 de objeto Git: `npm run test:p0` **210/210 PASS**. Na árvore de laboratório com a CP056 aplicada, o comando `npm run gate:p0:lab` emitiu os quatro marcadores `P0=210`, `HTTPS=16`, `BROWSER=285`, `PREVIEW=1` e o marcador terminal `CP055_LOCAL_P0_GATE=PASS`. A ferramenta de execução externa interrompeu a captura do processo depois dessas linhas: **não há status de saída final verificado nesse replay**, e não deve ser apresentado como CI/checkout completo.

**Rechecagem independente por estágio (24/11):** os quatro comandos da árvore P0 reconstruída encerraram individualmente com status **0**: `npm run test:p0` 210/210, `npm run test:p0:https` Node12/12 + Python4/4, `npm run test:p0:browser` 285/285 e `npm run test:p0:preview` 1/1. `npm run test:tools` terminou **62/62**, exit 0, incluindo a CP056. A execução agregada do gate imprimiu os marcadores de sucesso mas teve captura final interrompida em uma repetição; portanto é evidência complementar dos estágios, não prova de exit0 da invocação agregadora nem execução de CI GitHub.

## Reprodução

```sh
node --test scripts/tests/p0-lab-convergence.cp053.test.mjs scripts/tests/p0-tap-ledger.cp056.test.mjs
npm run test:p0
npm run gate:p0:lab
```

A nova suíte está sob `scripts/tests/*.test.mjs` e é descoberta automaticamente pelo `npm run test:tools` existente, sem editar `package.json`. A PR altera só o parser, testes e este documento.

## Pendências para promoção

Revisão independente do diff em árvore Git completa e `npm run check`, CI GitHub com runner/etapas e logs reais, browser HTTPS navegável com cookies reais e os gates nativos Core/Node24/MariaDB/WhatsApp/Keycloak. O workflow atual segue falhando **antes do runner** (`steps:null`); não interpretar essa falha como reprovação do parser. Não mesclar ou fazer deploy até autorização e evidências correspondentes. Direção artística da etapa 05 permanece separada e não aprovada.
