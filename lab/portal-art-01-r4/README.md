# PORTAL-ART-01 / R4 — O Fio (estudo isolado)
Status: **laboratório visual, não aprovado**, em resposta à reprovação explícita do R3. Não é a página real do portal nem representa um artefato canônico do Crownicles.
## Rodar
- Abra `lab/portal-art-01-r4/index.html` diretamente no navegador. É autocontido: CSS, JS e WebP embutido, sem chamadas de rede, credenciais, Keycloak, cookies ou servidor.
- `source.html` preserva o HTML/CSS/JS editável com marcador `__ART_DATA__`, substituível pelo data URI de uma ilustração local. Não usar o placeholder como UI entregue.
- Os valores nível/vida/experiência/dinheiro, categorias e IDs são **fixtures artificiais explicitamente rotuladas**. Não representam jogadores ou nomes/ilustrações canônicas.
## O que foi implementado
- Três estados navegáveis: Personagem → Pertences → Inspeção → retorno à mesma posição. Categorias Armas/Armaduras/Poções/Objetos, IDs e slots; mudança de categoria, detalhe, back por botão/Escape e retorno de foco.
- Composição independente com área de leitura prioritária, figura ilustrada separada e fio desenhado em SVG somente em desktop; no mobile não compete com a consulta. `prefers-reduced-motion` desativa transições.
- HTML semântico com botões reais, skip link, h1 e foco; não há ações de item nem qualquer autorização.
- A ilustração de estudo é uma peça needle/ribbon original gerada separadamente, comprimida para WebP RGBA; a peça não é item do jogo nem foi aprovada. A ilustração completa está codificada no HTML; não usar como asset canônico.
## Evidência local (não CI)
- Chromium Playwright via `page.set_content`: 70/70 checks em 320, 390, 430, 768 e 1440 CSS px, seleção/inspeção/volta, preservação de foco, imagem, ausência de overflow e requests externos. Os 5 red flags iniciais (4 overflows/1 foco assíncrono no teste) foram corrigidos antes da execução verde.
- Imagens 390/1440 dos três estados e código de teste incluídos no pacote Drive; o HTML Git é blob-idêntico ao pacote.
## Crítica obrigatória
- **Não chega ao nível de Constance, Twisted Wonderland e MementoMori**. É mais coeso do que os wireframes R3, mas continua dependente de uma imagem central e de uma composição editorial esquerda/direita.
- Metáfora do fio ainda não tem respaldo de lore; o desenho tem acabamento fantástico, não uma família artística coerente por item/sistema. Mobile preserva rapidez mas tem menos presença pictórica que desktop.
- Não avaliar com nota “aprovado” por haver testes, screenshot ou ilustração nova. A etapa 05 continua em aberto.
## Integração: NÃO MEXER
- Não alterar `web/`, P0 `lab/ux-p0-010/controller.mjs`, fluxo de vínculo, máquina de sessão nem CP045–049. A interface real usa `#navigation`, `#content`, `#status`, ações delegadas, foco e invalidação por 401. Este HTML é uma pesquisa totalmente separada.
- Próximo avanço substancial: testar uma composição autoral que torne a seleção e a inspeção uma única experiência, com família de arte contextual de verdade e fallback; validar com a crítica do proprietário e sem copiar marcas de terceiros.
