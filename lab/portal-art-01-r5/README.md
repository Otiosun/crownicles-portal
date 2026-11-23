# Crownicles Portal · ART01 R5 — A janela de leitura

**Situação: estudo artístico exploratório e integração de superfície P0 em laboratório. Identidade visual ainda NÃO APROVADA.**

O usuário reprovou o R3. O R4 preservou a navegação, mas a peça ornamental não fazia parte da experiência, principalmente no celular. Este R5 tenta outro princípio: a mesma **abertura central** representa a posição em foco e se transforma ao entrar em inspeção; a escolha é feita por botões reais, com os mesmos estados (slot, categoria, detalhe e retorno). Nenhum item real, classe, artefato, nome de personagem ou regra de jogo é inventado. O ambiente de paisagem é uma ilustração original **conceitual**, não local canônico do Crownicles nem imagem autorizada para publicação.

## A — estudo independente

- `index.html` é prévia portátil, sem rede/servidor/contas; seus valores são **fixtures declaradas** e só servem para ensaiar hierarquia e interação. A cena e o foco de um slot mudam juntos; a inspeção amplia a abertura sem trocar a identidade do item.
- `src/index.template.html` e `src/build.py` são fontes editáveis; `assets/valley.webp` é a arte conceitual em WebP, `assets/valley-master.png` é o master; `assets/relief.svg` é fallback autoral procedural e documenta alternativa de menor dependência de geração.
- Os quatro tipos WEAPON/ARMOR/POTION/OBJECT são rótulos de categoria, NÃO famílias visuais já aprovadas; itens mantidos como `category + slot + id`; `ID 0` e o mesmo `ID 10` em dois slots são cenários intencionais.
- Não se implementam `Equip`, `Sell`, `Drink`, comando de jogo, sessão nem consulta ao Core. Nenhuma imagem é atribuída a IDs.

## B — casca visual sobre P0 CP052 (separada)

- `p0-shell.html` é um HTML que pode importar `../ux-p0-010/controller.mjs` **sem modificar esse controlador** quando estiver ao lado do laboratório CP052 na mesma branch. Ele usa exatamente os contêineres `#navigation`, `#content`, `#status` requeridos pelo P0.
- `src/p0-visual.mjs` lê apenas o DOM de exibição após o render do controlador e atualiza **um palco visual `aria-hidden`**. Não chama fetch, não sabe token, telefone, Keycloak, login, seleção de ator nem acessa banco. Se a UI volta a estado não autenticado/indeterminado, apaga o último slot. Inspeção direta sem seleção conhecida mostra `◇`.
- Não existe segundo estado autoritativo; a decoração acompanha o HTML que o controlador já autorizou. A segurança está **inteiramente** no backend e no controlador CP052, cuja homologação nativa continua pendente.

## Reprodução local

**No GitHub**, esta PR contém os dois HTML autocontidos, `p0-visual.mjs` e os dois testes; os testes podem ser executados diretamente no diretório da PR. **No ZIP do Drive**, também existem a pasta `src/`, os arquivos mestres de arte e os scripts para reconstruir o HTML. A compilação a partir de fontes exige esse ZIP completo (não apenas a PR).

```sh
python src/build.py      # requer ZIP completo do Drive
python qa/test_r5.py
python qa/test_p0_visual.py
```

Requer Python3, Playwright Python e Chromium instalado para rodar o QA. O teste P0 injeta uma simulação mínima das estruturas DOM expostas em CP052 **sem rodar autenticação real**; nunca confundir com P0 end-to-end.

## QA obtido neste lote (local e em container)

- `test_r5.py`: **165/165 PASS** em 320/390/430/768/1024/1440 CSS px, Escape, navegação via teclado, retorno do foco, categorias, slot0, ID0, ID10 duplicado, categoria sem itens, sem overflow/erros JS/rede e texto ampliado 200%.
- `test_p0_visual.py`: **95/95 PASS** em 320/390/430/760/1440, projeção de slot somente após estado autorizado renderizado no DOM, limpeza na perda de sessão, slot inválido, teste de 200%, ausência de rede e papéis/IDs de contêiner. Estes são mocks DOM estruturais do controlador, não inspeção de interface de usuário real com sessão real.
- Bugs corrigidos na sessão: ordem mobile da seleção (antes estava depois da ficha de detalhe), overflow de navegação com texto 200% no demo R5, overflow do rótulo P0 R5 com 200%. Nenhum teste omitido para atingir verde.

## Crítica artística obrigatória

R5 supera a ausência de linguagem visual do R3 e o papel decorativo da peça R4, especialmente no celular: a cena e o indicador de seleção permanecem visíveis, o palco participa da navegação. Ainda assim **a abertura radial tem linguagem geométrica genérica** e pode ser percebida como um HUD de fantasia; a paisagem pode esconder a falta de uma iconografia própria e foi gerada para estudo, não é região oficial. Nenhum retrato, item do catálogo ou mecanismo canônico foi ilustrado. Sem aprovação do dono, nenhuma modificação em `web/`, merge, deploy, produção em massa de assets ou Bíblia Visual definitiva.

## Fronteiras preservadas

`lab/ux-p0-010/controller.mjs` e a máquina P0 permanecem intactos. R5 só acrescenta novos arquivos em `lab/portal-art-01-r5/`; dados de usuário, Core, bot, WhatsApp, bancos, CI, OIDC, CP027 e main inalterados. Este laboratório não demonstra HTTPS real, `Secure/HttpOnly/SameSite` em browser, Keycloak, MariaDB ou sessões WhatsApp.

O próximo passo visual deveria ser **substituir a geometria genérica por uma gramática artística comprovadamente vinculada aos conteúdos do Crownicles**, sempre mantendo a seleção, as respostas sem arte e a consulta rápida no mobile. Não multiplicar opções sem crítica nem homologar por contagem de testes.
