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
- Os ensaios cruzados importam **arquivos originais não modificados**, conferindo CP012 `gateway/projection.mjs` SHA256 `6fc3a7212337cee57c78960f1507fe2ed9ee74b685115a99f2c2bc80257fabce`, CP014 `gateway/projection.mjs` SHA256 `987e61c2974eaeeeb510468e2e6fbd877cfb40959807741dec88655f5e74718f` e `gateway/fixture.mjs` SHA256 `d5edb262a6ef460294e996f27c8f37d55a6cb200256f7ed3d9b49b38d588bae2`. Essas fontes NÃO são vendorizadas neste PR.

## Contrato de integração, não substituição

1. Servidor autenticado/autorizado (ainda não ligado) resolve sujeito **antes** de obter CP014 snapshot. O navegador nunca envia actorId, askedPlayer, keycloakId, guildId, homeId ou seleção de conta como autorização.
2. CP014 autorizado devolve `{status, body:{state, asOf, data?}}`, com `projectProfile` ou `projectInventory` já aplicados no servidor. A resposta HTTP 401 vigente indica perda de sessão. Este adaptador **não aceita pacotes nativos brutos como prova de autorização**.
3. `projection-guard.mjs` valida ESTRITAMENTE os campos de cada DTO CP014 (incluindo atributos aninhados, tipos, máximos discriminados e slots únicos), antes de entregar `ready` à máquina UX. Isso reduz erros de integração/exposição acidental no cliente, mas **não converte o cliente em controle de acesso**. O servidor continua devendo realizar allowlist, autenticação e autorização.
4. `startRead(state, section, requestId)` prepara a época da sessão e remove dados antigos. `finishRead(state, token, envelope)` gera `FETCH_FINISHED` para a máquina UX. Respostas obsoletas por `epoch/requestId` são ignoradas.
5. `ready` usa os dados já sanitizados; `restricted`, `not_initialized` e `unavailable` não possuem payload de jogo. Payload malformado, estado desconhecido, erro HTTP ou data suspeita é convertido para `unavailable`. `401` limpa **a sessão inteira** se vier da mesma época autorizada, mesmo quando o requestId já foi superado (UX-P0-008); respostas de épocas anteriores não podem revogar sessões novas.
6. `id=0` em slot ativo continua válido. Seleção é `{category,slot,id}`; slots são capacidade. `maximum:{kind:'unbounded'}` não vira número fictício. Plantas e talismãs `not_reported` não viram falsos/zero. Sem nomes de itens/arte inventados nem nome público derivado de keycloakId. Nenhuma ação de equipar/usar/vender.
7. Somente seções `profile` e `inventory` são aceitas. O CP040 v1 continua independente com `pet,garden,property,chest,pantry`; sua allowlist **não** foi alterada. Integração produtiva exigiria contrato versionado e auditoria de segurança.

## Reproduzir

```sh
# Na raiz deste PR (Node 22+, sem dependências externas):
node --test integration/p0/response-bridge.test.mjs integration/p0/projection-guard.test.mjs

# Extrair o CP014 original a partir do ZIP privado, SEM editar os arquivos.
# Teste cruzado exige fonte exata; não faz fallback para cópia artificial:
CP014_GATEWAY_DIR=/caminho/CP014/gateway node --test integration/p0/compat-cp014.test.mjs

# Diferencial CP012 v. CP014: obrigatório usar os DOIS arquivos originais pinados
CP012_GATEWAY_DIR=/caminho/CP012/gateway CP014_GATEWAY_DIR=/caminho/CP014/gateway node --test integration/p0/compat-cp012-014.test.mjs
```

**Compatibilidade UX-P0-008 (22/11, após PR #4 avançar):** o PR #4 agora publica `lab/ux-p0-003/machine.mjs` com Git blob `70325ca829c5c2f6c9f3d3d025ba9e07157773ce` (UX-P0-008). O CP041 incorpora 5 regressões de composição com o módulo de origem atualizado, sem alterações em código da UX: 2 falhas reproduzidas na máquina anterior (401 obsoleto na mesma sessão e seleção perdida no refresh), seguidas de 118/118 PASS na versão atual. A rebase técnica no branch CP041 usa bytes exatamente iguais ao blob oficial da PR #4, não uma implementação alternativa. A execução original de 29+10 testes da UX-P0-008 também passou 39/39, independente dos 118.

**Evidência da rodada de 22/11/2026:** 23/23 testes independentes da ponte, 53/53 testes do verificador estrito (incluindo 1.600 mutações determinísticas), 25/25 testes cruzados CP014 original + máquina UX (incluindo HTTP loopback e 40 consultas simultâneas A/B) e 12/12 testes diferenciais CP012↔CP014 (incluindo 2.000 mutações determinísticas). São **118 novos testes CP041**, incluindo os 5 testes UX-P0-008 pós-atualização do branch. Baterias históricas reexecutadas à parte, sem somar como novos: CP014 gateway 83/83, CP014 candidatos 44/44, CP012 gateway 33/33 e CP012 candidatos 38/38. Esses conjuntos têm dependências/fixtures em comum e não são provas independentes de banco real. Não há prova de browser HTTP real, autorização do Core/MariaDB, OIDC/Keycloak, revogação produtiva ou CI; a UX/arte permanece em avaliação.

## Bloqueios e propriedade da mudança

Sem merge, deploy, servidor ativo, banco, WhatsApp, credenciais ou dados reais. Não altera `web/`, `Core/`, `main`, PRs #1/#4/#5/#6 nem regista endpoints. CP027 MariaDB 0/12; CI GH Actions sem runner; autenticação real e catálogo PT-BR ainda dependentes. A especificação de foco/retorno permanece de UX-P0-003, e a UX-P0-007 precisa de teste humano com leitores de tela. O adaptador não comprova isolamento de proprietário por si só: a confiança no CP014/server é uma pré-condição, nunca um substituto do controle de acesso.
