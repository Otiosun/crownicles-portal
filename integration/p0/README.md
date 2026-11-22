# CP041 — CP012/014 → UX-P0-003 read-response bridge

**Laboratório isolado. Não é gateway nem autenticação de produção.** Este diretório adiciona um adaptador de envelopes de resposta, verificador estrito do DTO projetado e testes. Não altera a máquina de navegação `lab/ux-p0-003/machine.mjs` nem CP040. `chest` é baú da moradia e **não** é inventário pessoal.

## Fontes verificadas

- Core 6.2.0.b **pinado** `64d08c05f11949029317341735f6f73024f19f9b`.
- Lib `CommandProfilePacket.ts`: Git blob `cc96dd50d679c6be2f3fc9487c6294b3c2518389`.
- Lib `CommandInventoryPacket.ts`: Git blob `5b1f291a8e9804522ca46703537dd097f51ed781`.
- Core `ProfileCommand.ts`: Git blob `554c1f5e1a75e374609cd89ded5a94ca0ee46250`.
- Core `InventoryCommand.ts`: Git blob `0b17bd02092ec1b22ee32325db42199f6229e346`.
- Pacote CP012 original preservado no Drive, SHA256 `edeff51402b55638818971b4dea75ad894120633d224b9e3c1315958ba11eb1b`.
- Pacote CP014 original preservado no Drive, SHA256 `f74efef74fb65672a20d7f4d6d12378fd1bbaa4729ce7581e458c58bf0125e43`.
- O ensaio cruzado importa **os arquivos originais não modificados** do CP014, checando SHA256 `987e61c2974eaeeeb510468e2e6fbd877cfb40959807741dec88655f5e74718f` (`gateway/projection.mjs`) e `d5edb262a6ef460294e996f27c8f37d55a6cb200256f7ed3d9b49b38d588bae2` (`gateway/fixture.mjs`). Essas fontes NÃO são vendorizadas neste PR.

## Contrato de integração, não substituição

1. Servidor autenticado/autorizado (ainda não ligado) resolve sujeito **antes** de obter CP014 snapshot. O navegador nunca envia actorId, askedPlayer, keycloakId, guildId, homeId ou seleção de conta como autorização.
2. CP014 autorizado devolve `{status, body:{state, asOf, data?}}`, com `projectProfile` ou `projectInventory` já aplicados no servidor. A resposta HTTP 401 vigente indica perda de sessão. Este adaptador **não aceita pacotes nativos brutos como prova de autorização**.
3. `projection-guard.mjs` valida ESTRITAMENTE os campos de cada DTO CP014 (incluindo atributos aninhados, tipos, máximos discriminados e slots únicos), antes de entregar `ready` à máquina UX. Isso reduz erros de integração/exposição acidental no cliente, mas **não converte o cliente em controle de acesso**. O servidor continua devendo realizar allowlist, autenticação e autorização.
4. `startRead(state, section, requestId)` prepara a época da sessão e remove dados antigos. `finishRead(state, token, envelope)` gera `FETCH_FINISHED` para a máquina UX. Respostas obsoletas por `epoch/requestId` são ignoradas.
5. `ready` usa os dados já sanitizados; `restricted`, `not_initialized` e `unavailable` não possuem payload de jogo. Payload malformado, estado desconhecido, erro HTTP ou data suspeita é convertido para `unavailable`. `401` limpa **a sessão inteira** se corresponder à requisição atual.
6. `id=0` em slot ativo continua válido. Seleção é `{category,slot,id}`; slots são capacidade. `maximum:{kind:'unbounded'}` não vira número fictício. Plantas e talismãs `not_reported` não viram falsos/zero. Sem nomes de itens/arte inventados nem nome público derivado de keycloakId. Nenhuma ação de equipar/usar/vender.
7. Somente seções `profile` e `inventory` são aceitas. O CP040 v1 continua independente com `pet,garden,property,chest,pantry`; sua allowlist **não** foi alterada. Integração produtiva exigiria contrato versionado e auditoria de segurança.

## Reproduzir

```sh
# Na raiz deste PR (Node 22+, sem dependências externas):
node --test integration/p0/response-bridge.test.mjs integration/p0/projection-guard.test.mjs

# Extrair o CP014 original a partir do ZIP privado, SEM editar os arquivos.
# Teste cruzado exige fonte exata; não faz fallback para cópia artificial:
CP014_GATEWAY_DIR=/caminho/CP014/gateway node --test integration/p0/compat-cp014.test.mjs
```

**Evidência da rodada de 22/11/2026:** 23/23 testes independentes da ponte, 53/53 testes do verificador estrito (incluindo 1.600 mutações determinísticas), 18/18 testes cruzados CP014 original + máquina UX e 83/83 testes do gateway CP014 reexecutados separadamente. São **94 novos testes CP041** e **83 históricos reexecutados**, não 177 testes inéditos. Não há prova de browser HTTP real, autorização do Core/MariaDB, OIDC/Keycloak, revogação produtiva ou CI; a UX/arte permanece em avaliação.

## Bloqueios e propriedade da mudança

Sem merge, deploy, servidor ativo, banco, WhatsApp, credenciais ou dados reais. Não altera `web/`, `Core/`, `main`, PRs #1/#4/#5/#6 nem regista endpoints. CP027 MariaDB 0/12; CI GH Actions sem runner; autenticação real e catálogo PT-BR ainda dependentes. A especificação de foco/retorno permanece de UX-P0-003, e a UX-P0-007 precisa de teste humano com leitores de tela. O adaptador não comprova isolamento de proprietário por si só: a confiança no CP014/server é uma pré-condição, nunca um substituto do controle de acesso.
