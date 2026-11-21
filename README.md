# Crownicles Portal

Portal complementar ao RPG **Crownicles**, com uma direção visual pictórica editorial universal. O RPG e seus dados permanecem sob autoridade do Crownicles Core; este repositório não substitui o bot WhatsApp.

## Situação

**Laboratório privado, sem implantação.** Cinco superfícies de navegação com dados sintéticos: personagem, inventário, companheiro, jardim e patrimônio/baú. Candidatos de consultas read-only separados da interface. O tema é uma única direção de trabalho, **ainda não homologada**.

### Executar localmente

- Abra `web/index.html` para a versão de laboratório com assets separados. Não requer API.
- `npm install` e `npm test` executam **43 testes de interface/contrato + 24 testes das consultas simuladas e da projeção integrada**.
- `npm run check` também verifica a sintaxe JS.
- Opcional: `python3 -m pip install beautifulsoup4`, depois `python3 web/build_offline.py`, cria o `web/preview-offline.html` autocontido (não versionado).

## Segurança e integração

O backend verdadeiro **ainda não foi integrado**. Os 9 testes adicionais exercitam a saída dos cinco leitores TS pela projeção client-side, usando fixture de PetEntity fiel ao modelo e limites assimétricos da despensa para detectar troca de índices. `web/contract-adapter.js` filtra respostas para exibição, mas **não autoriza acesso**. Os módulos em `integration/candidates` têm imports relativos ao checkout do Crownicles Core 6.2.0.b e só podem ser instalados após compilação e testes no Core real. **CP027: 0/12 testes MariaDB nativos executados**. CP039 realizou HTTPS local com runtime V31 e modelos de consulta simulados; não comprovou Keycloak/OIDC + MariaDB.

Não inserir dados de jogadores, tokens, chaves ou configurações de produção. Nenhum deploy/integração live deve ser ativado a partir desta branch.

## Referências internas

Os resultados anteriores CP035/037/038/039 permanecem preservados no Drive; apenas código, assets próprios e documentação útil foram consolidados aqui. Consulte `docs/ARCHITECTURE.md` e `docs/ASSETS.md` para limites/proveniência.
