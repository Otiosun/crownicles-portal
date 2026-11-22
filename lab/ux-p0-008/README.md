# Crownicles Portal — UX-P0-008 | segurança de concorrência (somente laboratório)

22/11/2026. Critério frio: a próxima alteração tinha de corrigir comportamento, não somar protótipos estéticos.

## Achados adversariais verificados

A. `FETCH_FINISHED` retornava sem revogar se uma resposta de sessão atual com `domainState: unauthorized` tivesse `requestId` superado por resposta nova. O contrato já exigia limpeza de todas as seções ao receber HTTP 401; a checagem de obsolescência estava incorretamente antes da revogação. Solução: após verificar seção e `epoch` da sessão, tratar `unauthorized` *antes* da validação da última consulta. Respostas `ready` antigas continuam ignoradas. 401 de época anterior NÃO pode derrubar ator atual.

B. `FETCH_STARTED` do inventário enquanto a vista estava em `detail` executava `clearDetail`, apagando a identidade `{category,slot,id}` antes da comparação posterior. Assim, `ready` com o mesmo item não conseguia restaurar seleção. Solução: ocultar detalhes e dados de imediato, sair do detalhe, limpar a origem mas manter *apenas* a chave inerte da seleção até o retorno. Se item faltar, ID mudar, resposta for `restricted`, `unavailable`, 401 ou logout, a seleção será descartada. A máquina segue **sem qualquer permissão para ação mutável**.

## Testes executados

- RED na máquina original: 5 testes (3 PASS, 2 FAIL) em cenário de retorno de 401 e recarga durante inspeção.
- GREEN da máquina corrigida: 29 testes originais + 10 testes adversariais = **39/39 PASS**, 0 FAIL.
- Regressão DOM/Chromium da UX-P0-007 usando a máquina corrigida: **96/96 PASS**, 0 FAIL, em 320, 390, 768 e 1440 px. O navegador consumiu ESM via URL `data:`; não é validação do carregamento HTTP relativo.
- O browser `localhost` continua bloqueado por `net::ERR_BLOCKED_BY_ADMINISTRATOR`; o servidor HTTP devolve os bytes/MIME adequados mas isso não fecha a integração.

## Reprodução

No checkout do branch de pesquisa, a partir da raiz do repositório:

```bash
node --test lab/ux-p0-003/machine.test.mjs lab/ux-p0-008/machine.race.test.mjs
```

O teste com navegador pode ser executado com o script existente `lab/ux-p0-007/ux_p0_007_playwright.py` em ambiente com Playwright/Chromium (o script injeta o import real como ESM `data:`). Nenhuma liberação para produção é autorizada por isso.

## Gates inalterados

- **PR #4 draft**: pesquisa isolada, sem merge/deploy e sem mudanças ao `web/`/Core.
- Autorização real, Keycloak, gateway allowlist, Core/MariaDB, CI runner e políticas de 401 continuam não homologados. A máquina recebe eventos já traduzidos de um adaptador hipotético; nunca é mecanismo de autorização em servidor.
- Testes com jogadores T01–T06, leitores de tela reais e navegador HTTPS autorizado continuam pendentes. REF-UX-002 segue reprovado artisticamente.
- UX-001: **PARCIAL**, não converter 39/39+96/96 em porcentagem de conclusão do portal.

**Decisão para o próximo ciclo:** parar novos protótipos decorativos e baterias de zoom. O primeiro desbloqueio útil é teste HTTPS/browser autorizado e validação da integração de sessão/gateway; depois testes T01–T06 com jogadores. CP027/CI rodam em trilhas técnicas independentes.
