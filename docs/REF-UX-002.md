# REF/UX-002 — Prova material de acervo e revisão adversarial

**22/11/2026 · LABORATÓRIO · NÃO HOMOLOGADO / NÃO PUBLICADO**

Continuidade de REF/UX-001, sem alterar `web/` do portal ou código Core. A análise da gravação mobile das seis referências foi usada para concentrar a prova no fluxo **Personagem → Pertences → selecionar → Inspecionar → retornar**.

## Pacote verificado no Drive oficial

- [Código, assets originais, manifest, crítica e 4×6 capturas](https://drive.google.com/file/d/1PyALP5hjTB3LVCYx7jtsRW7xG8F8v66B/view)
- [HTML autossuficiente para abrir sem servidor](https://drive.google.com/file/d/11xFRKET_lad5Uao8DVTfqKq0hx3t-3aZ/view)
- Nome: `CROWNICLES_REF-UX-002_20261122.zip`. SHA256 local: `2dfcab8fa557c64d202f070378bf84fea618e3a8ec804d0de335add094459723`.
- Novo asset amethyst.webp: **649×850 px, 181.402 bytes**, RGBA/WebP com transparência; desenho pictórico isolado gerado para o laboratório, NÃO ícone oficial do material. Master PNG separado, origem registrada em `ASSET-MANIFEST.json`.
- Demais ícones ainda SVG de prova anterior; nenhuma imagem de terceiros copiada.

## O que mudou em relação a REF/UX-001

1. Composição de personagem sem rosto inventado: medalhão tipográfico modular, nome/nível/saúde/energia claros.
2. Arquitetura de inventário em índice + palco de inspeção com material pictórico e camadas independentes (ornamento, luz, vinhas, peça).
3. Selecionar cristal/espada/poção/escudo muda **geometria da abertura, paleta e objeto**; transição curta desativável via prefers-reduced-motion.
4. Diálogo de inspeção com foco e fechamento Escape; fallback sem arte aprovada; restrição simulada apaga objetos do DOM e desativa inspeção.
5. Nenhum endpoint HTTP, login, dados de jogadores, transação ou mutação.

## Testes (Chromium Playwright)

4 viewports completos **360×800, 390×844, 768×1024, 1440×900**: navegação, img carregada/decodificada, objeto selecionado, diálogo, Escape, ausência de arte, restrição, restauração, retorno; **0 erros JS / 0 overflow horizontal**. Verificações extras de toque, teclado/setas e inspeção em **320, 375, 430, 1024, 1920 px** também passaram. O HTML único foi testado isoladamente em 390 px. Não há teste AT com leitores de tela, usuários reais, performance ou backend.

## Crítica visual (gate ainda aberto)

A qualidade da peça focal progrediu e os materiais da interface agora respondem ao tipo selecionado. Entretanto, **a composição geral ainda lembra um gabinete editorial**, não uma metáfora central inesquecível como o exemplo do Pokémon Beyond enviado pelo usuário. O contraste entre pintura e três SVGs de estudo é desuniforme; o modal e índice permanecem previsíveis. Portanto **nenhuma aprovação artística**, nenhum merge, deploy ou incorporação ao produto real.

## Próxima prioridade

**Não construir mais telas.** Provar um gesto central de interação original, escalável e usável, que una identificação, índice e inspeção; só depois expandir famílias de assets, estados e cinco áreas. Confrontar novamente lado a lado com [Constance](https://games.parco.jp/page/constance/), [Twisted Wonderland](https://twisted-wonderland.aniplex.co.jp/character/), [MementoMori](https://mememori-game.com/en/gallery/luke/) e a referência estrutural Pokémon Beyond (capturas do usuário). O artefato/lore e a pedra continuam indecididos. Gates CP027 MariaDB real e Actions continuam independentes e bloqueantes.

Fonte do projeto: [Constituição](https://docs.google.com/document/d/1RPOXw21fD8f4AF8cISaehx7KoCJDJ5o59y2F7tS15DA/edit), [Estado](https://docs.google.com/document/d/1Uq2rkha-KvlkntO0MO8RBMpQJQuo5H-GrQlCsv0b5aY/edit), [Dossiê](https://docs.google.com/document/d/16imPjZG6eFDOgrssBRqY0mqGrwuKgI93DCMWsyYy3s0/edit).
