# Crownicles UX-P0-010 — integração visual de consulta

- `preview.html` é uma prévia **local**, derivada do laboratório UX-P0-007. Não tem dados sintéticos embutidos e não cria sessão.
- `controller.mjs` consome as respostas estritas do `createP0BrowserReader` (CP046), preserva a máquina UX-P0-008 e limpa dados locais em logout/erro/timeout. Não implementa login, banco, Keycloak, novo nome de item ou ação de jogo.
- A sessão deve existir **antes** da verificação, no servidor. Pressionar “Verificar sessão existente” nunca autentica por si só.
- `test_preview.py`: interface real via Chromium `page.set_content`, módulos ESM completos como `data:` URI (limitação do sandbox). 46 asserções.
- `test_http_bridge.py`: DOM Chromium → relay Python → HTTP Node no loopback com os módulos CP014/CP046 verdadeiros e dois atores sintéticos. 14 asserções, sem testar browser HTTPS/Cookie real.
- `test-http-server.mjs`: fixture **test-only**, servidor de ledger SQLite `:memory:`, sessões aleatórias, um protocolo de teste via stdin. NUNCA expor externamente ou fazer deploy.

No checkout do PR CP047, execute `python lab/ux-p0-010/test_preview.py` e `python lab/ux-p0-010/test_http_bridge.py` após instalar Playwright/Chromium. Node >=22 é necessário para o laboratório do CP014. O browser real desta sandbox tem navegação HTTP bloqueada por política, por isso o teste relay não prova cookies reais.

A prévia é estrutura de experiência, não direção artística aprovada para lançamento.
