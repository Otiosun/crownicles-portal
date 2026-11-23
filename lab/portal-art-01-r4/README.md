# Crownicles Portal — ART01 R4 / O Fio

**Status: experimento artístico isolado e ainda reprovável.** Surge depois de o responsável reprovar os estudos R3. Esta entrega não estabelece a identidade visual, não representa um item canônico, não cria um artefato no jogo e não modifica a página de produção nem o laboratório técnico P0.

## Abrir e reproduzir

1. Abrir `Crownicles-Fio-Estudo-Interativo.html` no navegador (autocontido, sem rede).
2. Experimentar Personagem → Pertences → Armas/Armaduras/Poções/Objetos → selecionar posição → Inspecionar → Voltar (ou Esc); a seleção e o foco devem persistir.
3. Reconstruir sem rede: `python extract_asset.py && python build.py`; o arquivo gerado deve manter o mesmo SHA256 do original. Os arquivos `source.html`, `extract_asset.py` e `build.py` deixam a ilustração e o código separáveis apesar do HTML portátil.
4. Regressão: `python test_preview.py` e `python qa/test_accessibility.py`. Requerem Python, Playwright e Chromium instalado; são testes locais, NÃO CI/produção.

## O que são as imagens

A peça de metal e tecido foi criada como **imagem conceitual independente**, depois reduzida a WebP RGBA. Seu foco é experimentar continuidade entre áreas: o fio acompanha mudança da navegação, mas não representa armas, poções, o personagem ou um item real. Não há licença/catalogação aprovada para uso final. Dados numéricos, IDs e posições são fixtures sintéticas identificadas como tal.

## Qualidade e limites

- 70/70 verificações de navegação em 320/390/430/768/1440 CSS px; 18/18 smoke de 200% de texto, reduced-motion, cabeçalho, sem overflow nas três telas em 320/390/1440. Os bugs descobertos em overflow e navegação a 200% foram corrigidos, não omitidos.
- **Não aprova arte nem UX de produto**. Sem navegador HTTPS real, usuário/jogador, Keycloak/OIDC, Core/MariaDB, WhatsApp, T01–T06 ou leitor de tela humano.
- Visualmente, supera a neutralidade dos esboços R3, mas permanece uma composição de duas colunas com ênfase excessiva em uma peça pictórica genérica. O móvel reduz a imagem para preservar a leitura; a metáfora central ainda não é suficientemente memorável e não é sustentada pela lore.
- Melhorar exige novo conceito com gesto de seleção mais intrinsecamente conectado ao mundo e família de assets coerente; não usar mais ornamentos ou números de testes para simular qualidade artística.

## Fronteiras de integração

HTML deste estudo é **independente**. O P0 técnico (`lab/ux-p0-010/`) monta `#navigation`, `#content`, `#status` e mantém ações `data-action`, autorização server-side, abort e 401; não trocar essa fonte, não alterar `web/` e não importar o fixture como estado real. O legado das tentativas ART01-R3 e a Constituição Portal permanecem arquivados no Drive Komekko.
