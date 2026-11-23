# CP046 R5 — consultas nativas CP012/CP014 até o gateway HTTP do portal

**22/11/2026 · laboratório isolado, candidato de revisão. Sem merge/deploy; gates produtivos OFF.**

## Por que esta prova é diferente

O CP046 já exercitava sessão SQLite original CP014 e o gateway HTTP usando pacotes sintéticos. A prova R5 usa **as consultas candidatas de Inventário CP012 e Perfil CP014 regeneradas do TypeScript original** dentro dos harnesses de testes originais, executando as consultas sobre modelos em memória e encaminhando seus retornos pelo projetor CP045 e pela rota HTTP CP046. Assim, é possível testar a forma da resposta da consulta e sua passagem até o contrato do portal sem fingir que existe MariaDB real.

Originais imutáveis: CP012 SHA256 `edeff51402b55638818971b4dea75ad894120633d224b9e3c1315958ba11eb1b`; CP014 SHA256 `f74efef74fb65672a20d7f4d6d12378fd1bbaa4729ce7581e458c58bf0125e43`. Fonte Crownicles/Crownicles oficial pinada em `64d08c05f11949029317341735f6f73024f19f9b`. Módulos P0 são os mesmos da branch CP046 PR#16, inclusive o bloqueio de escuta não-loopback.

## Pacote binário reproduzível

[Drive CP046 R5 Native → HTTP](https://drive.google.com/file/d/1-tCaw058JW0ogc6b-e2TiH57x_vCo6Ht/view?usp=drivesdk), 232.115 bytes, SHA256 `a2af203b43b19fef3b20670feb07e41eda34ee76cdcc936b0394b3c768605070`. O download foi comparado byte a byte ao pacote local após upload. O ZIP preserva originais e patches versionados separados; `verify_cp046_native_http.py` confere 16 hashes, extrai os pacotes em dois diretórios temporários, aplica CP045 e CP046 na ordem, regenera os candidatos com TypeScript5.8, executa as baterias Node e apaga o scratch.

| Harness | Testes executados | Resultado |
| --- | ---: | --- |
| CP012 InventoryQuery TS → CP045 → CP046 HTTP | 78 | 78/78 PASS, 0 skip |
| CP014 ProfileQuery TS → CP045 → CP046 HTTP | 87 | 87/87 PASS, 0 skip |

O novo teste em cada harness chama `createP0NativeLabServer` com porta efêmera **e host explicitamente 127.0.0.1**, um cookie sintético e identidade sintética, verifica `200 ready`, o item/money esperado e ausência de IDs privados, sem escrever em banco. Os 78 e 87 casos são suítes **separadas**, com sobreposição histórica ao CP045; não somá-los como se fossem casos novos do conjunto de 215.

## CP046 versão consolidada

[Drive CP046 R5 P0/UX](https://drive.google.com/file/d/17y8XSwG1U09djGCspFUYdq2MlEqpKRqS/view?usp=drivesdk), 209.587 bytes, SHA256 `ab40edc7993d20f1e4d845616dab4a7f84833aa2b569b0fb438e03861a851336`, idêntico após readback. Manifesto 45/45. Em pasta limpa: `npm run test:p0` 161/161 PASS e `node scripts/run-all-cp046.mjs` 215/215 PASS, 0 skip, Node22; estes 215 são a contagem dos testes locais distintos da composição versionada.

Três novos casos revelaram que `createP0NativeLabServer` permitia `listen(port)` sem especificar host, o que pode expor HTTP em wildcard. **RED: dois testes falharam na implementação anterior**. Agora só permite `listen` com `127.0.0.1` ou `::1` explícitos e rejeita endereço público/wildcard, sockets Unix e file descriptors. Testes GREEN 27/27 no gateway.

## Limites e próximos gates

**NÃO HOMOLOGADO**: Node24/pnpm10.34.3/TS6 do Core adaptado; MariaDB game/logs em laboratório privado; isolamento SQL real e políticas de transação/rollback/abort; Keycloak/OIDC real; TLS, proxy, cookies Secure e Host/Origin reais; HTTPS/browser TalkBack/NVDA e protocolo T01–T06; catálogo/nome oficial/licença artística. O GitHub Actions privado continua com job `web-contracts` sem `steps` e conclusão `failure` (run `45093873610`, HEAD `cdac276c...`); a causa não está comprovada. Não rerodar CI às cegas nem marcar CP027 (0/12) como concluído.

Nenhum ajuste em Core, bot, WhatsApp, Main, banco, autenticação produtiva ou dados de jogador. Apenas este PR DRAFT e pacotes de laboratório. O cliente visual ainda não tem validação humana/navegador HTTPS.
