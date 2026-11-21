# CP039 — Auditoria adversarial e limites honestos

## Evidências novas

1. **Incompatibilidade efetiva CP035 → CP038 no tipo `FoodStorage.id`:** original `Lib/src/packets/commands/CommandGuildStoragePacket.ts` declara `id!: string`; `PetConstants.PET_FOOD` usa quatro strings canônicas. O CP038 original rejeita todas as quatro por exigir `int(f.id,2000)`. Prova: teste antes/depois `regression-before-after.test.mjs` alimenta a projeção com as cinco saídas calculadas pelos candidatos, rejeita no original, aceita no atualizado.
2. **Sobrestoque legado:** `PortalGardenQuery.ts` do CP033 comenta explicitamente que conserva `quantity` acima da `gardenPlantStorageCapacity`. CP038 original tratava isso como corrupção; overlay preserva quantidade, aceita números inteiros não negativos e ainda rejeita valores negativos/inseguros. A UI de demonstração não oferece alteração de estoque.
3. **Ordem canônica:** `PetConstants.PET_FOOD_BY_ID` ordena [common, herbivorous, carnivorous, ultimate]; a definição da enum-like `PET_FOOD` tem [common, carnivorous, herbivorous, ultimate]. CP018 usava `Object.values` com `getFoodCaps` indexado por `PET_FOOD_BY_ID`. Hoje os limites centrais são iguais nas duas posições, logo não afirmar prejuízo econômico efetivo atual. Patch usa `PET_FOOD_BY_ID` e regressão testa limites diferentes (11 vs 21).
4. **Live loopback HTTPS:** o ambiente executou CP017 original e CP039 derivado. O endpoint `/v1/me/bundle` foi acrescentado somente ao **cópia** do gateway e usa o mesmo parser de cookies, política de método/origin, validação da sessão antes/depois e allowlist server-side CP038. Dois atores sintéticos receberam baús diferentes. Revogação durante a consulta retornou 401 sem liberar corpo. Falha de proprietário/ORM resultou em 503 genérico sem seções.
5. **UI única:** CP038 foi reconstruído com o adaptador corrigido, sem nova direção estética, sem mudanças em HTML/CSS/arte. 43 testes de DOM/contrato passam; arquivo totalmente offline sem HTTP.

## Limites e bloqueios

- **0/12 do gate MariaDB real**: sem `mariadbd`, cliente, checkout Core com dependências, Node24 e ambiente SQL descartável; DNS para pacotes indisponível. Rodar CP017/CP039 HTTPS **não** incrementa esta contagem.
- **Não é a integração completa de todos os sistemas**: leitores CP035 usam ORM simulado, embora código dos leitores reais seja transpileado e executado. Proteção por `WHERE ownerId` e transação é validada no fake, não no MariaDB. A cópia do gateway usa registro V31 real em SQLite, mas login externo OIDC/Keycloak e WhatsApp real não foram testados.
- **Somente laboratório**: o endpoint CP039 não faz parte da distribuição original CP017, nem do servidor real. Conclusões de auth ficam restritas ao cenário de runtime V31 sintético. Não é aceite de autorização em produção.
- **Projeção client-side não substitui servidor**: o servidor é responsável por jamais transmitir dados de outro ator. O novo endpoint de laboratório aplica allowlist e revalida sessão; isso é uma propriedade dessa composição, não garantia de uma futura implantação.
- **Foto/styling em aberto**: preservação dos cinco módulos CP038 sem novas artes. WeasyPrint/DOM VM não validam browser real, acessibilidade assistiva, toque, animações, nem fidelidade de dados de jogo. Arte CP036/037/038 não aprovada.
- **Risco residual**: paginar coleções, quotas/rate limiting, limites de payload, revogação externa, SELECT-only grant, transação real, importação TypeScript nativa e deadlocks precisam teste no Core compilado. O server HTTP local não testou esses cenários.
- **Dependência**: CP017 original usa `node:sqlite` experimental em Node22. Ambiente de testes é adequado ao harness, não prova Node24/produção. Em particular, `node --test` é distinto do teste Vitest nativo Core/MariaDB de CP027.

**Resultado:** os contratos agora se compõem em laboratório e uma falha real foi removida, mas não há autorização para deploy ou alteração de dados do bot.
