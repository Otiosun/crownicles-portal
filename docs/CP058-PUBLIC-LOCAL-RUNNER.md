# Crownicles CP058 — execução local do repositório público (sem GitHub Actions)

**Estado:** laboratório, somente leitura do repositório remoto. Testes somente mediante `--run-check` ou `--run-gate`. Não faz merge, deploy, autenticação de jogadores, nem acessa WhatsApp, MariaDB, OIDC ou Core nativo.

## Qual problema resolve?

O GitHub Actions tem histórico de jobs `web-contracts` com `steps:null`, bloqueados antes de rodar o código por faturamento/limite. **Não devemos interpretar esse job como reprovação do código** nem depender dele para os testes do portal. O repositório `Otiosun/crownicles-portal` é público. Neste executor do ChatGPT, contudo, `git ls-remote` falha porque `github.com` não resolve no DNS; isso é um limite do ambiente, não do repositório.

Este utilitário Python 3.10+ usa **HTTPS público**, sem GitHub token: consulta o head de uma PR ou um SHA imutável, obtém o objeto Git commit e a árvore correspondente da API REST, baixa o ZIP público do mesmo SHA pela `codeload.github.com` e verifica **todo arquivo byte a byte** com o SHA-1 Git blob, tamanho e lista exata da árvore. Recusa diretórios fora do ZIP, nomes inseguros, links simbólicos, submódulos, arquivos ausentes/adicionais, duplicatas, limites de tamanho e destino preexistente. Só materializa um checkout novo após validar **100%** do arquivo recebido.

## Uso no PC (Linux, macOS, Windows)

Pré-requisitos: Python 3.10+, Node.js 22+ e npm. Sem credenciais GitHub:

```bash
python3 tools/public_checkout_cp058.py --pr 30 --output ./portal-pr30
```

Esse comando apenas baixa, compara os hashes e salva `portal-pr30/CP058-LOCAL-EVIDENCE.json`. Para executar o pipeline P0 **explicitamente**:

```bash
python3 tools/public_checkout_cp058.py --pr 30 --output ./portal-pr30-check --run-check
python3 tools/public_checkout_cp058.py --pr 30 --output ./portal-pr30-full --run-check --run-gate
```

A PR é resolvida para um SHA de 40 caracteres e gravada no log, para tornar o replay imutável. Se preferir um pin fixo, use `--sha a4a55f37ac9f858afdae9ed58bcd79377b32f527` (HEAD da PR30 na data da investigação). `--pr` não significa automaticamente versão aprovada; escolha a candidata que esteja sob revisão, por exemplo a futura composição CP057. Não execute no checkout de produção. Destino deve ser uma **pasta inexistente**; o script não sobrescreve.

Para `--run-gate`, também são necessários Python Playwright, navegador Chromium instalado e OpenSSL. Instale dependências em ambiente descartável antes de tentar; o script **não instala pacotes nem altera configurações de máquina**. Em Termux/Android, o download e `--run-check` podem ser usados com Python e Node compatíveis; o gate Chromium só deve ser contado se o navegador estiver de fato disponível e a bateria terminar com exit 0.

Os logs de `npm run check`/`gate:p0:lab` ficam dentro do checkout (`CP058-CHECK.log`, `CP058-GATE.log`). A evidência JSON registra os comandos, códigos de saída e os limites: **CI=NOT_USED, WA/MariaDB/OIDC=NOT_TESTED, browser HTTPS real ainda separado**. O script **falha** para qualquer comando com status diferente de zero; não publica relatório verde se houve erro de execução ou teste omitido.

## QA do próprio utilitário

```bash
python3 -m unittest -v tools/test_public_checkout_cp058.py
```

12 testes independentes da rede provam: bytes binários e arquivos aninhados, adulteração de blob, ausência/adição de arquivo, zip-slip, symlink e submódulo, ZIP duplicado/corrompido, árvore truncada, PR externo, destino imutável, execução opt-in e falha correta de subprocessos. A prova de fonte pública **real do PR30** é metadado GitHub confirmado (commit `a4a55f37...`, tree `025dbd24...`, 132 blobs, modes 100644, maior arquivo 288.659 bytes). A extração real PR30 e `npm run check`/gate 352/512 foram executadas numa frente anterior de checkout completo; não atribuir esses resultados ao CP058, que foi testado aqui **contra servidor/arquivo sintético** devido a bloqueio DNS do container.

## Pendências independentes

O navegador Chromium HTTPS no executor deste chat retornou `net::ERR_BLOCKED_BY_ADMINISTRATOR` mesmo para `https://127.0.0.1:<porta>` com certificado temporário. Isso NÃO valida cookies Secure/HttpOnly/SameSite em navegador. A política de isolamento do navegador não deve ser contornada ou declarada aprovada. Também não há autorização de produção nem aprovação de identidade visual ou de todos os gates nativos. A composição PR30+PR32+PR33+PR35 já possui outra frente dedicada (CP057); este script é **estritamente ferramenta de replay**, não deve editar os ramos existentes.
