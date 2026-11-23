# CP049 — HTTPS + cookies reais em laboratório, sem presumir navegador liberado

**Data:** 2026-11-23 · **Estado:** somente laboratório / PR draft / nenhum merge nem deploy.

## O problema que este corte resolve

O CP048 compunha o `IdentityLedger` SQLite real da experiência de laboratório, a confirmação privada simulada, as rotas CP014, a leitura CP046 e a interface CP047/048. Porém seu cliente Node mantinha cookies por um `Map`, sem TLS. A UX usava Chromium com `page.set_content` e fetcher injetado; não tinha prova de negociação HTTPS e política `Secure` nos cookies reais.

O Chromium deste executor bloqueia `page.goto(https://127.0.0.1:<porta>)` com `net::ERR_BLOCKED_BY_ADMINISTRATOR`, inclusive certificado de teste confiável via `ignore_https_errors`. Portanto CP049 **não pode** declarar navegador HTTPS homologado. Também não há Keycloak, WA real, MariaDB, Core de produção nem arte final.

## Implementação isolada

- `lab/ux-p0-010/https-loopback.cp049.mjs`: compõe as rotas CP014 e CP046 originais sobre Node `https.createServer` com certificado fornecido pelo laboratório. Limita explicitamente `listen` a `127.0.0.1` e exige `Host` idêntico ao endpoint; não permite socket Unix, wildcard ou DNS. Rejeita `Host` alterado antes de emitir qualquer resposta de sessão.
- `https-loopback.cp049.test.mjs`: gera certificado autoassinado com SAN para `127.0.0.1` em diretório temporário, testa TLS com CA de laboratório expressamente confiada e rejeição sem CA, ausência de HTTP na porta TLS, `Host`, requisições sem sessão, cookies `__Host-` com `Secure; HttpOnly; SameSite=Strict`, aprovação privada simulada, `/v1/me/profile`, `/v1/me/inventory`, logout, dois atores e mudança de vínculo/Origin. **11/11 testes**, Python não usado aqui.
- `https-cookie-fixture.cp049.mjs`: servidor de teste com controle privado exclusivamente por stdin do processo local; esse canal não é uma rota HTTP. Não reutilizar nem publicar como aprovação WhatsApp.
- `https-cookiejar.cp049.py`: utiliza `urllib.request.HTTPCookieProcessor` e `http.cookiejar.CookieJar` do Python para armazenar, devolver e remover cookies **sem código manual de extração**. Testa vínculo A/B e isolamento, logout, mudança de vínculo, Origin não autorizado, host-only e envio de cookie `Secure` apenas para URL HTTPS do mesmo host. **4/4 testes**.
- `scripts/run-p0-https-tests.cp049.mjs`: comando multiplataforma `npm run test:p0:https`. OpenSSL e Python 3 são dependências explícitas e sua falta **causa falha**, não skip. O comando NÃO está em `npm test` para não quebrar ambientes Windows sem OpenSSL: execução deliberada antes de promoção.

## Evidência e limites estritos

| Verificação | Resultado local |
| --- | --- |
| CP048 P0 Node original | 179/179 PASS; sem alterações |
| CP049 TLS Node | 11/11 PASS; 0 skips |
| CP049 Python stdlib CookieJar | 4/4 PASS |
| Chromium navegando HTTPS local | **BLOQUEADO por política do ambiente** — não testado |
| TLS real CA pública, navegador de jogador, OIDC/WA/MariaDB | **NOT_RUN** |

As senhas/segredos dos atores são **fictícios** e seus tokens e certificados TLS são gerados em memória ou diretórios temporários autoeliminados. O ZIP/PR não contém chave privada nem certificado gerado. A opção `--ignore-https-errors` de um navegador não foi convertida em prova de confiança TLS; Node e Python verificam o certificado da CA explicitamente fornecida pelo ensaio.

### Observação de semântica importante

