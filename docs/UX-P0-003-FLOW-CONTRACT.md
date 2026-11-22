# Crownicles Portal — UX-P0-003 | Contrato de fluxo e estados da primeira fatia

**22/11/2026 · gate de estrutura UX, não direção artística nem implementação do Core.**

## 1. Propósito e fronteira

Esta entrega fecha **uma especificação de interação candidata** para **Personagem → Pertences → Inspeção → Retorno**, com dados e estados que o Core *realmente* fornece, usando os candidatos de leitura CP012 (Inventário) e CP014 (Perfil), ainda não homologados. Não inventa mecânicas e não define forma visual (pedra, console, grimório etc.). A aventura principal permanece no bot. O protocolo UX é independente de API/requisição real e não foi integrado ao bot, ao banco ou ao frontend do PR #1.

### Fontes autoritativas

- Core pinado 6.2.0.b, commit [`64d08c05`](https://github.com/Crownicles/Crownicles/tree/64d08c05f11949029317341735f6f73024f19f9b).
- [`CommandProfilePacket`](https://github.com/Crownicles/Crownicles/blob/64d08c05f11949029317341735f6f73024f19f9b/Lib/src/packets/commands/CommandProfilePacket.ts) e [`ProfileCommand`](https://github.com/Crownicles/Crownicles/blob/64d08c05f11949029317341735f6f73024f19f9b/Core/src/commands/player/ProfileCommand.ts).
- [`CommandInventoryPacket`](https://github.com/Crownicles/Crownicles/blob/64d08c05f11949029317341735f6f73024f19f9b/Lib/src/packets/commands/CommandInventoryPacket.ts) e [`InventoryCommand`](https://github.com/Crownicles/Crownicles/blob/64d08c05f11949029317341735f6f73024f19f9b/Core/src/commands/player/InventoryCommand.ts).
- CP012/CP014: `PortalInventoryQuery`, `PortalProfileQuery`, `gateway/projection.mjs` e `gateway/session-gateway.mjs` — **somente candidatos de laboratório**.
- Matriz nominal UX-P0-FIELD-MAP-002 no Drive: https://docs.google.com/document/d/1JlVQZFYtErWtFZ1XSBE_0rvZXRjEkfcM/edit
- Constituição e checklist: https://docs.google.com/document/d/1RPOXw21fD8f4AF8cISaehx7KoCJDJ5o59y2F7tS15DA/edit ; https://docs.google.com/document/d/1Uq2rkha-KvlkntO0MO8RBMpQJQuo5H-GrQlCsv0b5aY/edit

## 2. Decisões obrigatórias — domínio vs UX

| Código | Decisão/limite | Prova ou motivo |
|---|---|---|
| U01 | Entrada autenticada mostra **Personagem**, que encaminha a **Pertences**; não exigir uma home intermediária gigante. | O objetivo do primeiro slice é consultar dados recorrentes, não simular aventura. Hipótese UX a testar com jogadores. |
| U02 | A identidade do personagem **não terá nome inventado**. | `CommandProfilePacketRes.playerData` oferece 19 campos, mas **não oferece o nome público**; `keycloakId` é identificador privado que não deve ser mostrado. Usar rótulo funcional neutro até existir fonte autorizada para nome/avatar. |
| U03 | Rótulos traduzidos e imagens de itens exigem catálogo/autoria/fallback. | `MainItemDetails`/`SupportItemDetails` fornecem IDs/atributos, não nome localizado nem URL de ilustração. Não mapear ID arbitrariamente para arte, raridade ou descrição inventadas. |
| U04 | O filtro P0 é categoria nativa de quatro grupos (arma, armadura, poção e objeto), com **slot ativo** e **reservas**. | Fonte `CommandInventoryPacketRes`; materiais e plantas são estruturas separadas, não forçar como categoria de equipamento. Busca por nome fica condicionada ao catálogo. |
| U05 | Uma seleção é identificada por `{category,slot,id}`. | Idênticos IDs podem aparecer em slots distintos; `id=0` é válido e indica um conteúdo canônico do slot, não ausência geral. Não usar ID sozinho. |
| U06 | Detalhe **não modifica estado do jogo**. | Equipar, vender, consumir, mudar classe/defesa dependem de contratos nativos distintos e gates de segurança. Nenhuma ação mutável no slice P0. |
| U07 | Voltar do detalhe restaura categoria, seleção, posição de rolagem e foco **se o registro ainda existir**. | Requisito UX. `machine.mjs` produz intenção de foco; o scroll e foco reais só poderão ser comprovados quando houver DOM/frontend aprovado. |
| U08 | Ao mudar ator, revogar sessão ou receber 401, descartar todos os dados, seleção e histórico contextual. | Privacidade; sessão/ator são do servidor. O modelo de laboratório não implementa autenticação real. |
| U09 | Respostas assíncronas antigas não podem sobrescrever a sessão ou consulta atual. | Token de época da sessão + `requestId` por seção, como **protocolo de UI**, não como garantia de autorização. |
| U10 | `restricted`, `not_initialized`, `unavailable` e `ready` não são estados intercambiáveis. | União de retorno de `PortalProfileQuery` e `PortalInventoryQuery` CP012/014. O estado `absent` aparece em outros domínios, **não no P0 como estado oficial dos leitores citados**. |
| U11 | `loading` não é conteúdo pronto, e não mantém detalhes antigos sensíveis na tela. | Ao começar a nova leitura, a seção fica sem dados; não renderizar conteúdo anterior atrás de uma sobreposição. |
| U12 | O protocolo deve funcionar sem ilustração, animação ou metáfora material definida. | O design ainda não foi homologado. A ergonomia e a estrutura precisam ser demonstradas antes da arte. |

## 3. Organização das informações P0 — candidata, sem wireframe visual

**Personagem (orientação de consulta):**
1. Contexto mínimo: “Seu personagem”, nível (`level`), `classId` apenas se catálogo confiável traduzir a classe; não mostrar Keycloak ID.
2. Estado imediato: `health`, `experience`, `effect` (texto conforme catálogo), `stats` somente quando presentes. `effect.hasTimeDisplay` decide se há tempo exibível; o número `timeLeft` é em **milissegundos**, pode ser negativo, nunca calcular elegibilidade de ação por ele.
3. Progresso e recursos: `missions`, `rank` (posição `-1` = **sem colocação**), `money`, `tokens` quando presente. Evitar calculadoras paralelas de bônus/regeneração.
4. Informação secundária: emblemas `badges`, guilda, mapa/destino, pet, culinária, ranking de combate e desafio do rei, somente se presentes. Não criar setor vazio fictício para opcionais ausentes.
5. Chamada navegável “Ver pertences”, com acesso previsível ao menu global.

**Pertences:**
1. Título, categoria selecionada (4), estado de atualização da seção.
2. Slot ativo da categoria e itens de reserva, cada um com identidade de posição, não apenas ícone; `slots` são capacidade — **não** contador de itens possuídos.
3. Seleção ativa nítida e destino “Inspecionar”. Um item `id=0` continua sendo dado canônico de um slot (rótulo neutro até catalogação).
4. Materiais e plantas em subáreas do acervo quando seus contratos as reportarem; `plants.kind='not_reported'` não equivale a zero plantas. Flags de talismã não reportadas não equivalem a `false`.
5. Sem botões de equipar, usar, vender ou colher no primeiro slice.

**Inspeção:**
1. Referência à categoria, posição e item selecionado. Exibir atributos nativos (`MainItemDetails`: attack/defense/speed baseValue, upgradeValue, max; `SupportItemDetails`: nature, power, maxPower, usos opcionais). Se o gateway projetar `maxValue` não serializável, usar `{kind:'unbounded'}` ou `{kind:'unknown'}` na projeção existente, jamais inventar máximo.
2. Mostrar somente atributos oferecidos; omissões não viram zeros. Se não houver imagem/nome oficial, o detalhe ainda apresenta categoria + posição + informações nativas.
3. Voltar com foco intencional no mesmo item. Se ele desapareceu/mudou de ID durante atualização, retornar à categoria com explicação e sem exibir detalhe antigo.

## 4. Máquina de navegação e resposta

`machine.mjs` implementa uma **máquina pura experimental** com `authorized`, `epoch`, `view`, `category`, `selected`, `detailOrigin`, `focusIntent`, `sections.profile` e `sections.inventory`. Não existe browser, sessão, API, persistência, conta real ou banco nessa implementação.

### Transições essenciais

| Situação | Evento | Resultado esperado |
|---|---|---|
| Sem sessão | qualquer navegação | sem abertura de dados; aguardar autenticação |
| Sessão confirmada pelo adaptador externo | `AUTH_ESTABLISHED` | nova época, dados descartados, iniciar em Personagem |
| Seção solicita atualização | `FETCH_STARTED` | estado `loading`, dados dessa seção limpos; detalhe deixa de ser exibido se for Inventário |
| Retorno `ready` na época/requisição correta | `FETCH_FINISHED` | dados projetados são armazenados; seleção preservada somente se `{category,slot,id}` ainda coincide |
| Resposta antiga/troca de sessão | `FETCH_FINISHED` antigo | ignorar integralmente |
| Retorno `restricted` | `FETCH_FINISHED` | dados/sujeito e detalhe limpos; explicar indisponibilidade sem expor causa sensível |
| Retorno `not_initialized` | `FETCH_FINISHED` | mensagem de configuração/estado pendente, **sem inicializar linhas** |
| Retorno `unavailable` | `FETCH_FINISHED` | não renderizar detalhes; oferecer tentativa de consulta novamente sem afirmar estado do jogador |
| HTTP 401 (sinal traduzido pelo adaptador) | `unauthorized` / `AUTH_LOST` | limpar **ambas** as seções e toda a sessão local |
| Item selecionado | `SELECT_ITEM` | marca categoria, slot e id, se existir na projeção pronta |
| Item inspecionado | `OPEN_DETAIL` | detalhe de leitura e intenção de foco no título |
| Voltar | `BACK` | retornar à categoria, seleção e intenção de restaurar foco; depois voltar a Personagem |
| Logout | `LOGOUT` | apagar seleção, dados, foco antigo e época anterior |
| Ação desconhecida | evento não reconhecido | nenhuma mudança; **nada de regras paralelas** |

A camada autorizadora real não está implementada aqui: `authorized` é **uma condição de teste fornecida pelo adaptador**, não uma checagem de segurança. A segurança de produção deve continuar sendo server-side, com sessão do ator revalidada antes e depois da consulta, conforme candidato CP014.

## 5. Estados e mensagens — proposta editorial, não tradução canônica

| Estado | Texto UX candidato | Conduta de dados |
|---|---|---|
| loading | “Consultando seu personagem…” ou “Consultando pertences…” | conteúdo da seção não permanece visível |
| ready | conteúdo real, atualizado em `asOf` se disponível | exibir **somente** dados da projeção allowlist |
| restricted | “Esta informação não está disponível para consulta agora.” | não revelar se é banimento, morte, status de início ou outra regra |
| not_initialized | “Esta parte da conta ainda não está preparada para consulta.” | não disparar inicialização, não inventar slots ou missões |
| unavailable | “Não foi possível apresentar estes dados neste momento.” | sem dados anteriores; nova tentativa manual opcional |
| HTTP 401 | “Sua sessão terminou. Entre novamente.” | esvaziar todas as seções e estado local |
| detalhe sem arte/catálogo | “Representação indisponível” ou “Item do acervo — categoria/posição” | manter atributos verdadeiros e preservar fonte/ID para lookup confiável |

A diferença entre `restricted` e `unavailable` não deve necessariamente revelar a causa interna, apenas orientar o jogador de maneira segura. Mensagens devem ser testadas com jogadores antes de homologação.

## 6. Critérios de aceitação do slice (ainda não homologados)

### Condições técnicas verificáveis em laboratório (modelo de navegação)
- Não permite navegação a dados antes de sessão sinalizada.
- A seleção é categoria+slot+ID, aceita ID 0, diferencia duplicatas.
- Inspeção e retorno preservam referência e intenção de foco.
- Seleção inválida não abre detalhe.
- Alteração de categoria limpa a seleção corrente.
- Mudança de sessão e logout apagam tudo.
- Atualização `restricted/not_initialized/unavailable` não deixa conteúdo anterior.
- Respostas antigas não substituem novas.
- Perfil não recebe `keycloakId` ou nome fabricado; dados com campos privados conhecidos são rejeitados no **modelo de laboratório** (a projeção de servidor precisa fazê-lo independentemente).
- Não existe transição para Equip/Sell/Drink.

### Condições para fechar UX-001 no produto (pendentes)
- Uma validação qualitativa com jogadores reais, usando tarefas (identificar nível/classe, encontrar item duplicado, inspecionar/voltar, reconhecer estado restrito e atualização); registrar taxa de conclusão e dificuldades, sem declarar sucesso antes de realizar.
- Testar foco de teclado, leitor de tela, touch targets, mensagens dinâmicas, scroll e reduced motion em DOM real em mobile e desktop. Intenção de foco do modelo não prova foco real.
- Catálogo oficial para nomes/imagens/descrições ou fallback editorial explicitamente aprovado; origem de **nome público do personagem ainda precisa ser identificada**.
- Validação da fonte de item, ranking, efeito, atributos e estados em MariaDB/Core de teste (CP027 0/12), sem criar linhas ou alterar jogador.
- Sessão WhatsApp/Keycloak/OIDC real, revogação, isolamento e autorização positiva/negativa; CI executado com runner.
- Crítica artística independente quando a arquitetura tiver aprovação de produto: Constance/Twisted/Memento/Pokémon Beyond, sem copiar IP alheia.

## 7. Crítica adversarial desta versão

**O que funciona como proposta:** contratos nativos viraram decisões concretas; estabelecemos o fluxo de retorno e os estados não intercambiáveis; não há interface de fantasia fingindo API. Testes do modelo são reproduzíveis e isolados.

**O que não funciona ainda:** a própria arquitetura precisa ser confrontada com jogadores; o perfil pode ficar pobre sem um nome público validado; a busca textual depende do catálogo e localização; elementos de artes/design ainda não foram escolhidos; a prova não executa DOM, API, MariaDB ou autenticação. O modelo não é um sanitizador universal, apenas rejeita algumas chaves privadas conhecidas sobre um DTO supostamente já projetado por um servidor confiável.

**Decisão:** aceitar este arquivo apenas como **contrato UX candidato v0.3**, com gate UX-001 ainda **PARCIAL**. Não promover a design system, homepage definitiva ou integração.

## 8. Execução local e rastreabilidade

```
node --test machine.test.mjs
```

`machine.test.mjs` usa apenas fixtures sintéticas e tem 29 testes determinísticos com Node 22, verificando estados, seleção, retorno, concorrência de respostas e limpeza. **Não** são testes MariaDB, testes de acessibilidade DOM ou testes com usuários. `manifest.json` contém SHA-256 dos arquivos e `test-results.tap` o resultado.

**Próximo trabalho exato:** construir uma *matriz de tarefa observável e roteiro de teste qualitativo* (sem aparência final), confirmar a fonte para nome do jogador e catálogos traduzidos; integrar isso à checklist e ao diário. Em paralelo técnico separado, continuar CP027/CI — sem tocar no bot, banco ou produção.
