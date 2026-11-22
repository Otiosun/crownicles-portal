# Crownicles — UX-P0-007 | Reflow interno, árvore AX e recursos HTTP

**22/11/2026 — prova de laboratório, NÃO homologação do portal.** Continuidade dos contratos UX-P0-003 e do laboratório UX-P0-005/006 no PR #4, sem modificar o Core, o bot, o banco, a autenticação ou o frontend de produção.

## Defeito que o UX-P0-006 não detectou

A verificação anterior comparava apenas `document.documentElement.scrollWidth` com `innerWidth`. Ela aprovava uma página mesmo quando um **filho interno** possuía mais conteúdo do que a área disponível. Em 320 px com fonte a 200%, o `h1` e a lista apresentavam `scrollWidth=270` contra `clientWidth=254`, apesar de a página não ultrapassar 320 px. Em 768 e 1440 px, o menu e o resumo lateral também tinham vazamento interno. A captura anterior mostrou a palavra “Pertences” cortada e o menu partindo palavras de forma inadequada.

## Correções

- Reflow específico: o título reduz seu limite tipográfico e permite quebra segura; o primeiro conteúdo de cada botão de item pode encolher sem projetar texto além da caixa.
- Largura da coluna esquerda responsiva a `rem` e ao espaço disponível (`clamp(13.125rem,30%,22rem)`), com reorganização para uma coluna em até 900 px. Ao ampliar a fonte a 200%, o menu lateral já não espreme “Personagem”, “Pertences” e “Ferramentas de teste”.
- `min-width:0` nos painéis e quebra segura em botões/resumo; não oculta a perda de texto com `overflow:hidden`.
- Rótulo do slot zero passou de “Equipamento ativo” para **“Posição ativa”**, evitando tratar poções/objetos como equipamento. O ID 0 continua preservado e selecionável, sem inventar nome localizado.
- Título da prévia atualizado para UX-P0-007; nenhum asset artístico escolhido.

## Regressão nova, reproduzível

A partir da raiz do pacote:

```bash
python lab/ux-p0-007/ux_p0_007_playwright.py --root lab --result lab/ux-p0-007/test-results.json
```

Requer Python, `playwright` e Chromium (`/usr/bin/chromium` no ambiente de execução; adaptar `executable_path` em outra máquina). O script usa dados exclusivamente sintéticos e executa o **mesmo módulo ES nativo** `ux-p0-003/machine.mjs` via URL `data:` no navegador. Não substitui exportações, não duplica a máquina de navegação, não contata serviços do Crownicles.

**Resultado desta execução: 96/96 PASS, 0 falhas** em 320×800, 390×844, 768×1024 e 1440×900. A bateria cobre:

- tela sem sessão, perfil, inventário, seleção do ID 0, dois slots com ID 7, inspeção e restauração de foco;
- AX tree exposta pelo Chromium (`main`, navegação, heading e grupos nomeados), teclado, skip link e alvo de toque;
- `ready`, `restricted`, `not_initialized`, `unavailable`, `loading` e 401, com remoção de registros antigos;
- overflow externo **e interno** a 100% e 200% do texto;
- retorno HTTP 200 e MIME corretos ao servir HTML e `machine.mjs` com servidor estático local, além de resolução de caminho relativo.

**Fronteira HTTP:** o servidor HTTP local respondeu via cliente Python e as rotas/headers foram confirmados, mas o Chromium deste ambiente bloqueia navegação top-level tanto a `localhost` como a URL de teste interceptada (`net::ERR_BLOCKED_BY_ADMINISTRATOR`). Portanto **não existe prova do carregamento de HTML + import relativo sob HTTP pelo navegador**. O ESM do Chromium foi exercitado somente por `data:`. Esta limitação NÃO deve desaparecer do registro.

## Evidências e pendências

- `test-results.json`: enumera e registra cada verificação.
- `inventory-320-200pct.png` e `inventory-1440-200pct.png`: capturas após correção, não aprovação artística.
- A prévia HTML autossuficiente injeta o mesmo módulo como URL `data:`, para consulta sem ambiente de desenvolvimento.

Ainda **não** houve NVDA, TalkBack ou VoiceOver, testes qualitativos T01–T06 com jogadores, domínio HTTPS hospedado, sessão/Keycloak real, MariaDB, runner CI, integração ao bot nem avaliação estética final. A aparência de REF-UX-002 continua reprovada. UX-001 permanece **PARCIAL**, e o PR #4 deve continuar em rascunho, sem merge ou deploy.

Próximo gate: validar o ESM relativo em navegador sob servidor/HTTPS real autorizado, depois avaliação com leitores de tela e jogadores; correções funcionais antes de autorizar arte.
