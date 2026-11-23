# CP047 — primeira tela P0 alimentada por leitura HTTP protegida

**23/11/2026 · candidato isolado em laboratório; NÃO é lançamento, login novo nem novo design visual.**

## Corte executado

O CP046 (PR #16) entrega um leitor browser com contrato de estado, mas a única prévia navegável do P0-007 ainda usava `synthetic.profile` e `synthetic.inventory`. O CP047 extraiu o renderizador editorial de baixa fidelidade para `lab/ux-p0-010/controller.mjs`, conectando-o ao `createP0BrowserReader` real de CP046 e à máquina UX-P0-008 já fixada. Não importa nomes de item, imagens ou dados externos sem fonte canônica; não inclui comandos que modifiquem equipamentos, contas ou progresso. O HTML mantém a base responsiva do laboratório P0-007 com aviso de que o visual definitivo NÃO foi homologado. Ferramentas de simulação foram removidas da tela de acesso.

O navegador NÃO cria token, não lê cookie HttpOnly, não recebe `keycloakId`, não escolhe proprietário nem envia Authorization. A rotina de verificação faz tentativa de leitura `GET /v1/me/profile` por cookie `credentials:'same-origin'`, `cache:'no-store'`, e só apresenta o perfil após a máquina validar o DTO. Inventário é consultado pela rota fixa `/v1/me/inventory` ao entrar na seção. Seleção preserva `(category,slot,id)`, incluindo ID0 e IDs duplicados em slots distintos. Se a resposta é inválida, 401 ou não confirmou a sessão, a UI nunca afirma login e remove conteúdo anterior.

## Bugs de comportamento reproduzidos e corrigidos nesta integração

- **503 durante verificação inicial** antes deixava a navegação `authorized:true` apesar de não existir prova de sessão. A tela agora retorna ao modo não confirmado.
- **Logout 200 HTML**, ou `200 JSON` sem o discriminante exato `signed_out`, antes era apresentado como sessão revogada. Agora confirma somente resposta JSON válida e limitada a 1024 bytes, discriminante exato, e informa claramente quando servidor não confirmou revogação. Mesmo com falha, limpa conteúdo local imediatamente.
- **GET/stream pendente** e **logout sem resposta** deixavam UI presa. `readWithDeadline` cobre todo fetch+stream em 12s (padrão) e faz `AUTH_LOST`, invalidando epoch e abortando leituras. Logout tem prazo padrão 4s e limpa dados antes de tentar revogar servidor. Testes injetam 100ms, apenas em laboratório.
- **503 em atualização de Inventário**, com Perfil anteriormente carregado, retinha a outra seção. Agora o fluxo P0 inteiro é apagado após falha de consulta ou sessão incerta; restringir/não inicializado permanecem estados diferenciados quando o HTTP retorna DTO válido.
- Foco e teclado: retorno de inspeção restaura foco do item original com categoria/slot/ID sem deslocar conteúdo para um item homônimo.

## Evidências e limites

| Camada | Evidência |
| --- | --- |
| Chromium real com import ESM | 41/41 verificações automatizadas, incluindo 320,390,430,768,1440px; sem overflow; 401, 503, DTO malformado, tela não autenticada, logout e timeout |
| Chromium DOM → ponte de teste Python → Node HTTP loopback CP046 | 14/14 verificações; ledger SQLite original CP014; duas sessões sintéticas A/B, revogação A sem afetar B; logout B revogado por servidor |
| HTTP browser direto | **NÃO PROVADO**: esta sandbox bloqueia `page.goto` até para `data:`/localhost com `ERR_BLOCKED_BY_ADMINISTRATOR`. Os testes usam `page.set_content` + `data:` ESM e relay de rede fora do navegador. Não afirmar cookies Secure reais, TLS, CORS ou reverse proxy validados |
| Infraestrutura | MariaDB REAL CP027 **0/12**; Keycloak/OIDC, Core Node24/TS6 e GitHub Actions privado continuam **SEM GATE** |
| Interface final | **NÃO APROVADA**. É a linguagem de baixa fidelidade P0-007 reaproveitada para confirmar fluxo; catálogo de nomes/itens, licenças de arte, tradução, revisão editorial, navegação real de jogadores e leitores de tela pendentes |

### Reprodução

No checkout com CP046 como base, Python 3 + `playwright` + Chromium e Node >=22:

```bash
python lab/ux-p0-010/test_preview.py
python lab/ux-p0-010/test_http_bridge.py
node --test scripts/tests/cp047-browser-p0-contract.test.mjs
```

O segundo teste inicia e encerra um servidor **127.0.0.1** próprio, com SQLite **`:memory:`** e tokens exclusivamente sintéticos. O relay Python adiciona o cookie de teste **fora do JavaScript do navegador**; nunca é login Keycloak real. Não iniciar `test-http-server.mjs` em interfaces públicas, nem publicar `preview.html` em produção antes de validar TLS/Host/Origem, Keycloak, MariaDB e a política de deploy. Nenhum arquivo do Core, bot, banco real ou frontend principal foi modificado.

## Dependência e ordenação

Branch CP047 deve ter como base apenas o HEAD fixo do PR #16 (CP046). Não criar nova autenticação, não renomear Chest para Inventory, não introduzir catálogo genérico para cobrir ausência de dados nativos. Somente depois das provas CP027/Keycloak/HTTPS considerar a integração desta tela com a navegação real do portal. A identidade artística do Crownicles continua em revisão independente.
