# Arquitetura e critérios de aceite

- **Core do RPG:** continua sendo autoridade exclusiva para personagem, inventário, eventos e operações.
- **Interface:** uma única identidade pictórica editorial, cinco áreas, sem escolher outros dois temas concorrentes. Arte ainda sem aceite final.
- **Sessão:** resolução server-side do identificador do jogador; nunca aceitar actorId/homeId/cityId fornecidos pelo navegador como autorização.
- **Contratos:** `integration/candidates` é laboratório, não compilação validada no Core. Adaptador em `web/contract-adapter.js` apenas normaliza; sanitização de UI não elimina dados já transmitidos.
- **Segurança:** exigir autenticidade OIDC/Keycloak real, revogação, isolamento por jogador, consulta sem efeito colateral, transação consistente, fail-closed no servidor, limites de tempo/bytes e testes adversariais antes de expor endpoints.
- **Banco:** CP027 0/12 testes reais MariaDB; CP039 passou HTTPS local com SQLite e consultas em ORM simulado. Não equiparar SQLite a MariaDB.
- **Entrega:** sem deploy automático nem conexão ao WhatsApp enquanto faltarem os gates.

## Referências de trabalho

- CP035: composição das cinco consultas, 75/75 testes locais simulados.
- CP037: direção única com cinco áreas.
- CP038: proteção de estados, contrato de projeção client-side.
- CP039: correção de IDs nativos da despensa e estoque de plantas, integração HTTPS de laboratório.

Os pacotes completos de auditoria/histórico permanecem no Drive do projeto.
