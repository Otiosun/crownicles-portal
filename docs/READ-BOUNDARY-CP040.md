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
| Query extra, seção duplicada, body, URL/header ambíguos ou cookie+Bearer simultâneos | 400 |
| Erro SQL, contrato inválido, seção extra/omissa, resposta excessiva | 503 |

O corpo de falha é sempre `{"state":"unavailable"}`; não contém token, ID, resposta SQL ou dados parciais. Todas as respostas incluem `Cache-Control: private, no-store`, `Vary: Cookie, Authorization`, `X-Content-Type-Options: nosniff` e `Cross-Origin-Resource-Policy: same-origin`, sem CORS permissivo. O teto é **128 KiB após projeção**; isso não substitui limites de queries, deadline ou memória.

## Testes reproduzíveis

```sh
node --test scripts/tests/read-boundary.test.mjs
```

Há **32 testes Node de fronteira + 3 cenários HTTP loopback** cobrindo autorização por sujeito, falsificação de IDs do navegador, credenciais inconsistentes, falhas de resolvedor/SQL, respostas parciais, consultas inválidas, cabeçalhos duplicados, serialização sanitizada e anti-cache. Os arquivos já entram no glob existente de `npm run test:tools`. A execução local isolada em Node 22 passou **35/35** com o adaptador real de projeção copiado byte a byte (Git blob `c70b2cde80df8542eff7630470091f05a4e088e4`); usa doubles de sessão e leitor, **não** Keycloak/MariaDB. Os **5 testes adicionais de integração** em `scripts/tests/read-boundary-integration.test.mjs` ligam a fronteira aos quatro candidatos TypeScript efetivos via fixture do repositório, mas **não foram executados nesta rodada** por falta de checkout completo nesse ambiente. Assim, existem 40 testes novos versionados, dos quais 35 têm execução local confirmada. O `npm run check` completo da branch e GitHub Actions continuam sem confirmação; Actions bloqueado antes do runner.

## Barreiras não dispensadas

1. **CP027: 0/12 MariaDB nativo** — executar em ambiente descartável com isolamento entre dois sujeitos, SELECT-only e transação real, além do typecheck nativo do Core.
2. Keycloak/OIDC real: validação criptográfica, emissor/audiência, expiração, revogação, cookies Secure/HttpOnly/SameSite e resistência a replay.
3. Prova real de propriedade de personagem, pet, baú, jardim e despensa sob manipulação maliciosa de parâmetros e identidades.
4. Roteador HTTPS real com limites de corpo, taxa, deadline, cancelamento, logs sanitizados, observabilidade, integração e testes de navegador.
5. Runner GitHub Actions funcional; revisão do código e aceite independente da direção artística.

**Não conectar ao bot, registrar rota pública, publicar, fazer merge nem considerar a fronteira uma proteção operacional** enquanto faltarem os gates.