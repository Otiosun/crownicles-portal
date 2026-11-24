# CP058 — Chromium P0 ↔ HTTPS real (ponte verificadora, laboratório)

**Data:** 2026-11-24 | **Base:** PR #30 HEAD `a4a55f37ac9f858afdae9ed58bcd79377b32f527`. **Status: apenas QA, DRAFT**. O código executável está no ZIP de QA privado; esta PR contém **documentação de handoff**, não uma alteração de produto.

## Pacote reproduzível e prova de integridade
[CP058 HYBRID HTTPS QA no Drive](https://drive.google.com/file/d/1voeDd6WH-dckThhhoEbp0mcMRqeCJOZC/view) — **102060 bytes**, SHA256 remoto após download **`0bb6ccdc2dc207430f709d59c76a30b30083e2b52ee962ae7a8f0d1daa761ede`**, 12 entradas ZIP e CRC 12/12, manifesto com hash SHA256 de 11 payloads.

Inclui arquivos novos `lab/ux-p0-010/test_tls_ui_bridge.cp058.py` e `lab/ux-p0-010/test_tls_ui_mutations.cp058.py`, instruções, três logs completos e screenshot sem sessão/código real. O checkout da base PR30 foi reconstruído via GitHub API, **132/132 blobs Git SHA-1 conferidos** inclusive WebP (DNS impedia `git clone` neste executor).

## O que é comprovado
- Chromium executou **o ESM e a árvore DOM reais** de `lab/ux-p0-010/controller.mjs` (hash do PR30), sem substituição de regras de leitura ou navegação.
- O transporte `fetch` foi adaptado via função Playwright/Python para **HTTPS real de loopback** com certificado X.509 gerado temporariamente e **validado** pela biblioteca SSL do Python (CA efêmera fornecida somente ao cliente de testes), o servidor CP049 Node e ledger SQLite CP014 existente. Aprovação privada somente pelo stdin da fixture, sem endpoint público de aprovação.
- Gerar código, consulta de pendência, confirmação privada, resgate, perfil/inventário/inspeção, duas contas em paralelo, recarga de interface, logout, rejeição de replay do token encerrado, cancelamento e revogação de vínculo: **28/28 checks PASS por execução, 3 execuções 28/28**.
- Mutações em cópias scratch: enfraquecer SameSite, omitir revogação do token no logout e trocar dados de personagens: **3/3 defeitos intencionais DETECTADOS**, com código de saída não zero.
- Regressões da base integral: `npm run check` **352/352 PASS**; `npm run test:p0:https` **12 Node +4 CookieJar Python PASS**; `npm run test:p0:preview` **1/1 PASS**. O comando composto `gate:p0:lab` foi **interrompido durante a fase Browser**, apesar de Node/HTTPS terem passado; não contar como PASS integral desta execução.

## Limitação crítica
**Chromium com cookies nativos/TLS real: NOT_TESTED.** A política deste executor bloqueia até `Page.goto('https://127.0.0.1:...')` com `ERR_BLOCKED_BY_ADMINISTRATOR`, inclusive com interceptação por rotas. Assim, a ponte mantém o CookieJar, a verificação de certificado e a rede HTTPS no Python; o Chromium avalia DOM, ESM e respostas reais por `Response` reconstruída. O teste verifica a emissão de `Secure; HttpOnly; SameSite=Strict` e o isolamento de CookieJar **mas NÃO o enforcement de SameSite/HttpOnly pelo navegador**.

Sem backend de produção, MariaDB CP027, Core Node24/TS6, OIDC/Keycloak, integração WA real, aprovação de arte, licença/pt-BR, CI runner, merge ou deploy. A PR original, `main`, `package.json`, parser TAP, controladores, bot e banco não foram alterados.

## Coordenação
CP057 é o compositor ativo de PR30+PR32+PR33+PR35; esta entrega CP058 **não altera paths compartilhados**. Para incorporar os dois novos testes ao portal: extrair o ZIP, inspecionar, adicionar em branch própria após conclusão de CP057, reexecutar no source-pinned checkout completo. Não inserir um marcador obrigatório TAP/Chrome nativo sem executar a respectiva bateria no ambiente correto.
