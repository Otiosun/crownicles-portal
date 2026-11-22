# CP041 — revalidação da sessão após leitura (candidato isolado)

**22/11/2026 — laboratório; nenhum deploy, merge, banco, Keycloak, bot ou sessão real.**

## Defeito demonstrado

O CP040 original verificava o sujeito uma só vez antes de consultar o leitor. Dois cenários de falha foram reproduzidos em cópia descartável do pacote CP040: (1) sessão revogada durante o `readSnapshot`; (2) token que passa a apontar para outro ator. O código anterior devolvia `200` com dados lidos sob a autorização inicial. Os novos testes **reprovaram antes da correção (2 falhas intencionais)**.

O CP014 original já estabelece a ideia de conferir a sessão **antes e depois** da consulta em `gateway/session-gateway.mjs` por `verifyFreshSession`; a auditoria desta frente recuperou CP012 e CP014 de seus arquivos originais no Drive e reexecutou **71/71** e **83/83** testes de laboratório, respectivamente. Esta proteção do CP041 fecha a lacuna específica na fronteira CP040, mas **não integra CP012 ou CP014 ao endpoint**.

## Mudança de contrato

`createPortalReadBoundary` agora exige por padrão que `resolveVerifiedSubject(credentials, {signal,phase})` devolva prova **vinculada à sessão**, `{actor, bindingRef, bindingEpoch}`:

- `actor` é UUID validado, não NIL. É o **único** campo de identidade enviado ao leitor.
- `bindingRef` é identificador opaco, não vazio, sem controles/whitespace, com até 256 unidades de texto. **Nunca** serializado para o cliente nem passado para `readSnapshot`.
- `bindingEpoch` é inteiro seguro >= 0 e deve mudar após troca/revinculação de sessão.
- `phase` vale `before-read` ou `after-read`; ambos os passes precisam verificar autenticidade, revogação e binding em **estado autoritativo atualizado**, sem reutilizar um resultado em cache.
- O código compara ator, referência, época e formato da prova. Mudança, nulidade, erro, timeout ou inconsistência após a leitura devolvem `401` com `{state:'unavailable'}`, **sem** payload anterior.
- Um sinal de desconexão durante essa etapa devolve `503`, aborta o verificador e não transmite dados.
- Testes legados com resolvedores que retornam apenas UUID usam explicitamente `allowUnboundMockSubjects:true`; seu padrão é **false**. Isso é **escape de fixture, nunca configuração admissível de produção**.

Esta checagem elimina a resposta stale quando o verificador reflete revogação/troca de vínculo; **não impede** revogação após a segunda checagem e antes do envio HTTP, não homologa OIDC/JWKS nem prova que a conexão ao SQL foi encerrada. A implementação futura precisa cumprir o contrato com ledger de sessão, binding e epoch, validar revogação e conta SQL SELECT-only.

## Evidência reexecutável

```sh
node scripts/reproduce-cp040.mjs
```

Com Node 22.16.0 e TypeScript 5.8.3 no laboratório: **132/132 testes locais PASS**, incluindo 9/9 blobs base Git SHA-1 verificados pelo executor. São os 116 testes CP040/CP035 originais + **16 regressões CP041** de revogação, troca A/B, binding epoch, troca de referência, prova inválida, getters hostis, exceção, timeout, desconexão, identidade e política default strict.

O pacote original CP012 foi regenerado e testado `71/71`; o CP014 foi regenerado e testado `83/83`. **Essas baterias são independentes**: não somar 71+83+132 para afirmar que executamos um teste de Core/MariaDB/Keycloak ou que o P0 já funciona com dados reais.

## Fonte e escopo

- Base: [PR #6 CP040](https://github.com/Otiosun/crownicles-portal/pull/6), branch `security/read-boundary-candidate-20261122`.
- CP014 nativo: Drive ID `1dMo8dZVsm9sH-9OH5OMZfSTWr3ZZ4flE`, `gateway/session-gateway.mjs`, `gateway/identity.mjs`.
- CP012 nativo: Drive ID `1ksMlpV-p91V4vOtD2u8JCCG_Xymn38go`.
- Upstream Core fixado: `Crownicles/Crownicles@64d08c05f11949029317341735f6f73024f19f9b`.
- `web/`, Core original, bot, banco de jogadores e branch `main`: não alterados.
- **Não** foram adicionadas as seções `profile`/`inventory` ao CP040. O baú (`chest`) é diferente do inventário do jogador; rastreado na [issue #8](https://github.com/Otiosun/crownicles-portal/issues/8).

## Gates ainda bloqueantes

- [CP027 MariaDB nativo 0/12](https://github.com/Otiosun/crownicles-portal/issues/2): nenhuma query MariaDB real executada.
- [GitHub Actions pré-runner](https://github.com/Otiosun/crownicles-portal/issues/3): não considerar CI aprovado enquanto não houver etapas/logs/runner.
- [Keycloak, HTTPS e sessão reais](https://github.com/Otiosun/crownicles-portal/issues/7): callback injetado **não** é autenticador criptográfico.
- Core nativo (Node >=24, pnpm10, TS6, MariaDB, patches Sequelize fixados): ambiente não homologado. O laboratorio de Node22/TS5.8 compila apenas fixtures.
- Sem testes com jogadores reais, sem UI integrada e sem aceite visual.

**PR permanece DRAFT e sem deploy. Não mesclar diretamente ou conectar dados reais.**
