# CP053 — prévia P0 em HTTPS local, com vínculo fictício verificável

**Estado:** candidato de laboratório / PR draft. Não é autorização para produção, merge, ligação ao bot, MariaDB ou uso com jogadores.

## Problema e mudança mínima

CP049 já possuía servidor TLS limitado a `127.0.0.1`, roteador estático com **allowlist** de módulos públicos, CSP e os fluxos CP014/CP046. Porém a fixture usada no teste com CookieJar iniciava o gateway apenas com rotas de API, sem `publicAssetsRoot`. Assim, o teste permitia validar cookies e respostas sintéticas, mas não abrir a mesma interface P0 sobre HTTPS por meio daquela fixture.

CP053 acrescenta um **opt-in** à fixture existente: `CROWNICLES_P0_LAB_STATIC=1` passa a raiz do próprio checkout para o roteador estático CP049. Sem essa variável, o comportamento legado permanece API-only. Não se acrescenta diretório genérico, arquivo privado, endpoint, permissão ou autorização ao navegador. O launcher `scripts/start-p0-https-preview.cp053.mjs` cria certificado temporário de um dia, chave privada com modo 0600 e ativa a fixture em porta efêmera no loopback. A chave é apagada no encerramento normal.

A prévia usa **dois atores, inventário e autoridade totalmente fictícios** definidos na fixture CP049. A confirmação privada é simulada estritamente por entrada JSON no terminal local; não há integração com WhatsApp. A tela utiliza os mesmos módulos P0 do PR#22 (CP052) e o catálogo original em português do CP051, sem inventar nomes ou dados.

## Como abrir e percorrer a jornada

No checkout desta branch, com **Node ≥22** e **OpenSSL** no PATH:

```sh
node scripts/start-p0-https-preview.cp053.mjs
```

A saída apresenta `previewUrl` na forma `https://127.0.0.1:PORTA/lab/ux-p0-010/preview.html`. Abra **esse endereço local** no navegador da mesma máquina. O certificado é autossinado e exclusivamente temporário; a advertência de confiança no navegador é esperada. Não altere flags globais do navegador nem reutilize a chave em um ambiente real. Se o navegador ou a política do dispositivo bloquear a navegação HTTPS local, registre como **bloqueio de ambiente**, não como teste aprovado.

Na página, selecione **Gerar código temporário**. O laboratório mostrará o código. No terminal em que a fixture está aberta, envie uma única linha JSON, substituindo o código pelo que acabou de aparecer:

```json
{"command":"approve","user":"a","code":"XXXX-XXXX-XXXX"}
```

O terminal deve retornar `{"ok":true}`. De volta ao navegador, escolha **Já confirmei — consultar situação** e depois **Concluir vínculo**. A leitura de perfil deve revelar o personagem fictício **nível 12, dinheiro 111**. Em **Pertences**, verifique a categoria Armas, a posição ativa `ID 0`, a busca por `0` e por `Punho`, a inspeção e o retorno ao mesmo item. Outras categorias também são sintéticas e não representam inventários de jogadores.

Para verificar revogação, clique **Encerrar sessão** e tente consultar `/v1/me/profile` novamente; a sessão anterior deve falhar com `401`. Opcionalmente, no terminal, `{"command":"unbind","user":"a"}` simula perda do vínculo fictício. Para fechar corretamente e excluir os arquivos TLS temporários, envie `{"command":"exit"}` ou pressione Ctrl+C.

## Teste repetível e cobertura

```sh
node --check scripts/start-p0-https-preview.cp053.mjs
node --check scripts/test-p0-https-preview.cp053.mjs
node --test scripts/test-p0-https-preview.cp053.mjs
npm run test:p0
npm run test:p0:https
```

O teste CP053 inicia o **launcher real**, solicita página, bootstrap e módulos P0 pelo HTTPS do mesmo servidor; confirma CSP, MIME e `no-store`; nega arquivos privados; exige `401` sem sessão e `403` para Origin incorreta; emite desafio fictício, aprova exclusivamente por stdin, troca cookie `__Host-` com `Secure/HttpOnly/SameSite=Strict`, lê perfil/inventário e prova logout/revogação. Neste teste de transporte, a CA temporária não é confiada pelo cliente; **a verificação de certificado pelo cliente está no CP049**. Ele não comprova execução de JS no navegador, política SameSite efetiva, OIDC/Keycloak, MariaDB, confirmação privada real, Core nativo, MQTT, WhatsApp nem qualquer gate de publicação.

Os comandos `npm run test:p0` e `npm run test:p0:https` preservam as regressões existentes. A execução CP053 **somente é comprovada quando houver log de testes reais com resultado**; um teste versionado não equivale a teste executado. CI GitHub Actions e Chromium HTTPS local continuam dependentes do ambiente, com bloqueios históricos pré-runner e `ERR_BLOCKED_BY_ADMINISTRATOR`, respectivamente.

## Invariantes e revisão antes de merge

- O `main`, as PRs anteriores e os arquivos do Core/WhatsApp/MariaDB não são alterados por este corte. A branch é empilhada sobre a PR#22 e permanece draft.
- Nenhum método de jogo é enviado. A identidade no browser nunca pode ser atribuída a um `playerId` escolhido pelo usuário; o servidor fictício controla o vínculo.
- Apenas os paths públicos da allowlist CP049 são servidos. Não adicionar roteamento de diretórios, `fs` derivado de URL, credenciais TLS no repositório nem header `Access-Control-Allow-Origin: *`.
- A revisão humana da experiência e a homologação artística ainda não ocorreram. A prévia não representa design aprovado.
- Antes de qualquer merge, executar suíte CP053 de ponta a ponta **em checkout limpo**, regressão completa, TLS Node/Python, navegador HTTPS em ambiente autorizado, Core/MariaDB/autoridade reais em ambiente descartável e revisão de segurança. Os gates são independentes.

**Dependências de PR:** #19 CP049 → #20 CP050 → #21 CP051 → #22 CP052 → CP053. Esta branch não torna os PRs anteriores publicáveis por si só.
