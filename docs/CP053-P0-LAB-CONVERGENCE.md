# CP053 — Gate único de evidência P0 em laboratório

Status: **DRAFT, sem merge, deploy ou liberação**. Base: CP052 PR #22, commit `31f9c9e90dcc9e4659163d7c6d6ab3fc04aacceb`. Esta branch não modifica identidade, sessão, API, Core, banco, WhatsApp ou interface de produção.

## Problema resolvido

CP052 tem três baterias valiosas, mas independentes: Node P0, HTTPS de laboratório e Chromium com dados sintéticos. A execução manual separada permite reportar um PASS parcial como se fosse conjunto. O CP053 acrescenta um único comando **opt-in** que exige as três evidências e se recusa a aprovar uma bateria ausente, silenciosamente pulada ou incompleta.

## Executar

No checkout desta branch, com Node >=22, npm, OpenSSL, Python3, Playwright e Chromium instalados:

```sh
npm run gate:p0:lab
```

O script sequencia exclusivamente `test:p0`, `test:p0:https` e `test:p0:browser`. Não invoca endpoints externos, testes do banco real, deploy, CI ou comandos de alteração do jogo.

Gates mínimos para aceitar sucesso:

- Node P0: resumo TAP com versão, plano e pelo menos um caso executado, com **>=202** testes, 0 falhas, 0 pulos, 0 cancelamentos, 0 TODO e testes=aprovados.
- HTTPS local: resumo TAP **>=12** testes sem perdas, **4 testes reais Python unittest** com relatório final OK, mais confirmação terminal do runner CP049.
- Chromium: **sete suites obrigatórias** (46, 10, 14, 19, 20, 11, 23), cada uma com sua linha de contagem, sem perdas. Total mínimo **143 verificações**.

Baseline conjunto de referência: **202 Node + 12 HTTPS Node + 4 Python + 143 Chromium = 361 verificações**, com contagens dinâmicas quando novos testes forem adicionados. Uma falha interrompe as etapas posteriores; ausência de dependência é erro, não skip. Timeouts por etapa são limitados. A evidência só é considerada após cada subprocesso terminar com exit 0 e confirmação da contagem exigida.

## QA do próprio verificador

```sh
node --test scripts/tests/p0-lab-convergence.cp053.test.mjs
```

Os 15 testes offline são adversariais: baseline rebaixada, TAP repetido ou ausente, skip/fail/cancel/TODO, Python não executado, marca final HTTPS ausente, componente Chromium omitido/duplicado, falha de processo, encerramento por sinal e ordem das três chamadas. **Esses testes comprovam o verificador, não a execução integral das suites herdadas nesta sessão.** A CI remota continua bloqueada antes do runner.

## Limites obrigatórios

Este gate é deliberadamente **somente laboratório**, não um gate de produção. NÃO atesta MariaDB CP027 (0/12), Keycloak/OIDC, vínculo WhatsApp oficial, Core Node24/TS6, cookies Secure/HttpOnly/SameSite em **navegador HTTPS real**, segurança das credenciais, acessibilidade por leitores de tela ou saúde da GitHub Actions.

O ensaio Chromium existente usa `page.set_content` com ESM e transporte fixture; o teste HTTPS usa Node e Python CookieJar. Não interpolar esses resultados em um único teste E2E real de autenticação.

Próxima decisão: revisão independente CP053 + checkout íntegro CP052, executar `npm run gate:p0:lab` e `npm run check` em ambiente equipado, e só então avaliar gates nativos pendentes. PR empilhado sobre #22 para não conflitar com outros trabalhadores.

## Atenção à composição paralela (23/11)

A PR #24 (CP054, novos fatos nativos de itens) e a PR #26 (CP053-PREVIEW, HTTPS opt-in) também partem da **PR #22**, não desta branch. **As três alteram `package.json`**, embora suas alterações de código de domínio/scripts sejam distintas. Antes de qualquer integração, reconciliar manualmente os scripts de `package.json` mantendo as três entradas, sem apagar a dos outros chats.

A CP054 relata +8 testes Node e +104 verificações Chromium; este gate só exige os **sete marcadores históricos CP047–052**. Se a equipe integrar CP054, adicionar o oitavo marcador CP054 e sua baseline (104) ao manifesto do gate, além de preservar as verificações anteriores. **Sem essa atualização, CP053-GATE não atesta completude da suíte CP054, mesmo com exit zero**. Manter as PRs em DRAFT até isso ser testado na composição resultante. Isto não invalida a avaliação isolada sobre a base CP052.

## Revisão do gate para CP054 (23/11, 15h BRT)

Agora o verificador CP053 identifica o oitavo script `test_item_inspection.cp054.py` no comando de navegador impresso por `npm run test:p0:browser` e exige também exatamente um marcador `CP054 BROWSER aprovados / total`, com pelo menos **104** verificações, todas aprovadas. Se o script existe mas a saída CP054 não existe, o gate falha. Se o marcador aparece mesmo sem o eco do comando, ele também entra na contagem. A cadeia CP052 anterior de sete baterias mantém o contrato de no mínimo 143 verificações.

Foram adicionados 2 testes adversariais ao verificador: omissão do relatório da oitava bateria, contagem parcial 103/104, sucesso 104/104 com e sem eco do comando. `node --test scripts/tests/p0-lab-convergence.cp053.test.mjs` na versão exata da branch: **17/17 PASS**, Node22.16, 0 falhas/pulos. Código e testes publicados confrontados por Git blob com os executados. Este ajuste não mescla CP054 nem muda `package.json` da PR25. Para compor PR24+PR25+PR26+PR28, harmonizar os scripts manualmente; a nova lógica só contabiliza a CP054 quando de fato integrada e detectada.
