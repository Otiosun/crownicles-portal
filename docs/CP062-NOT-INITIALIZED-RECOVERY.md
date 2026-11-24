# CP062 — recuperação da leitura quando o domínio ainda não está preparado

**24/11/2026 — candidato de UX P0, read-only, não homologado para produção.**

## Bug comprovado no controlador real

Base de código `feature/cp059-reissue-failclosed-integrated-20261124` (PR39), controlador `lab/ux-p0-010/controller.mjs` Git blob `f00a3587ae708caff92d54da11df6c86a0743289` (idêntico até o PR40). Ao consultar **Personagem** ou **Pertences**, o servidor pode retornar HTTP 200 com `state:"not_initialized"` validamente projetado. Nesse estado, o controlador apresentava apenas a mensagem “Ainda não preparado”, **sem a ação Tentar novamente**. Na tela de inventário, ir ao personagem e retornar não consulta de novo porque o estado deixa de ser `idle`. Na tela de personagem, nenhuma ação alternativa de consulta fica disponível. Logo, quando o Core passa a disponibilizar os dados, o jogador precisa recomeçar a sessão/atualizar a página.

A bateria Chromium real executando o **ESM original** por `page.set_content` + fixture sintética `not_initialized` reproduziu RED **9/19** (10 verificações falhando), incluindo falta da ação e impossibilidade de recuperar os dados; o mesmo teste com a única alteração abaixo passou **19/19**. Este test harness bloqueia URLs de rede no Chromium; os responses são sintéticos e o servidor de produção não foi tocado.

## Patch mínimo

No `statusLabel` do controlador, o caso `not_initialized` agora passa `'retry'` ao renderizador `message`. É o mesmo botão já usado para falha `unavailable`; a ação existente `data-action="retry"` chama `fetchSection` e reaplica o mesmo `GET` read-only `/v1/me/profile` ou `/v1/me/inventory` com `same-origin`, `no-store`, `redirect:error`. **Nenhum novo endpoint, credencial ou permissão**. `restricted` permanece sem retry automático, distinto de `not_initialized`. Falha 401/503 na recuperação continua limpando ambas as seções da memória do cliente.

## Testes e evidências

- `python lab/ux-p0-010/test_recovery.cp062.py`: Chromium com ESM real e fixture sintética, valida acionamento por Enter, estado de perfil/inventário antes/depois, identidade do slot selecionado após inspeção, 320px sem overflow, revogação por 401 e limpeza por 503. **Não testa autorização real.**
- `node --test scripts/tests/cp062-recovery-contract.test.mjs`: 5 testes Node com a árvore de renderização real e BrowserReader, sem cookies/HTTP real; testa DOM `not_initialized` (Perfil/Pertences), requisição segura de nova leitura, resposta 401 e 503, e separação `restricted`. O glob `scripts/tests/*.test.mjs` já participa do `npm run test:tools` e portanto do `npm run check` da CI normal, **sem alterar `package.json` nem o gate TAP de outros workers**.
- Na fonte exata PR39 recomposta, antes da nova suíte: `npm run check` PASS com 43 web +24 integration +112 tools +221 P0. Na PR40 source-pinned sobreposta (4 arquivos modificados validados por Git SHA), baseline `npm run check` PASS com 43 web +24 integration +115 tools +239 P0; a nova suíte obrigatória adiciona **5 tools**. Os resultados integrados após a publicação devem ser conferidos no CI da HEAD específica.
- `npm run gate:p0:lab` no scratch PR40: **P0 239 e HTTPS 16 passaram como etapas**; a tentativa integral expirou na etapa Browser no executor local e não pode ser chamada de gate PASS. Testes nativos do Chrome TLS, Core/MariaDB, OIDC e WA pertencem a outras frentes.

## Coordenação

Branch baseada **exatamente no HEAD PR40** `8210f76b7a6c68d115cd52a8b725308be5a7e167`, já integrada ao contrato CP061 (sem reaplicar nem reescrever gate). Alteração restrita ao controlador, **dois testes novos** e este documento. Sem alteração de PR39/40/41, Core, banco, sessão/WA, GitHub workflows, deploy, CI settings, main, arte ou produção. PR DRAFT não é aceite visual nem permissão para merge automático.