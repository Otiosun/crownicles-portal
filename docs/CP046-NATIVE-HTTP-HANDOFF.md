# CP046 — leitura HTTP de Perfil/Inventário com sessão CP014 e projeção CP045

Data: 2026-11-22. Estado: **DRAFT / LABORATÓRIO / NÃO É ROTA DE PRODUÇÃO**.

## Objetivo prático

Fechar o elo de laboratório que faltava entre a autenticação CP013/CP014 e o contrato P0 já convergido no PR #15: ler `GET /v1/me/profile` ou `GET /v1/me/inventory` usando **apenas o ator autenticado no servidor**, projetar com `normalizeNativeP0Read` (CP045) e validar o DTO com `isProjectedP0` antes de emitir o envelope `{state,asOf,data}` consumido pelo `response-bridge.mjs` / máquina UX-P0-008.

## Fluxo permitido e limites

1. HTTP GET sem corpo, query string nem identificadores de outros jogadores. Os únicos paths reconhecidos são `/v1/me/profile` e `/v1/me/inventory`; `chest` é baú da casa, não inventário.
2. **Somente** cookie `__Host-crownicles_session` do protótipo CP014. Rejeitar `Authorization`, `Proxy-Authorization`, duplicação de cabeçalhos/cookies, divergência entre cabeçalho bruto e normalizado, transfer-encoding, corpo, Origin e `Sec-Fetch-Site` diferente de same-origin/none. Cookie exigido com 43 caracteres base64url, nunca exposto na URL ou resposta. Respostas privadas com `no-store` e sem CORS permissivo.
3. O chamador injeta `resolveFreshSession({token,signal,phase})`, que **deve verificar revogação e vínculo na fonte autoritativa em cada chamada**. CP014 `createCP014Resolver` integra `ledger.inspectSession()` e `authority.readBinding()` antes e depois, com `actorId` UUID, `bindingRef` hex64, `bindingEpoch>=1`, prazo válido. Um ator reidentificado, binding/ref/epoch/expiry alterado ou autoridade indisponível causa 401 e nenhum payload.
4. O chamador injeta `readNativeOwn({actorId,section,signal})`, que só recebe o ator comprovado pelo servidor. **Este módulo não implementa a consulta de produção, conexão MariaDB, transação, predicado SQL ou isolamento de logs.** O callback deve implementar leitura do proprietário em transação somente leitura `REPEATABLE READ`, com cancelamento real e sem mutations do jogo. O resultado `{actorId,state,packet}` exige `actorId` de retorno igual ao comprovado; nunca aceita `askedPlayer`/ID do cliente.
5. Projeção CP045 allowlist + guard estrito antes da resposta. Entrada declarada `ready` que falha em projeção recebe 503 sem detalhes. `restricted/not_initialized/unavailable` recebem 200 com `asOf`, sem `data`. `401` significa sessão inválida; a máquina UX apaga todos os dados, inclusive a seção não solicitada.
6. O adaptador exige timeout da verificação (2,5 s) e da leitura (5 s), ambos configuráveis no limite 1..30000 ms; sinal de desconexão/timeout propaga `AbortSignal`, **sem cancelar SQL magicamente** caso o adaptador ignore o sinal. Uma revogação **após a segunda verificação** ainda é uma condição de corrida residual que requer sessão autoritativa/controle de resposta na arquitetura real.
7. `createP0NativeHttpHandler` e `createP0NativeLabServer` servem apenas à prova local; **não possuem TLS, chave/serviço Keycloak, rate limiting, cookies de login ou camada de produção**. O roteador lab combina a rota de login `createSessionHandler` CP014 e o handler CP046 somente nos dois paths P0, sem alterar o código CP014 original. A cookie é emitida com `Secure; HttpOnly; SameSite=Strict` pelo CP014; o teste HTTP em loopback a transporta explicitamente porque não é navegador HTTPS.

## Procedência e integridade

- Base Git privada `Otiosun/crownicles-portal`, PR #15 CP045, head consultado na sessão `9f4af437f54aeeb15190f1fed9197acc5243f7b6`, sem cherry-pick/merge em main.
- `integration/p0/native-projection.mjs` / `projection-guard.mjs` do PR #15 (somente importações, não editados nesta PR).
- `lab/cp014/identity.mjs`, `session-gateway.mjs` e `projection.mjs` são bytes originais preservados do ZIP privado `CP014 — Perfil nativo e preparação de integração.zip` (Drive id `1dMo8dZVsm9sH-9OH5OMZfSTWr3ZZ4flE`) — **somente testes**. `identity.mjs` SHA-256: `00958ae2a32c32c3114b5ac827ea66a7a04473ead48f10a6f19c75decb819439`; Git blob: `7e6234dbcf67af9379f96af9d31d0401e4e56f65`. Não confundir essa cópia com implantação do ledger.

## Evidências

