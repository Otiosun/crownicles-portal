# Crownicles Portal — ART01 R6 | Superfície de consulta sem obstáculo

**Status: prova funcional de integração visual. Não é identidade visual aprovada, versão produtiva nem ligação real do jogador.**

## Mudança demonstrável

R5 colocava um palco pictórico antes de qualquer vínculo/consulta. Em 390px, o botão de verificar a sessão aparecia em Y=519px; o fluxo de obter código temporário em Y=779px. R6 fecha/oculta esse palco e a barra de navegação vazia quando o controlador está em login/indeterminado. Com o aviso sintético **adicional** de 80px, as coordenadas viraram Y=348px e Y=608px: ganho de **171px** em cada ação. A casca visual de origem caiu de **232.507 para 9.479 bytes**, redução de 95,92%, porque removeu arte conceitual ainda não aprovada. O texto e a confirmação privada continuam no controlador original.

R6 conserva uma faixa compacta somente após a sessão estar confirmada, identifica seção/slot sem mostrar nome de ator, e preserva a seleção contextual na inspeção. Ao aparecer login/indeterminado, limpa slot/marcador e oculta também a navegação visual vazia. A faixa permanece `aria-hidden` e **nunca** é autoridade de autorização, inventário ou identidade.

O tema geral ainda é provisório. Esta entrega NÃO resolve a direção pictórica do Crownicles nem fornece imagens oficiais de itens. R3 foi explicitamente reprovado; R4 e R5 não foram aprovados. Não mesclar para produção nem criar Bíblia Visual com esta casca.

## Prova com o controlador CP052 exato

Sete arquivos da branch `feature/cp052-inventory-name-search-20261123` foram recuperados via GitHub e checados com `git hash-object` contra `sourcepin_manifest.json`, **7/7 iguais**. A árvore do controlador CP052 foi mantida byte por byte. A prova usa `page.set_content` no Chromium: o controlador é carregado como módulos ESM `data:` e recebe `fetcher` sintético, com objetos de resposta válidos segundo `projection-guard.mjs`. Não usa rede, banco, Keycloak, WhatsApp ou senha. O HTML do laboratório contém aviso visível e persistente sobre a simulação.

### Fluxos verificados

- Entrada sem sessão, consulta de perfil, inventário real do controlador com categoria/slot/ID 0 e **mesmo ID 10 em dois slots**, selecionar reserva 2, inspecionar, voltar com o foco na mesma posição.
- 401 e logout: nenhuma informação antiga no conteúdo e nenhuma seleção residual da faixa visual.
- Troca de categoria, busca por ID/nome original e limpeza de pesquisa, ausência de navegação vazia sem sessão, responsividade, `prefers-reduced-motion`, HTML semântico/teclado.
- **R5 original reproduziu 4 overflows** com texto a 200% (inventário + detalhe a 320/390px); R6 reproduziu os mesmos casos **0/4 falhas**. Bateria comparativa: 186 verificações, 4 falhas esperadas **somente** na base R5; R6 sem nova falha. Bateria adicional com CP052 real: **60/60 PASS** (320, 390, 768, 1440px).
- `demo-sintetico-r6.html` foi reconstruído de sete fontes com pins exatos e gerou o **mesmo SHA256** que o artefato examinado: `e73ddf68ead9b9c30ac824c3ee6ccfdf9453eec2f1065e8e6c71d21cc9650acd`.

### Executar no checkout (Node, Python, Playwright e Chromium)

1. Use o branch deste PR, que contém os módulos CP052 originais, ou recupere os arquivos com hashes do manifesto para uma pasta `sourcepin/`, respeitando os caminhos.
2. `python3 build_preview.py` — gera o laboratório portátil autossuficiente. **Nunca publique este HTML como login real.**
3. Abra `demo-sintetico-r6.html` localmente ou use o Chromium via Playwright. O HTML não faz nenhuma requisição de rede.
4. Opcional: `python3 test_original_integration.py` e `python3 test_real_edges.py`, com a casca R5 da branch-base preservada para confronto. O ZIP privado no Drive contém todos os insumos originais para replay offline.

`build_preview.py` recusa qualquer arquivo CP052 cujo Git blob hash difira do manifesto. `shell-r6.html` é o HTML experimental **sem** injeção de resposta sintética; ele aponta para o controlador original CP052 via import relativo. A alteração em `shell-r6.html` não inclui lógica de login própria. O controlador e suas origens de dados continuam inalterados.

## Limitações

Sem navegador HTTPS de servidor autorizado, sem cookies HttpOnly/SameSite/Secure reais, sem sessão WhatsApp/Keycloak, sem MariaDB CP027, sem revisão visual dos 6 sites fonte na mesma escala, sem leitores de tela humanos ou T01–T06 com jogadores. Os hashes e os testes demonstram integridade/funcionamento da **integração visual sintética**, não prontidão para merge. Além disso, R6 remove decoração ainda não aprovada: é correção concreta de usabilidade, não solução estética definitiva.

**Próximo trabalho de alto valor:** auditar a interface com jogadores autorizados em ambiente de homologação; resolver a linguagem artística a partir de dados e objetos canônicos, não de fundos genéricos. Preservar a acessibilidade e a entrada direta comprovadas aqui.
