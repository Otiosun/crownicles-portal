# CP056 — endurecimento do gate TAP do portal (laboratório)

**Estado:** DRAFT, sem merge, deploy, runner CI ou autenticação de produção. Base congelada: CP055 PR #30, HEAD `a4a55f37ac9f858afdae9ed58bcd79377b32f527`. Esta correção modifica somente o verificador `scripts/p0-lab-convergence.cp053.mjs` e sua suíte `scripts/tests/p0-lab-convergence.cp053.test.mjs`.

## Falha causal (RED)

O gate `npm run gate:p0:lab` exigia, para `test:p0`, um TAP v13 com resumo `# tests 210 / # pass 210` e **apenas um** registro `ok N - ...`. Em um `spawnSync` com `exit=0`, ele aceitava falsamente `CP055_STAGE_P0=PASS; CASES=210` sem prova de 210 casos individuais. Também aceitava duplicata de ordinal `ok 1` quando o plano dizia `1..210`. A falha é de **integridade da evidência, não da engine do jogo**.

## Correção (GREEN)

A validação TAP confirma simultaneamente:
- versão e resumo final com `tests = pass`, zero `fail/cancelled/skipped/todo`;
- cada declaração `# Subtest: título` corresponde ao resultado `ok N - título` na mesma indentação, ordem e escopo pai/filho;
- todas as declarações/resultados totalizam `# tests` e cada escopo de indentação tem plano `1..N` com registros 1,2,...,N, sem duplicação nem `not ok`;
- o plano raiz aparece exatamente uma vez; **não exige que o plano raiz seja igual a `# tests`** quando há suites aninhadas.

O suporte a casos aninhados foi validado com saída **real** do `node --test`: `# tests 4` e plano raiz `1..2`; também foi validado `node:test describe()` com `# tests 3`, `# suites 1` e plano raiz `1..2`; alterações adversariais dos números e da ordem de fechamento pai/filho são rejeitadas. Registros inconsistentes falham com erros CP056 explícitos. Filtros de Chromium e subprocessos HTTPS não foram relaxados, e o mecanismo não finge assinatura/autenticidade de logs (um emissor deliberadamente malicioso ainda poderia construir um TAP inteiro falso).

## Prova em cópia isolada

Fonte: pacote CP055 de laboratório SHA256 `a682e90c3c2664e2744f6579f79e606d1ec602264c445e43c692538fef56c8a7`, arquivos principais comparados ao GitHub. Motor CP056 final testado byte-exato local/remote pelo Git blob `bdd5f5b8adc44624a98eca4de479d3a211534ebb`.

- ANTES: `inspectLabEvidence('p0', forgedOneRecord)` retornou `{stage:'p0',count:210}` sem erro.
- DEPOIS: `CP056_TAP_RECORD_COUNT_MISMATCH`; execução `npm run gate:p0:lab` em fixture adversarial encerra com status 1 **antes de HTTPS**.
- Suíte dirigida do verificador com cenário de nesting real: **23/23 PASS**, zero falha/skip.
- `npm run gate:p0:lab` sobre o laboratório CP055 original + patch: **210 Node P0 + 12 Node HTTPS + 4 Python CookieJar + 285 Chromium fixture + 1 preview HTTPS sintética = 512 checagens distribuídas**, 0 fail.
- Não houve alteração no motor P0, atributos, perfil, inventário, JS DOM ou API, nem uso de jogador real.

**QA extra:** Segunda reconstrução limpa do ZIP CP055 com somente dois arquivos CP056 sobrepostos: `node --test` 23/23 PASS e `npm run gate:p0:lab` 210/16/285/1 PASS. Ensaio metamórfico sobre TAP REAL de 210 testes Node: **600/600 mutações** de declarações, resultados, ordinais e `not ok` rejeitadas (0 falsos aceites); a fonte original permaneceu aprovada.

**Limites:** A suíte local de 22 casos é equivalente à suíte remota, mas a versão publicada dos testes deve ser reexecutada em checkout integral GitHub quando disponível. `npm run check` global, GitHub Actions com etapas, browser HTTPS efetivo, Core Node24/TS6, Keycloak, MariaDB CP027 0/12, WhatsApp e arte permanecem NÃO homologados.

## Revisão/coordenação

A Central contém reservas concorrentes CP056-TAP (14:15Z W06, 14:17Z W03) para a mesma função. Para evitar colisão, esta branch **única** tem precedência registrada, e W03 foi orientado a revisar como QA independente. O trabalho CP056-FULL-CHECKOUT reserva outra frente, separada deste patch. Não mesclar o mesmo bug em branches paralelas sem revisão.

Testar:
```sh
node --test scripts/tests/p0-lab-convergence.cp053.test.mjs
npm run gate:p0:lab
```

Gate local aprovado NÃO libera versão para produção nem substitui comprovação de execução no runner do GitHub.

**QA compartilhado:** [ZIP CP056 no Drive privado](https://drive.google.com/file/d/1UJ7LV-VyWG3YXSUawXKkICCO33w1OzK1/view), tamanho 19068 bytes (Drive metadata), SHA256 local `c6ac76980850e52edbf31cfb196410b95d49e1607c120c2db351ba30c89e1dbe`; o hash remoto completo NÃO foi rebaixado. Inclui motor byte-exato, suíte local equivalente, TAP P0 real, logs e manifesto. **PR #34 é uma implementação concorrente do mesmo parser**, e deve ser revisada como alternativa, nunca mesclada simultaneamente com a #32.
