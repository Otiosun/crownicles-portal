# CP027 — inspeção do host antes de executar MariaDB nativo

**Ainda NÃO homologado.** O CP027 tem 12 testes nativos MariaDB/HTTPS (11 do CP015 + 1 conjunto); **0/12 foram executados com MariaDB neste projeto**. Os testes de HTTP e de ORM simulado não os substituem.

## Antes de executar o gate original

O comando **somente verifica** o ambiente: não instala pacotes, não liga servidor, não altera banco ou checkout e não imprime caminhos, tokens, cookies ou senhas. Não substitui o `verify.py` de integridade do CP027.

```sh
npm run gate:preflight -- --source /CAMINHO/Crownicles --gate /CAMINHO/CP027
```

`CP027_PREFLIGHT=READY` significa apenas que as dependências básicas *parecem* presentes. O runner CP027 faz verificações adicionais. O preflight rejeita ambiente root, Node abaixo de 24, Python abaixo de 3.9, falta de `bash`, `git`, `timeout`, `mariadb`, `mariadbd`, `mariadb-install-db` ou `openssl`, checkout não enraizado no caminho fornecido, ausência do objeto Git exato `64d08c05f11949029317341735f6f73024f19f9b`, dependências Core/Lib ausentes ou apontadas por symlink de topo, ou arquivos essenciais do executor CP027 ausentes.

O `HEAD` do checkout **não precisa** apontar para o commit pinado, porque o CP015 extrai o objeto pinado para um repositório temporário próprio. O checkout não é modificado. Dentro dele, `Core/node_modules` e `Lib/node_modules` devem estar instalados. O runner também verifica versões, symlinks internos, integridade SHA e isolamento do banco; o preflight não considera isso aprovado antecipadamente.

Quando o ambiente for verdadeiramente descartável e o preflight estiver `READY`, o executor original — preservado no Drive — define a invocação seguinte:

```sh
bash /CAMINHO/CP027/run.sh --source /CAMINHO/Crownicles
```

**Nunca usar banco, datadir, credenciais ou checkout com dados reais do bot.** Não subir endpoints, não fazer merge ou deploy por causa de um preflight aprovado. Depois de rodar o gate, compartilhar apenas o status agregado sanitizado `CP015_NATIVE`, `CP027_HTTPS_CORE`, `CP015_EXIT_CODE`, sem credenciais ou dumps.

## Evidências separadas

- `npm run audit:imports`: compara os imports dos quatro candidatos com um manifesto de **28 módulos e hashes Git** extraído dos exports do Crownicles Core 6.2.0.b, commit imutável fixado. Foi confirmada a existência dos arquivos e exportações na fonte do GitHub; a execução posterior da auditoria é **offline** e verifica o pin local do manifesto, não acessa o GitHub.
- `npm run test:tools`: testa cenários adversariais da auditoria e do preflight usando sondas simuladas.
- `npm run check`: executa testes da UI, candidatos simulados e ferramentas. **Não equivale a typecheck do Core, SELECT-only MariaDB, autenticação Keycloak ou testes de navegador.**

GitHub Actions ainda tem falha anterior à atribuição do runner (Issue #3); verifique o status real antes de chamar qualquer CI de verde.
