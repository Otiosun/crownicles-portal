# CP056-SEC — Cancelamento concorrente de vinculação (LAB)
Base exata: PR30, a4a55f37ac9f858afdae9ed58bcd79377b32f527. Lease CP056-SEC-20261124T1420Z. Nenhuma homologação ou produção.

## Falha P1 de integridade de sessão
CP048 exige que o cancelamento não confirmado jamais seja apresentado como sucesso. O handler ignorava o retorno de cancelChallenge. O desafio podia estar consumido e a segunda consulta assíncrona de autoridade ainda em andamento. O cancelamento devolvia 200 cancelled e a finalização devolvia 200 redeemed, com sessão ativa. Não é bypass de confirmação privada: o teste começa com aprovação privada sintética legítima. O problema é um falso ACK de revogação.

## Delta mínimo de laboratório
A relação challenge_sessions liga exclusivamente o digest HMAC do desafio ao digest HMAC da sessão criada. A criação da sessão, consumo e vínculo ocorrem na mesma transação SQLite. Cancelar revoga somente a sessão proveniente daquele desafio e o estado do desafio na mesma transação. A resposta só é 200 quando o ledger confirma. Um desafio ausente ou legado consumido sem vínculo retorna 409 unavailable; o cliente CP048 já trata isso como não confirmado. Revogar um desafio antigo não revoga sessões independentes. FK ON DELETE CASCADE remove o vínculo na poda; depois da poda, cancelamento não é confirmável. Não há mudança de schema MariaDB/Core ou de cookie/TTL. A tabela é aditiva no laboratório, não é migração produtiva.

## Evidência local
Node 22.16.0, SQLite real, HTTP loopback, autoridades e IDs sintéticos. Blobs originais: identity 7e6234dbcf67af9379f96af9d31d0401e4e56f65, gateway 51edf2dd19b47b9710ef3248f5ad741d3a3d5ca8, projection 83e0bc523d7256ab4dfdc9e3af532ca5c4460098. Blobs candidatos testados: identity 940d7ebeab264b2d9d7907925987f45e02017569, gateway a29e4ef3838586ff3ad022a3e2c6a3872ae23b0e. Test blob cb4aea70a2da92ab3042198e27ed707e15a63ad1.
- RED mínimo: 2/3, falha determinística no interleaving após consumo.
- RED suíte expandida: 3/11; oito falhas, cinco de comportamento e três ligadas à ausência da tabela no original.
- GREEN: 11/11, sem skip. HTTP, duas ordens de cancelamento, emissão normal e replay, duas contas e dois desafios do mesmo ator, arquivo SQLite reaberto, linha legada sem vínculo, falha transacional induzida, prune.
- Reexecutar: node --test scripts/tests/cp056-link-cancel-race.test.mjs. Também incluído pelo glob de npm run test:tools / npm run check; não altera o gate TAP CP056 de outro trabalhador.

## Limites e próximo gate
Teste não representa browser TLS real, Keycloak/OIDC, WA privado real, MariaDB GAME/LOGS, Core Node24/TS6, checkout completo ou CI. Revisão independente e composição com demais PRs antes de promoção. Não combinar com patch concorrente de identidade. Todos gates nativos OFF. Sem merge/deploy/dispatch manual.
