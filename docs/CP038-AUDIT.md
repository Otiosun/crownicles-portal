# CP038 — Auditoria adversarial e mapa de riscos

| Caso | Defeito na CP037 | Correção CP038 | Evidência | Gate restante |
|---|---|---|---|---|
| Transição ready → restricted | Dados antigos permaneciam nas tags, embora ocultos por CSS | `eraseDomain`: apaga atributos derivados, resumos e linhas | Testes DOM em três famílias | Teste browser/AT, prova de auth server |
| Hash profundo após restrição | `#patrimonio/17`/`#jardim/1` permaneciam no endereço | Hash sem ID específico ao negar leitura | Testes DOM/URL | Controle de links reais |
| Busca com zero resultados | ID de item anterior permanecia no hash | `#inventario` sem item | Teste de busca | Navegação browser |
| Resposta CP035 fora do contrato | Sem barreira de projeção; fixtures acessadas diretamente | Adapter v1 com allowlist, validação e descarte all-or-unavailable | 12 testes adapter + 11 testes novos DOM | Banco + sessão + autorização HTTP |
| Baú sem conteúdo visível | Apenas capacidades no patrimônio | `<details>` com IDs/categoria/slot/raridade; sem mutação | Testes DOM item + restrição | Campos de itens reais via Core |
| `home:null` / `apartments:[]` | Renderer acessava `home.level` e `apartments[0]` | Estado sem residência/apartamento tratado sem inventar registro | Teste DOM | Teste nativo |
| Dados extras ou script no apelido | Risco no caminho futuro de dados externos | allowlist e texto via `textContent`; títulos HTML só de constantes | Teste de string literal e descarte | CSP/headers, scanner browser |
| Dependência de retrato | Sem arte oficial para vários IDs | Fallback explícito; não associar imagens a espécies/itens só por semelhança | Testes herdados, asset manifest | Bíblia visual/aceite |

## Limites irredutíveis do teste local

Os testes VM validam a lógica de renderização com DOM simulado. Não autenticam jogadores, não validam SQL real, não provam consistência de snapshot e não verificam listeners, foco e pintura em browser real. A proteção efetiva de dados depende de consultas seguras **no servidor**, das regras do Core e de permissões de banco. A simples exclusão do DOM não é uma medida suficiente de autorização nem impede a inspeção de dados que o servidor já tenha transmitido. Portanto, um endpoint deve **nunca** enviar dados quando o acesso é restrito.

Uma consulta CP035 da propriedade pode ser `ready` mesmo com o baú `restricted` se o jogador estiver numa cidade que não dá acesso ao baú; CP038 mostra o status separadamente e não promove a consulta parcial a permissão para transferir itens.

A política de consulta global de patrimônio continua candidata à decisão de produto. Ações de aluguel, jardinagem, inventário e companheiro permanecem exclusivamente no Core, sem rotas de escrita aqui.
