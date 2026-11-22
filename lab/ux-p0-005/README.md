# Crownicles — UX-P0-005 | Fluxo navegável de consulta, baixa fidelidade

**Status:** laboratório isolado, não aprovado para produção. Continuidade de UX-P0-003/004 em 22/11/2026.

## Objetivo

Validar **DOM e navegação** de Personagem → Pertences → Inspeção → Retorno, antes de arte, integração com o Core, autenticação real e teste com jogadores.

## Como abrir

Na raiz do repositório, execute um servidor estático local (por exemplo, `python -m http.server 8000`) e visite `http://localhost:8000/lab/ux-p0-005/preview.html`. O arquivo importa diretamente `../ux-p0-003/machine.mjs`, usando a **mesma** máquina pura e não uma segunda implementação de domínio. Abrir via `file://` pode impedir o import ESM por CORS; a versão autossuficiente não foi reivindicada.

## O que foi implementado

- Entrada **fictícia**, sem Keycloak, cookies, contas, API HTTP, servidor ou banco.
- Resumo de Personagem com campos dos fixtures sintéticos: nível, vida atual/máxima, experiência atual/máxima e dinheiro; sem nome nem classe inventados.
- Categorias nativas arma, armadura, poção, objeto. Botão de slot ativo e reservas individualizadas por `{category,slot,id}`; dois itens distintos de ID 7 em reservas 1/2; ID 0 no ativo.
- Inspeção somente leitura, atributos existentes e fallback editorial sem ícone/arte/nome assumidos.
- Retorno que tenta restaurar foco do item e posição de rolagem, usando DOM real.
- Cenários sintéticos de `ready`, `loading`, `restricted`, `not_initialized`, `unavailable` e sinal 401 (`unauthorized`), exercitando a máquina; sem esconder dados sensíveis por CSS como substituto de limpar o estado.
- Layout neutro de responsividade, indicador de foco e áreas de clique com altura mínima de 44 px. **Não é direção artística**.

## Evidência desta rodada

Teste de navegador com Chromium/Playwright, executado em **320×800, 390×844, 768×1024, 1440×900**: fluxo, ID 0, duplicatas, restauração de foco, limpeza em restrição e 401, sem overflow horizontal e sem erros JS. **Quatro viewports passaram**.

**Limitação importante:** por bloqueio de navegação HTTP/file no Chromium do ambiente de execução, o teste executou o mesmo script com o conteúdo de `machine.mjs` injetado numa página `set_content`. Isso exerce os handlers/DOM sob browser real, mas **não testa o carregamento ESM em servidor estático**. Também não foi medido o comportamento com leitor de tela, dados verdadeiros, autenticação, revogação de servidor, timing de rede, testes qualitativos com jogadores ou dispositivos físicos. O resultado não homologa UX-001 nem CP027.

## Decisões e próximos gates

1. Validar carregamento ESM e foco/scroll no navegador hospedeiro; correr teste de teclado, leitor de tela e touch.
2. Aplicar T01–T06 do roteiro UX-P0-003 com participantes e observador, sem dados privados.
3. Aprovada a estrutura, investigar gesto artístico principal frente às referências; o visual de REF/UX-002 segue explicitamente reprovado.
4. Somente depois estudar integração segura do nome público (`gameUsername` via gateway autorizado), catálogo versionado do Core, pt-BR e ilustrações próprias/licenciadas.
5. CP027 (MariaDB/Keycloak reais) e CI são gates separados; este laboratório não os altera.

**Não alterar** `web/`, `Core/`, Keycloak ou banco com esta prova. PR #4 permanece draft e sem merge/deploy.
