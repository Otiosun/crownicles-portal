# CP061 — CP059 no gate P0 obrigatório

Base: PR39 commit `1e6a835dff2fca88940e1ba1a4f9803346908c98`.

Antes: `npm run check` executava CP059 por `test:tools`, mas `npm run gate:p0:lab` chamava `test:p0` com lista explícita sem as duas suítes CP059. Um gate verde de 221 casos não provava a regressão de reemissão.

Agora: ambos os arquivos CP059 entram na lista obrigatória do runner; o mínimo P0 sobe de 221 para 239. O parser estrutural TAP permanece intacto e o gate exige cada um dos 18 títulos CP059 exatamente uma vez. Contagem agregada sem o caso nominal não basta. O teste do manifesto compara os títulos aos dois arquivos reais e a inclusão no runner. Não há alteração de comportamento do gateway, UI, dados, banco, workflows ou autorização.

QA: `npm run check`, `npm run test:p0`, `npm run gate:p0:lab`. A última exige Chromium/Playwright e OpenSSL; se indisponíveis, não declarar PASS. O teste do gate usa evidências sintéticas para provar rejeição de substituição de nomes, duplicação, baseline antigo e CRLF. A prova nominal não autentica a origem de logs arbitrários. Nenhuma homologação de TLS real, OIDC, WhatsApp, Core ou produção.
