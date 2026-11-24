# CP057 — composição das correções CP056 (LAB)

Base PR30 a4a55f37ac9f858afdae9ed58bcd79377b32f527. PR32 439d75d7bf74ff2bdcf7f64caa45fbb01b6ba656 (único parser), PR33 234e710b858b8f36b3328964950f48dc59c33f6a (cancelamento de link), PR35 c3a7d45a3eb68a5a84ede26ee602756018af5b3e (zoom). PR34 fechada sem merge: não incorporar seu parser. Reserva CP057-COMPOSE-20261124T1529Z.

## Composição e QA
Checkout integral reconstruído por blobs Git verificados; 132 caminhos de origem, 137 antes deste documento, sem remoções. Dez diferenças CP056 sem colisões. Preservados os oito blobs CP056 não relacionados ao gate. Quatro arquivos de integração: package.json inclui zoom, scripts/run-p0-tests.mjs inclui regressão de cancelamento, parser PR32 preservado com pisos 221 P0 e novo marcador zoom 130, testes do gate ajustados e dois testes adversariais adicionais. Nenhum caminho de produção, Core, WhatsApp, MariaDB, CI ou arte alterado.

Node 22.16.0, npm 10.9.2. npm run check exit 0: import audit PASS, web 43/43, integration 24/24, tools 94/94, P0 221/221, zero fail/skip. Total 382 execuções (11 testes link repetidos em tools/P0; não são 382 casos únicos). Gate unit 25/25. npm run gate:p0:lab exit 0: P0 221, HTTPS 16 (Node + CookieJar Python), Chromium 415 (285 + zoom 130), preview HTTPS 1, soma heterogênea 653. Primeira tentativa interrompida pelo executor após P0 e HTTPS, não contada. Segunda execução completa com exit 0 observado.

## Limites
Candidato draft, sem merge/deploy. Não confundir Chromium DOM/fixtures com autenticação ou cookie TLS no navegador real. Não homologar Core Node24/TS6, MariaDB GAME/LOGS, MQTT ACL, WhatsApp, OIDC, CI runner nem ART01. Todos gates nativos OFF. Próximo passo: review independente da árvore composta e integração coordenada das evidências CP058; não reaplicar PR32/33/35 separadamente.
