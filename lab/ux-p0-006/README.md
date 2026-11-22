# Crownicles — UX-P0-006 | Acessibilidade operacional e testes ESM isolados

**22/11/2026 — laboratório, não homologado.** Continuidade restrita do contrato UX-P0-003 e do protótipo UX-P0-005. Não altera `web/`, Core, Keycloak, bot, MariaDB ou qualquer jogador.

## Falhas demonstradas e correções

Na versão anterior da tela de baixa fidelidade, a navegação por teclado revelava três defeitos concretos:

1. `Ir ao conteúdo` atualizava o fragmento `#content`, mas o foco terminava em `BODY`; o `<main>` recebeu `tabindex="-1"` e agora o foco chega ao destino.
2. O título receberia foco programático, mas `outline:0` apagava seu indicador. Títulos e `main` ganharam um anel de foco visível.
3. Em 320 px com texto ampliado para 200%, os botões de navegação estouravam o layout: `scrollWidth=327` diante de `innerWidth=320`. Agora a navegação reorganiza as colunas de modo responsivo e não causa overflow.

Complementos: grupos de categorias e itens identificados semanticamente com `role="group"`; texto de capacidade sem afirmar que equivale às reservas; retirada de uma cópia local desnecessária de uma resposta e limpeza do marcador de scroll em troca/fim de sessão. Nenhum dado de autenticação real é processado.

## Regressão automatizada

`ux_p0_006_playwright.py` é um teste com Chromium + Playwright para o HTML de UX-P0-005 e o mesmo módulo `../ux-p0-003/machine.mjs`. Executar em uma cópia de laboratório que tenha as duas pastas irmãs `ux-p0-003/` e `ux-p0-005/`:

```sh
python ux_p0_006_playwright.py
```

O script testa 320×800, 390×844, 768×1024 e 1440×900, em `prefers-reduced-motion`, a transição por botão/teclado, seleção por slot, id=0, duplicatas id=7, inspeção/retorno e foco, `loading`, `ready`, `restricted`, `not_initialized`, `unavailable`/retry, perda de sessão por 401, ausência de conteúdo residual, zoom de texto a 200%, ausência de overflow e de exceções JS. Também verifica foco do skip link e áreas de toque ao menos 44×44 px no cenário principal.

**Resultado local: 70/70 verificações PASS**, além de **4/4 smoke tests originais de UX-P0-005** e importação ESM por Node 22 com sintaxe nativa. O teste gera apenas dados sintéticos e não envia requisições de jogo. Logs e capturas são evidências locais, não prova com jogadores.

## Fronteira importante da importação ESM

O navegador deste ambiente bloqueou a navegação **HTTP ao servidor local** (`net::ERR_BLOCKED_BY_ADMINISTRATOR`). Este novo teste executa o HTML com `<script type="module">` e uma importação **ESM real** de `machine.mjs` via URL `data:` construída exclusivamente dos bytes desse arquivo. Diferentemente do teste anterior, não apaga `export` e não transforma o módulo em script comum. Isso **não homologa** resolução de caminho relativo, MIME/headers, CSP ou navegação HTTP do servidor real. A conferência HTTP permanece pendente em ambiente que permita `localhost`.

## O que não foi validado

Não houve leitor de tela real (NVDA, VoiceOver, TalkBack), navegação por toque em aparelho físico, revisão visual com jogador, autenticação/revogação real, Core/Keycloak/MariaDB, pipeline CI no runner do GitHub, nem avaliação de arte final. A prévia de baixa fidelidade serve para tarefas T01–T06, não aprova a estética de REF/UX-002.

**Gate:** continuar UX-001 PARCIAL; PR de laboratório deve permanecer draft, sem merge ou deploy. Antes de promover o fluxo, testar carga ESM por servidor real, leitor de tela e participantes com tarefas do roteiro UX-P0-003.
