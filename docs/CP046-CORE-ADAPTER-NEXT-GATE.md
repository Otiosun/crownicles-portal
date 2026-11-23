# CP046 — fronteira exata para conectar Core e identidade nativos

**GATE FECHADO** (2026-11-22). Contrato de revisão para um integrador autorizado. Não é código executável, credencial, endpoint de produção nem permissão de merge.

## 1. O que já foi testado

PR #16 [CP046](https://github.com/Otiosun/crownicles-portal/pull/16) integra sessão **CP014 protótipo SQLite**, leitura HTTP local, projeção nativa CP045, validação de DTO e máquina UX. Bateria 215/215 Node22 com fixtures; as consultas TypeScript candidatas CP012 e CP014 foram executadas **sobre ORM em memória**, retornando seus packets para CP046 HTTP, com 78/78 e 87/87 testes separados.

## 2. Interfaces do gateway, não mecanismos de segurança reais

```ts
createP0NativeReadGateway({
  resolveFreshSession: async ({token, signal, phase}) => ({
    actorId, bindingRef, bindingEpoch, expiresAt
  }),
  readNativeOwn: async ({actorId, section, signal}) => ({
    actorId, state, packet // only the current authenticated actor
  }),
  clock, authTimeoutMs, readTimeoutMs
})
```

As duas fases de `resolveFreshSession` exigem consulta **independente** à fonte autoritativa de sessão/vínculo/revogação. `bindingRef` tem 64 dígitos hexadecimais; `actorId` é UUID não nulo; `bindingEpoch` é inteiro >=1; `expiresAt` é instante numérico futuro. Mudança de qualquer componente ou expiração entre fases **invalida resposta**. Não aceitar JWT decodificado sem assinatura/issuer/audience/exp/nonce e revogação atual. Não manter prova de sessão em cache entre fases.

O handler aceita somente GET com cookie `__Host-crownicles_session`, caminhos fixos `/v1/me/profile` ou `/v1/me/inventory`. `chest` CP040 pertence à moradia e não substitui inventário CP012. ID fornecido pelo browser **não** é permitido. Respostas exigem no-store e objeto-projeção explícito; não enviar packet, ator, token, segredo ou erro SQL ao cliente.

## 3. Consultas reais necessárias

As candidatas transpiladas possuem os contratos existentes:
- `PortalInventoryQuery.readExistingInventoryForPortal(authenticatedKeycloakId: string, transaction: Transaction)` (CP012).
- `PortalProfileQuery.readExistingProfileForPortal(authenticatedKeycloakId: string, transaction: Transaction)` (CP014).

Ambas devem ser portadas e compiladas contra o Core e Lib **no mesmo checkout pinado** `Crownicles/Crownicles@64d08c05f11949029317341735f6f73024f19f9b` com Node24/pnpm10.34.3/TS6.0.3 e patch oficial de Sequelize6.37.8. O adaptador do servidor mapeia `actorId` comprovado → `authenticatedKeycloakId` **sem aceitar target do usuário**. Uma única transação **somente leitura, REPEATABLE READ**, para cada read e exclusivamente proprietário. Distância entre `readNativeOwn` e SQL/Sequelize deve ser medida para detectar qualquer consulta sem transação, leituras de outros jogadores ou mutações. Caso status nativo seja restricted/not_initialized/unavailable, não incluir `packet` privado.

`AbortSignal` é um limite da API CP046, mas as duas candidatas TypeScript originais recebem apenas `transaction`, não signal. **Ainda não existe prova de cancelamento SQL**: adicionar mecanismo nativo de timeout + cancel/rollback com drenagem da conexão antes de considerar operação cancelada. `Promise.race` do gateway evita publicar uma resposta atrasada, mas não interrompe query ignorando o signal.

## 4. Gate sequencial de aceitação (não pular)

1. Verificar SHA de Core, Lib, lockfiles, Sequelize patch e dependências, compilar Node24/TS6 (G1).
2. MariaDB privado **descartável** com credenciais exclusivas, isolamento de DB GAME/LOGS e SELECT-only, nunca executar migrations/testes destrutivos contra jogadores (CP027, **0/12**).
3. Ligar `resolveFreshSession` a Keycloak/OIDC e autoridade de binding/epoch com revogação multi-processo, provar troca A→B durante query e 401 atrasado.
4. Ligar `readNativeOwn` às duas consultas reais com propriedade por ator e verificar consultas/logs/rollback; injetar cancelamento de query e testar timeout/disconnect.
5. HTTPS reverso real: `Secure; HttpOnly; SameSite`, validação Host/Origin/Fetch Metadata e proibição de HTTP público. A factory `createP0NativeLabServer` **nunca** pode ser instalada como servidor de produção; ela permite apenas bind explícito em 127.0.0.1/::1, comprovado pelo fix CP046-C.
6. CI GitHub Actions com runner efetivo. O último run do PR#16 (`45093873610`) terminou sem `steps`, portanto **não é teste verde nem falha da suite**. Checar anotações da conta/actions billing/policy; não rerodar cegamente.
7. Verificação humana T01–T06 e TalkBack/NVDA em HTTPs autorizado. Resolver nomes, itens, imagens e licença a partir de catálogo canônico, sem derivar nome público de KeycloakId.

**Condições de não lançamento:** qualquer item acima não provado = DRAFT, sem merge/deploy e sem dados reais. Provas offline: [CP046 215 testes](https://drive.google.com/file/d/17y8XSwG1U09djGCspFUYdq2MlEqpKRqS/view?usp=drivesdk) e [consultas nativas CP012/CP014 R5](https://drive.google.com/file/d/1-tCaw058JW0ogc6b-e2TiH57x_vCo6Ht/view?usp=drivesdk), cópias remotas verificadas byte a byte.


## 5. Proveniência e licença de código nativo

O repositório original [Crownicles/Crownicles](https://github.com/Crownicles/Crownicles/tree/64d08c05f11949029317341735f6f73024f19f9b) inclui uma licença **GNU Affero General Public License v3.0** (`LICENSE` Git blob `ada1a8176b23b97e70d89300c3f06c3c471bec2c`). Os módulos CP012/014 e o pacote de reprodução preservam trechos derivados do projeto original para avaliação técnica. Antes de distribuir alterações, oferecer o portal em rede ou incorporar arte/traduções/recurso original, validar as obrigações da licença e proveniência de cada componente com o responsável jurídico/técnico. A conclusão dos testes funcionais **não** valida licenças, autoria ou direitos de imagens/sons.