- `integration/p0/secure-native-read.cp046.test.mjs`: 24 casos. Exercita estados HTTP, consentimento implícito do cookie privado, isolamento 30 reads de 2 atores, ID0, UX, cookies duplicados, cabeçalhos brutos inconsistentes, autorização ambígua, cabeçalhos Origin, timeout, abort, sessão trocada durante consulta e invalid ready.
- `integration/p0/secure-native-cp014-ledger.cp046.test.mjs`: 7 casos; **IdentityLedger SQLite original**, desafio/requisição privada, confirmação, cookie, 401 após revogação, isolamento de dois atores, mudança de época e ciclo HTTP original `/v1/link/start` → aprovação fora do browser → `/v1/link/redeem` → `/v1/me/*` CP046 → logout. Sessões sintéticas, `:memory:`, nenhum WhatsApp real.
- Mutantes descartáveis (source no Git intacto) falharam como esperado: desabilitar recheck de sessão falhou 4 testes, desabilitar verificações de dono falhou 1, permitir header Authorization bruto falhou 1.
- `scripts/run-p0-tests.mjs` troca o comando POSIX `CP042_REQUIRED=1 node ...` por `spawnSync` Node com env controlado, **compatível com Windows**, inclui `plant-capacity-regression.cp045.test.mjs` previamente fora do padrão e exige dez suites explicitamente. **158/158 PASS, 0 fail, 0 skipped** local em Node v22.16.0 com SQLite embutido experimental. Não é CI remoto. Testes originais externos CP012/014 continuam opcionais, protegidos por hashes, não são descobertos automaticamente.

## Bloqueios antes de aceitar ou lançar

- CP027 MariaDB **0/12 em ambiente autorizado privado**, Node24/PNPM10/TS6 do Core adaptado sem build, leitura de dono com banco e logs não provada.
- Keycloak/OIDC real, prova de vínculo WhatsApp privado, rate limit, cookies TLS/HTTPS e CSP/CORS no navegador e operação sob multi-processo/worker não homologados.
- GitHub Actions privado falha pré-etapas (runner não iniciou); nenhuma mudança neste PR corrige billing/policy/runner.
- Teste de usabilidade T01–T06 com jogadores, leitores de tela e fontes canônicas de nomes/arte/catálogo pendentes.
- Todo código fica em PR DRAFT separado. **Proibido mesclar/deployar como endpoint público sem autorização e gates reais.**

## CP046-B — transporte de navegador sem tokens no script

O novo `integration/p0/browser-reader.cp046.mjs` transporta Perfil e Inventário pela API Fetch com `credentials:same-origin`, `cache:no-store` e `redirect:error`. Ele usa `startRead`/`finishRead` da ponte CP041 e a máquina UX-P0-008; nunca constrói `Authorization`, `Cookie` ou parâmetro `askedPlayer`, não autoriza outros métodos e não oferece ações de jogo.

O corpo JSON só é consumido quando a resposta tem MIME `application/json`, cabeçalhos coerentes e `ReadableStream`; é lido em chunks limitados a 128KiB com decodificação UTF-8 estrita. Status 401 revoga a sessão/limpa os dois domínios, mesmo se um pedido mais recente já havia resolvido na mesma época. READY atrasado de pedido antigo é descartado; após logout o controlador aborta pedidos locais e a máquina descarta qualquer resposta de época antiga. Erros HTTP, corpo grande, JSON inválido, DTO malformado e erro de stream são indisponíveis, sem copiar detalhes privados.

**10 testes** novos em `browser-reader.cp046.test.mjs`, incluindo concorrência de 401/READY, resposta alterada, limite 128KiB, HTML inesperado, UTF-8 inválido, proteção de cabeçalhos e HTTP loopback. A primeira execução cruzada teve 157/158: a fixture inventava `expiresAt=Date.now()+100000` em cada verificação, alterando a prova de sessão entre o `before-read` e `after-read` — o gateway a rejeitou corretamente. A fixture foi corrigida para fixar a expiração original; **158/158 PASS** em `node scripts/run-p0-tests.mjs` local, 0 falha/skip. Esse é um teste de transporte e estado, **não** uma prova de Chrome HTTPS nem da interface visual ou da sessão Keycloak real.

## CP046-C — proteção contra exposição HTTP do servidor de laboratório

Auditoria 22/11/2026 (22h17 BRT). A função `createP0NativeLabServer` foi inicialmente documentada como exclusiva de loopback, mas retornava `http.createServer` sem impor essa restrição. Em Node, `server.listen(0)` (sem endereço) pode escutar em wildcard IPv4/IPv6. Isto poderia expor acidentalmente tráfego de sessão em HTTP claro numa rede externa se o integrador usasse a factory como servidor real.

Duas regressões falharam na versão anterior (RED; ambas `Missing expected exception`). A nova factory aceita **somente** endereço literal explícito `127.0.0.1` ou `::1`, tanto em `listen(port,host,cb)` quanto em `listen({port,host})`, recusando `listen(port)` sem host, `0.0.0.0`, `::`, hostnames, Unix sockets e file descriptors **antes** de abrir porta. O gateway puro permanece disponível para um integrador futuro que forneça HTTPS e política de Host/Origin/cookie segura, e deve passar por homologação independente; esta mudança não habilita produção.

`secure-native-read.cp046.test.mjs`: +3 testes, dois RED na versão anterior e 3/3 GREEN no patch. Suite CP046 gateway 27/27, `npm run test:p0` 161/161 e bateria combinada 215/215, Node22 estrito, 0 fails/skips. A execução nativa original segue sintética: MariaDB/Keycloak/TLS não foram testados.
