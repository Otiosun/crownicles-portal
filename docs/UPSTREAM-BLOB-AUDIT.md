# W06 — conferência do manifesto com o Git imutável do Crownicles Core

**Status: verificação pré-nativa, não homologação.** O relatório de imports já confere os 39 caminhos e símbolos declarados nos quatro candidatos contra os 28 módulos registrados no manifesto `integration/upstream-contracts.json`. Até agora, os 40 caracteres dos hashes de blobs eram validados apenas como formato — não havia uma checagem automática da correspondência com os objetos originais do Core.

Este complemento acrescenta uma **verificação independente e somente leitura** dos objetos Git do commit original fixado (`64d08c05f11949029317341735f6f73024f19f9b`). Cada um dos 28 caminhos do manifesto deve existir na árvore desse commit como arquivo regular, com o hash Git de blob exatamente igual ao manifestado.

## Execução com um checkout legítimo e local

```sh
npm install --no-audit --no-fund --ignore-scripts
npm run audit:imports
npm run audit:upstream -- --source /caminho/para/Crownicles
```

A execução só usa `git rev-parse --show-toplevel`, `git cat-file -t` e `git ls-tree` (com argumentos sem shell), com timeout curto. Não faz `fetch`, `checkout`, `pull`, `clean`, execução de hooks, acesso ao banco, nem escrita de dados do RPG. Exige checkout cuja raiz seja o diretório fornecido e que contenha localmente o objeto do commit pinado; o `HEAD` pode estar em outro commit. Rejeita caminho com traversal, arquivos ausentes, hash divergente, symlink, submódulo ou pin não disponível. Os erros contêm códigos e caminhos **relativos ao repositório**; não divulgam caminho absoluto, conteúdo do arquivo nem credenciais.

Saída de sucesso, caso os 28 módulos e todos os imports passem:

```text
IMPORT_AUDIT=PASS
PINNED_BLOBS=28/28
UPSTREAM_BLOB_AUDIT=PASS
```

Sem checkout Core, o teste funcional disponível neste repositório é o de **sondas simuladas** (`npm run test:tools`); não se pode reportar 28/28 reais a partir delas. O verificador não valida tipos TypeScript, comportamento SQL, proprietário, isolamento entre contas, Keycloak, transações ou MariaDB. **O CP027 permanece 0/12 até executar o gate nativo** em ambiente descartável.

## Por que não confiar apenas na lista de SHA

Um manifesto desatualizado pode ainda conter 40 caracteres hexadecimais válidos. O script antigo não detectava essa divergência: verificava apenas sintaxe e nomes declarados no próprio manifesto. Com o novo comando, uma troca de SHA ou caminho passa a falhar contra a árvore do commit fixado. Isso eleva a confiança na **integridade dos imports**, não a confiança funcional do backend.

## Critério para integrar este laboratório

Após revisão do diff e dos testes adversariais: integrar somente a ferramenta e sua documentação. Não alterar os candidatos TS, `main`, endpoint, visual, bot ou configuração de produção nesta etapa. Se o checkout original não estiver disponível, deixar o status `UPSTREAM_BLOB_AUDIT` como **não executado**, não como aprovado.
