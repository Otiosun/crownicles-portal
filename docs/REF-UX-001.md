# REF/UX-001 — Confronto de vídeo e primeiro ensaio de interação

**22/11/2026 | Estado: LABORATÓRIO, SEM ACEITE ARTÍSTICO OU INTEGRAÇÃO**

A gravação de 515s enviada pelo usuário mostra a exploração *mobile* das seis referências priorizadas pela Constituição: Constance (~0–75s), Twisted Wonderland (~78–180s), MementoMori (~183–328s), Reverse: 1999 (~342–405s), The Cosmic Wheel Sisterhood (~408–456s), Clair Obscur (~468–515s). Capturas amostradas em intervalos de 12s; não há reprodução integral de ações nem validação desktop.

## Evidência persistente

**Pacote independente:** [Drive — REF/UX-001](https://drive.google.com/file/d/1PR1KFqfp0T1S4tKrw-XMidYHvAcylCck/view)  
SHA256 local do ZIP: `39ef77705d4c58e12e9f75c9bb4bcb892906b3c4e6cef5845df7c2a3f70bdfe6`. 
Contém `VIDEO-ATLAS.md`, `index.html`, `style.css`, `app.js`, `test_browser.py`, screenshot/evidência e README. O ZIP foi enviado à pasta oficial do projeto na conta Komekko. A aplicação é inteiramente offline, não tem API, autenticação ou backend.

## Observações que podem ser transferidas (sem copiar)

- **Constance**: ilustração e composição definem a estrutura por seção; evitar apenas colocar um quadro pictórico atrás de cards.
- **Twisted Wonderland**: grupo/personagem, seleção, emblema, anterior/próximo e navegação modal são uma única gramática.
- **MementoMori**: assunto visual em protagonismo, composição respirada e informações subordinadas; o Crownicles deve manter força na ausência de retrato individual.
- **Reverse: 1999**: hierarquia editorial/narrativa e presença do sujeito. Alguns carregamentos observados no vídeo, sem generalizar causas.
- **Cosmic Wheel**: objetos/cenários como linguagem narrativa, não mecânica nova.
- **Clair Obscur**: enquadramento em camadas para apresentar personagens e texto, não catálogo de retratos obrigatório.

O vídeo permite confrontar **mobile**; não demonstra desktop, desempenho, contratos de Core ou acessibilidade.

## Prova de mecanismo realizada

Uma experiência isolada liga `Personagem → Pertences → seleção → Inspeção → Retorno`. Os conteúdos são **fictícios** e os quatro SVGs originais são experimentais (cristal, espada, poção, escudo), nunca assets oficiais de itens. Adicionados modos sem ilustração e acesso restrito (restrição só simulada em UI; futura segurança é server-side). Sem bibliotecas/imagens de terceiros.

**Chromium:** 360×800, 390×844, 768×1024, 1440×900; em cada viewport foram testados navegação, seleção, dialog, Escape, ausência de arte, restrição, restauração e retorno, 0 exceções JS e 0 overflow horizontal. Teste com `page.set_content` (HTML/CSS/JS inline), pois `file://` direto foi bloqueado por política local. Isso comprova renderização em Chromium e interações exercitadas, **não** usuários reais, performance, Playwright via HTTP, acessibilidade assistiva ou movimentos complexos.

## Crítica adversarial — reprovação da direção final

A composição e os elementos SVG ainda são **geométricos/editoriais demais** e não atingem a riqueza de assets, textura, recortes, protagonismo, surpresa e integração pictórica das referências. O resultado é evidência de fluxo, **não** direção estética. Não incorporar o CSS/HTML ao `web/` existente nem atualizar `main` sem revisão visual.

## Próximo lote efetivo

1. Elaborar um briefing de composição e camadas para **um** dos momentos do fluxo (preferir objeto selecionado) com comparação lado a lado Constance/Twisted/Memento e demonstração sem imagem; bloquear assets genéricos e símbolos de outros projetos.
2. Criar **um** avanço artístico substancial: palco/máscaras/sombra/sujeito/contexto individualizados; sem pintura por jogador.
3. Validar novamente no Chromium mobile e desktop, incluindo detalhes e estado restrito, registrar crítica antes de expandir para companheiro/jardim.
4. Trilha técnica separada: CP027 MariaDB/Core ainda 0/12, CI pré-runner falha (#3), nenhum merge/deploy.

**Referências:** [Constituição](https://docs.google.com/document/d/1RPOXw21fD8f4AF8cISaehx7KoCJDJ5o59y2F7tS15DA/edit), [Estado](https://docs.google.com/document/d/1Uq2rkha-KvlkntO0MO8RBMpQJQuo5H-GrQlCsv0b5aY/edit), [Dossiê](https://docs.google.com/document/d/16imPjZG6eFDOgrssBRqY0mqGrwuKgI93DCMWsyYy3s0/edit), [PR-base](https://github.com/Otiosun/crownicles-portal/pull/1).
