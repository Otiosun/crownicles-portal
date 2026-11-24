# CP062 — laboratório P0 composto + navegador TLS nativo

Base PR40 8210f76b7a6c68d115cd52a8b725308be5a7e167, já inclui PR39/CP059 e CP061 (239 casos P0). Importa somente teste CP060 blob 09bdd6331479f3c5edca41a274563ef883f6b2e9 e documento da PR41 HEAD8dbf249ef598e631f64ea5a7e13d6025abf2d36d, sem workflow experimental. O gate antigo permanece inalterado e declara BROWSER_TLS=NOT_TESTED. Novo gate explícito exige o gate anterior inteiro e uma prova separada de rede HTTPS nativa com os 36 checks por nome e ordem, saída zero, nenhum marcador de falha. Piso combinado 239 + 16 + 415 + 1 + 36 = 707 verificações heterogêneas (não 707 testes únicos).

## Execução descartável

Node 22.16, npm, Python 3, Playwright 1.57.0, Chrome/Chromium instalado (testes históricos esperam /usr/bin/chromium), OpenSSL, curl e certutil. Instale dependências de desenvolvimento conforme package.json em checkout descartável, depois `npm run check` e `npm run gate:p0:lab:native-browser`. O teste usa CA/NSS e identidades fictícias, não toca trust store global. Nunca executar com dados ou credenciais de produção. Não incorporar workflow de diagnóstico CP060/CP062 na main.

Prova independente CP060: run45475068335, job138732992985, Chrome157.0.8103.78, Node22.16.0, 36/36. A composição exige nova execução completa antes de review; contagem não comprova assinatura, SameSite cross-site enforcement, OIDC, WA, MariaDB GAME/LOGS, Core wire, deploy nem arte/licença. Gates produtivos não promovidos automaticamente.

## Diagnóstico de composição

Candidata inicial 8e9c5bbc: CI normal 429 execuções PASS. Execuções CLI combinadas 45475642760 e 45476098719 falharam na bateria histórica Chromium (P0=239 e HTTPS=16 PASS). Diagnóstico browser direto 45475844734 passou 415/415. Run 45476351071, job 138737488843, executou o mesmo módulo CP062 por função com executor real instrumentado (spawnSync, sem modificar respostas): 239+16+415+1+36=707, exit 0. Não prova estabilidade das duas execuções CLI anteriores; a causa específica continua desconhecida. A melhoria de diagnóstico desta revisão apenas relata stage, exit, marcadores completos, tipo de exceção e basename/linha dos testes em falhas, sem imprimir conteúdo bruto. Nenhuma asserção relaxada.
