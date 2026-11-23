# CP051 — títulos nativos do inventário (pt), laboratório

Fonte **única**: Crownicles/Crownicles commit `64d08c05f11949029317341735f6f73024f19f9b`, arquivo `Lang/pt/models.json`, Git blob `25cb372dedd822629a69c84eb4f280866ebd80b7`. Mapeamento nativo `Lib/src/constants/ItemConstants.ts`: weapon=0, armor=1, potion=2, object=3. Os 406 nomes seguem a mesma sequência da fonte (FNV-1a UTF16 `89f85230`, não criptográfico).

Copiados somente os 4 grupos de nomes (101 armas, 112 armaduras, 98 poções e 95 objetos). Não contém nomes de jogadores, imagens, credenciais ou inventários. **Licença upstream GNU AGPL-3.0:** https://github.com/Crownicles/Crownicles/blob/64d08c05f11949029317341735f6f73024f19f9b/LICENSE ; exigir revisão jurídica/técnica e disponibilidade de fontes antes de servir publicamente. A localização `pt` original contém regionalismos e não equivale a revisão `pt-BR` aprovada.

## Contrato de UI
- Usa `itemName(category,id)` somente para apresentação; nunca altera seleção `{category,slot,id}`, ID0, sessão, inventário ou jogo.
- ID fora de catálogo é `null`, mostrado como **Nome não disponível** com ID real; não inventar tradução nem associar arte.
- Preserva busca exata por ID do PR#20 CP050 (branch base). A busca atua sobre `data-item-id`, não sobre títulos. Esta branch fica empilhada no CP050, sem sobrescrever suas alterações ou aprovar direção visual ART-01/02.
- Adiciona dependência ESM na allowlist HTTPS de laboratório; nenhum arquivo privado de ledger/bot/ORM passa a ser servido.

## Provas/limites
No laboratório local de apresentação derivado do CP049, o catálogo passou 6 verificações Node, 12 Chromium e regressão P0 completa 185/185; HTTP TLS 12 Node+4 Python e baterias do navegador herdadas continuaram verdes. **Essa execução local não incluiu o código CP050 de busca simultaneamente**: a validação da árvore empilhada CP050+CP051 deve ocorrer em checkout limpo antes do merge. A suíte completa `npm test` requer arquivos do repositório inteiro e não roda no ZIP P0 reduzido. CI GitHub privado, TLS no Chromium autorizado, MariaDB/Keycloak/WA nativos e revisão humana continuam pendentes.

**Status: DRAFT, sem merge/deploy.**
