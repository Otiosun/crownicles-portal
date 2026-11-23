# CP048 — Entrada privada na experiência P0 de Crownicles

**23/11/2026 · candidato isolado · não instalar como login de produção**

## O problema resolvido

CP047 só permitia confirmar um cookie de sessão já existente. O CP014 original possui o mecanismo de desafio, aprovação exclusivamente privada, emissão e revogação, mas o navegador ainda não conseguia percorrê-lo. O CP048 conecta esse contrato ao portal: *Gerar código → confirmação pelo bot privado → consultar situação → concluir vínculo → verificar o Perfil pelo servidor → Pertences/Inspeção*. Não cria outra autoridade ou cadastro e não oferece ao usuário a escolha de ID de personagem.

## Contrato de rede e segregação

- O cliente chama somente `POST /v1/link/start`, `GET /v1/link/status`, `POST /v1/link/redeem` e `POST /v1/link/cancel`. O vínculo é aprovado apenas por um adaptador privado autenticado; não há formulário de código nem de identificador no navegador.
- `fetch` usa `credentials:'same-origin'`, `cache:'no-store'`, `redirect:'error'`, `Accept:application/json`, sem corpo ou cabeçalho `Cookie`/`Authorization` manual. Cookies `__Host-crownicles_link` e `__Host-crownicles_session` pertencem ao servidor, exigindo `Secure; HttpOnly; SameSite=Strict; Path=/`.
- Resposta estritamente JSON de até 2 KiB, código temporário com alfabeto/posição permitidos, expiração finita e próxima, apenas estados canônicos. Respostas inconsistentes e temporizadores limpam dados do desafio e não autorizam o acesso.
- O `200 redeemed` **não** é aceito como login por si só: `onLinked()` precisa confirmar uma leitura GET de Perfil do proprietário via CP046. A confirmação de autoridade permanece sempre fora do navegador.
- Não há polling automático infinito: a pessoa solicita uma atualização explícita da aprovação. Códigos são retirados da tela após cancelamento, expiração, conclusão ou logout. Enquanto um logout está pendente, a interface não permite iniciar um novo desafio. Um cancelamento não confirmado é apresentado como não confirmado, nunca como sucesso.
- O fluxo é independente da camada visual definitiva; não cria nomes traduzidos, retratos, imagens de itens ou ações mutáveis. UX usa textos de interface mínimos até aprovação artística.

## Fontes e regressões

O CP048 deriva das rotas e do `IdentityLedger` SQLite originais de CP014 já preservados no PR #16 e da interface CP047 no PR #17. **Não** copia código nativo para um novo servidor. Nenhum segredo/pepper real é usado; os testes de integração inicializam `IdentityLedger({file:':memory:'})` com dois atores fictícios e autoridade privada simulada.

Na extração local do código candidato: `npm run test:p0` **179/179 testes únicos PASS**, 0 falhas, 0 skipped (inclui 13 regressões CP048 de protocolo e 5 de HTTP/SQLite originais). `npm run test:p0:browser`: 46/46 interface anterior, 10/10 acessibilidade/teclado, 14/14 ponte CP047, 19/19 vinculação CP048, em Chromium. O cenário CP048 SQLite cobre simultaneamente: vínculo de A e B independentes, challenge cancelado, revogação/rebinding antes de redeem, código consumido não reutilizável, cookies no-store e logout. O teste de navegador usa fetch simulado: não é cookie real do Chromium em HTTPS.

A árvore do PR inclui os testes no comando P0 e a interface vinculada ao mecanismo real de exibição. Os pacotes CP047/CP046 originais não são sobrescritos. `npm run check` não pode ser executado **dentro do ZIP parcial local** sem buscar todos os módulos `web/`, `scripts/` e `integration/` da base Git; o workflow privado que roda no repositório completo continua sem runner utilizável. Não substituir o resultado do teste P0 por uma alegação de CI remoto verde.

## Gates sem aprovação

1. Serviço de identidade/Keycloak, binding/epoch e confirmação **real** no canal privado do bot: NÃO EXECUTADO.
2. HTTPS real e teste com cookie Secure do navegador, redirecionamento/replay e CORS sob domínio oficial: NÃO EXECUTADO. No laboratório Node HTTP o armazenamento do cookie é um jar sintético apenas nos testes de servidor.
3. Core Node24/pnpm10/TS6, MariaDB GAME/LOGS com transação owner-only e cancelamento SQL: CP027 ainda sem 12/12.
4. GitHub Actions privado pré-runner, validação humana T01–T06 e leitores de tela reais: NÃO HOMOLOGADOS.
5. Identidade visual aprovada, catálogo oficial de nomes/imagens e revisão de licença AGPL3/ativos: ABERTOS.

**Regra de promoção:** PR DRAFT, sem merge/deploy, nem ativação de código enviado ao bot/WhatsApp, até os gates de produção serem formalmente aceitos. O CP048 oferece apenas uma primeira entrada testável e uma linha de integração única sobre CP047.