Uma alteração do vínculo de A para o UUID **já pertencente a B** leva o `IdentityLedger` original a **quarentenar ambos**, por design anti-colisão. Um teste inicialmente supôs que B seria preservado mesmo em colisão; isso seria um falso positivo. O teste foi corrigido para desvincular A (`actor=null,epoch=2`) e exigir que somente A seja revogado, sem tocar em B. Outro ensaio com dois cabeçalhos Host recebeu **400 do parser nativo Node**, e não o 421 da própria aplicação: ambos rejeitam a requisição antes da emissão; o teste aceita 400/421.

### Por que não é uma homologação de navegador

`CookieJar` da biblioteca padrão respeita Secure e domínio, porém **não implementa as restrições SameSite dos navegadores** e **não modela acesso JavaScript a HttpOnly**. Inspecionamos explicitamente os atributos e comprovamos transporte TLS, mas a proteção completa precisa de Chrome/Firefox/Safari autorizado no domínio HTTPS final e teste do cookie no navegador.

## Próximos gates

1. Rodar `npm run test:p0:https` em checkout reproduzido e verificar compatibilidade da fonte com PR #18; obter validação de engenheiro de segurança sobre emissão de cookies e Host/Origin no proxy final.
2. HTTPS público/reverso autorizado, certificado de CA real e teste em navegador: Secure, HttpOnly, SameSite e `__Host-`, entrada por WhatsApp privado, logout e revogação simultânea entre processos.
3. Core nativo pinado em Node24/TS6, MariaDB GAME/LOGS descartável, consultas SELECT-only, escopo do proprietário e cancelamento SQL efetivo.
4. CI com runner executando passos e evidências, catalogação de nomes/imagens com licença, acessibilidade humana e design aprovado.

**Nunca mesclar/ativar antes das quatro condições.** Este código de laboratório não deve ser adaptado diretamente como servidor público.

## CP049-B — entrega do frontend estático na mesma origem HTTPS (ainda laboratório)

A composição TLS passou a aceitar opcionalmente `publicAssetsRoot` (diretório absoluto fornecido pelo operador do laboratório). A única superfície de arquivos exposta é uma allowlist fixa: `preview.html`, `controller.mjs`, `link-flow.cp048.mjs`, `machine.mjs`, `browser-reader.cp046.mjs`, `response-bridge.mjs`, `projection-guard.mjs`, e um pequeno `entry.cp049.mjs` virtual. **Não** há roteamento genérico de arquivos, diretório estático público, `fs` a partir da URL, nem acesso aos módulos privados de sessão/identidade. Cada JS é servido como `text/javascript`, a página como `text/html`, com `nosniff`, `no-store`, `X-Frame-Options: DENY` e CSP `script-src 'self'; frame-ancestors 'none'`. O script inline original da página é substituído apenas na resposta por um bootstrap como arquivo externo, para permitir CSP sem `unsafe-inline` em scripts; o HTML CP048 original no GitHub e no disco permanece intacto.

**Regressão RED concreta:** o primeiro `staticRouter` retornava 405 para qualquer POST antes de verificar o path, interceptando `/v1/link/start`/`redeem`/`logout`. RED: 5/11 PASS; 6/11 FAIL. Patch: verificar a presença exata na allowlist *antes* de qualquer lógica de método; os POSTs desconhecidos para a área estática continuam na rota de sessão. GREEN: **11/11 Node + 4/4 Python**, 0 falhas e 0 skips. Duas provas adicionais exercitam HTML com CSP/bootstrap externo, dependências públicas com MIME correto e negação de arquivos privados/travessia de diretórios.

**Limite:** não houve `page.goto` bem-sucedido no Chromium por bloqueio administrativo. O TLS, os headers, a origem, o carregamento dos recursos públicos e a política CSP foram verificados por cliente Node/Python, **não** por execução da página sob HTTPS em navegador real. A flag `publicAssetsRoot` não habilita produção; a factory segue restrita a localhost.
