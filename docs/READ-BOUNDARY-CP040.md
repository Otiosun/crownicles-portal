# CP040 — fronteira de consulta do Portal (candidato, não implantado)

**22/11/2026 · laboratório · somente leitura · nenhuma rota ligada a servidor**

Incremento isolado, sem alterar Crownicles Core, bot, dados de jogadores, `web/`, `main` ou o PR visual. O módulo `integration/gateway/read-boundary.mjs` constrói uma resposta HTTP de laboratório; **não cria servidor, não implementa Keycloak e não abre banco**. Para virar endpoint, depende de dois componentes confiáveis, ainda não homologados.

## Contratos e autoridade

- Entrada: objeto `{method:'GET',url:'/api/portal/v1/read?sections=pet,garden',headers:{cookie:'...'}}` ou `Headers`. Saída: `{status,headers,body}`, sem escrita.
- `resolveVerifiedSubject({authorization,cookie})` precisa verificar assinatura, emissor, audiência, expiração, revogação e sessão do Keycloak **no servidor**. Não é permitido aceitar JWT apenas decodificado, ID de usuário informado pelo cliente ou token de demonstração.
- `readSnapshot({actor,sections,now})` precisa usar identidade do resolvedor, transação real consistente e somente leitura, credenciais SELECT-only, predicados de propriedade, limites de consulta e tempo. Integrar a `readPortalSectionsForServer` apenas em checkout isolado e após gates apropriados.
- `actor` vem exclusivamente do resolvedor de sessão verificada. Parâmetros/cabeçalhos com `actorId`, `userId`, `guildId`, `homeId`, `cityId` e similares **não conferem autorização** e não são encaminhados ao leitor.
- Antes de serializar, a resposta passa pelo `normalizeBundle` original em `web/contract-adapter.js`. A projeção copia somente propriedades permitidas e exige exatamente o conjunto de seções requisitado. Isso é **minimização de dados, não prova de propriedade**.

## Respostas previstas

| Condição | Código |
|---|---:|
| GET correto, sessão realmente verificada, snapshot íntegro | 200 |
| Sem cookie/Bearer, credencial inválida ou falha no verificador | 401 |
| Rota diferente | 404 |
| Método não GET | 405, `Allow: GET` |
| Query extra, seção duplicada, body, URL/header ambíguos, Bearer malformado, cookies duplicados ou cookie+Bearer simultâneos | 400 |
| Erro SQL, contrato inválido, seção extra/omissa, resposta excessiva | 503 |

Em requisições Node HTTP, o adaptador também consulta `IncomingMessage.rawHeaders` para rejeitar cabeçalhos `Authorization`, `Cookie`, `Content-Length` e `Transfer-Encoding` duplicados, pois o Node pode normalizar ou descartar credenciais repetidas silenciosamente. Um teste HTTP loopback reproduz esse comportamento adversarial. A integração futura com outros servidores HTTP deve fornecer informação equivalente ou checar duplicações antes da normalização.

O corpo de falha é sempre `{"state":"unavailable"}`; não contém token, ID, resposta SQL ou dados parciais. Todas as respostas incluem `Cache-Control: private, no-store`, `Vary: Cookie, Authorization`, `X-Content-Type-Options: nosniff` e `Cross-Origin-Resource-Policy: same-origin`, sem CORS permissivo. O teto é **128 KiB após projeção**; isso não substitui limites de queries, deadline ou memória.

## Testes reproduzíveis

```sh
node --test scripts/tests/read-boundary*.test.mjs
```

Há **51 testes Node locais aprovados** na mesma bateria: 39 cenários adversariais de fronteira, 4 cenários HTTP loopback, e 8 testes de integração com os quatro módulos TypeScript **reais** compilados em execução a partir da fixture do PR #1. A reprodução isolada foi feita com Node 22, TypeScript 5.8.3 e cópias byte a byte dos arquivos do PR-base; hashes Git conferidos:

- `PortalPropertyQuery.ts`: `8bd4916731abc776f578c562e77ca54f165ed285`
- `PortalGardenQuery.ts`: `ee186346b6a621619643e31949a876d2ee490720`
- `PortalCompanionsQuery.ts`: `d24acca86199cc9f5d94ffa8562fc79da703c479`
- `PortalReadBundle.ts`: `bf1f3f972401f79339c10721dfebb27bbdaf2b11`
- `integration/tests/fixture.mjs`: `43d3d8f3b93f408349bfdb3c51af75baa1d153d7`
- `web/contract-adapter.js`: `c70b2cde80df8542eff7630470091f05a4e088e4`

### Regressão cruzada com o PR-base

Após a bateria nova de 51 testes, foram reproduzidos também **36 testes pré-existentes** do PR #1, usando cópias com hashes Git originais verificados: `integration/tests/combined.test.mjs` (**15**), `integration/tests/native-projection.test.mjs` (**9**) e `web/tests/contract.test.cjs` (**12**). A execução conjunta, especificando os seis arquivos de teste sem incluir estudos avulsos do laboratório, resultou em **87/87 PASS, 0 FAIL** (TAP, ~1,81 s). Isso fornece evidência de não regressão do contrato antigo contra a nova fronteira, mas não equivale a executar todos os **43** testes web preexistentes nem o `npm run check` completo do PR consolidado.

Hashes das três suítes originais:
- `combined.test.mjs`: `67390b0a5179c849a217712bf0e2ff74c8587937`
- `native-projection.test.mjs`: `6661787bb251e340dfe25da8b0742d11fe26fcc9`
- `contract.test.cjs`: `319b88a3c2868a9c505b4926f2952ed89c73a122`

O comando local executado:

```sh
CROWNICLES_TYPESCRIPT_MODULE=/CAMINHO/para/typescript node --test \
  scripts/tests/read-boundary*.test.mjs \
  integration/tests/combined.test.mjs \
  integration/tests/native-projection.test.mjs \
  web/tests/contract.test.cjs
```

Resultado TAP: **51 testes novos, 51 pass, 0 fail** (em execução conjunta com 36 herdados, total 87/87). As oito integrações exercitam seleção dos cinco módulos, sujeito A vs. B, tentativa de forjar actorId, erro SQL, linha proprietária adulterada, estados restritos, ausência de consultas a tabelas não solicitadas, reutilização sem dados residuais e recuperação de erro sem vazamento. Os três novos arquivos de testes já entram no glob existente de `npm run test:tools`. Esses cenários usam **modelos simulados** e `resolveVerifiedSubject` simulado, não Keycloak/MariaDB. A suíte integral `npm run check` dessa branch e o runner GitHub Actions **não** foram aprovados; Actions ainda falha antes de executar etapas.

## Matriz de aceite para a próxima integração

| Gate | Estado em 22/11 | Evidência necessária para avançar |
|---|---|---|
| CP040-LAB — contratos de entrada/saída, isolamento via fixtures | **APROVADO LOCALMENTE 87/87** | Fontes versionadas e testes locais reproduzíveis; não é teste de banco real |
| CP040-CI — runner executa as etapas `npm run check` | **BLOQUEADO** | Workflow com runner, steps, logs e exit code reais; issue #3 |
| CP027-DB — MariaDB nativo e leitura SELECT-only | **BLOQUEADO 0/12** | 12/12 testes originais em ambiente descartável, transação repeatable-read e ownership verificados |
| CP040-CORE — TypeScript integrado no checkout Core fixado | **PENDENTE** | Compilação/typecheck nativos, importação legítima, sem registro de comando ou mutação |
| CP040-AUTH — sessão OIDC/Keycloak real | **PENDENTE** | Assinatura, emissor, audiência, expiração, revogação, cookies e troca de identidade testados no servidor |
| CP040-HTTP — transporte HTTPS e abuso operacional | **PENDENTE** | Duplicação de headers também no adaptador real, rate/byte/time budgets, cross-owner end-to-end e logs sanitizados |
| CP040-RELEASE — revisão técnica e visual | **NÃO AUTORIZADO** | Regressão completa, aprovação de segurança e aceite artístico separados; nunca inferidos dos mocks |

**Sequência recomendada:** resolver infraestrutura de CI e CP027 em paralelo; depois validar a integração Core/Keycloak/HTTPS em ambiente isolado; somente ao final considerar revisão para merge. Não criar novas telas para contornar esses gates nem conectar esta candidata a jogadores reais.

## Barreiras não dispensadas

1. **CP027: 0/12 MariaDB nativo** — executar em ambiente descartável com isolamento entre dois sujeitos, SELECT-only e transação real, além do typecheck nativo do Core.
2. Keycloak/OIDC real: validação criptográfica, emissor/audiência, expiração, revogação, cookies Secure/HttpOnly/SameSite e resistência a replay.
3. Prova real de propriedade de personagem, pet, baú, jardim e despensa sob manipulação maliciosa de parâmetros e identidades.
4. Roteador HTTPS real com limites de corpo, taxa, deadline, cancelamento, logs sanitizados, observabilidade, integração e testes de navegador.
5. Runner GitHub Actions funcional; revisão do código e aceite independente da direção artística.

**Não conectar ao bot, registrar rota pública, publicar, fazer merge nem considerar a fronteira uma proteção operacional** enquanto faltarem os gates.