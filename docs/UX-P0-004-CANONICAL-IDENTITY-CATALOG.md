# Crownicles Portal — UX-P0-004 | Identidade pública e nomes oficiais de itens

**22/11/2026 · descoberta de fontes, NÃO integração homologada.** Complementa UX-P0-003 sem alterar o Core ou decidir a direção visual.

## Identidade pública: fonte exata encontrada

O `CommandProfilePacketRes.playerData` realmente não possui campo de nome. A representação atual do perfil no adaptador **Discord** resolve o título usando `DisplayUtils.getEscapedUsername(packet.keycloakId,lng)`, que chama `resolveKeycloakPlayerName(keycloakId,lng)` em `Discord/src/utils/KeycloakPlayerUtils.ts`.

Essa função consulta `KeycloakUtils.getUserByKeycloakId(keycloakConfig,keycloakId)` e lê **`getUser.payload.user.attributes.gameUsername[0]`**; se não houver valor, usa tradução de jogador desconhecido. O tipo `Lib/src/keycloak/KeycloakUser.ts` confirma `attributes.gameUsername: [string]`. O helper `Lib/src/keycloak/KeycloakUtils.ts` usa a API administrativa Keycloak (`/admin/realms/{realm}/users/{id}`) com token de serviço, e NÃO é API pública do browser.

**Implicação concreta:** a origem do nome foi identificada, mas a maneira segura de disponibilizá-lo ao portal **ainda está pendente de autenticação, autorização e minimização**. O gateway deve resolver **somente o ator autenticado**, aplicar sanitização e expor exclusivamente uma string de exibição, nunca `keycloakId`, dados de conta completos, token administrativo, e-mail ou Discord ID. Não realizar consulta administrativa diretamente no navegador. Até essa integração ser homologada, utilizar título neutro “Seu personagem”. Não copiar a identidade/ícone Discord de uma conta alheia.

Fontes pinadas:
- `Discord/src/commands/player/ProfileCommand.ts`: https://github.com/Crownicles/Crownicles/blob/64d08c05f11949029317341735f6f73024f19f9b/Discord/src/commands/player/ProfileCommand.ts — SHA `0ae0de541ae9b69ad43a9dd1a5688f3b5b6fc1e0`.
- `Discord/src/utils/KeycloakPlayerUtils.ts`: https://github.com/Crownicles/Crownicles/blob/64d08c05f11949029317341735f6f73024f19f9b/Discord/src/utils/KeycloakPlayerUtils.ts — SHA `a10e441c122af25709a4edd2194affcf29bdeb87`.
- `Lib/src/keycloak/KeycloakUser.ts`: https://github.com/Crownicles/Crownicles/blob/64d08c05f11949029317341735f6f73024f19f9b/Lib/src/keycloak/KeycloakUser.ts — SHA `835ecde63e40d36eb5e23ce99aa4688c8c353451`.
- `Lib/src/keycloak/KeycloakUtils.ts`: https://github.com/Crownicles/Crownicles/blob/64d08c05f11949029317341735f6f73024f19f9b/Lib/src/keycloak/KeycloakUtils.ts — SHA `bf7f7f30a13e96b633ddff9da10a2ea4b230380f`.

## Nomes de itens: localização canônica encontrada

O `CommandInventoryPacketRes` não inclui nomes. O cliente **Discord** usa o mapa de IDs para nomes de modelo:

- arma: `i18n.t('models:weapons.<id>')`;
- armadura: `i18n.t('models:armors.<id>')`;
- poção: `i18n.t('models:potions.<id>')`;
- objeto: `i18n.t('models:objects.<id>')`.

Isso é explícito em `Discord/src/utils/DisplayUtils.ts` (`getSimpleItemName`, `getSimpleWeaponDisplay`, etc.). O inventário também usa chaves `models:materials.<id>` e `models:plants.<id>`. Os arquivos `Lang/<language>/models.json` fornecem o catálogo de localização. No commit pinado, `Lang/pt/models.json` tem **101** chaves em `weapons`, **112** em `armors`, **98** em `potions` e **95** em `objects`, total **406 entradas de tradução nessas quatro categorias**. Contagem de chaves NÃO é total de itens válidos, jogáveis ou disponíveis no inventário.

Exemplos confirmados de `id=0` em `Lang/pt/models.json`: armas = “Punho”; armaduras = “Sem escudo ou armadura”; poções = “Sem poção”; objetos = “Espaço livre”. O significado depende da categoria, não de um `if (!id)` genérico.

O `Discord/src/translations/i18n.ts` utiliza i18next e, quando uma tradução falta, possui fallback pela configuração `LANGUAGE.DEFAULT_LANGUAGE` e `LANGUAGE.FRENCH`. Reuso no portal exige validar licenças de tradução, cache, versão compatível do catálogo, fallback seguro para chaves ausentes e revisão de português para o público brasileiro. Não inserir strings de nome ou imagens em fixtures como se fossem parte do DTO Core.

Fontes pinadas:
- `Discord/src/utils/DisplayUtils.ts`: https://github.com/Crownicles/Crownicles/blob/64d08c05f11949029317341735f6f73024f19f9b/Discord/src/utils/DisplayUtils.ts — SHA `3ed199ade647ef6b2baa7e84a44ca512fccb3993`.
- `Lang/pt/models.json`: https://github.com/Crownicles/Crownicles/blob/64d08c05f11949029317341735f6f73024f19f9b/Lang/pt/models.json — SHA `25cb372dedd822629a69c84eb4f280866ebd80b7`.
- `Discord/src/translations/i18n.ts`: https://github.com/Crownicles/Crownicles/blob/64d08c05f11949029317341735f6f73024f19f9b/Discord/src/translations/i18n.ts — SHA `ee671bba82cd575667fbde248a4ad1c0a80e673e`.
- `Discord/src/commands/player/InventoryCommand.ts`: https://github.com/Crownicles/Crownicles/blob/64d08c05f11949029317341735f6f73024f19f9b/Discord/src/commands/player/InventoryCommand.ts — SHA `9e8b34bdf646dd099ec94bad380a308642f70f0a`.

## Iconografia: o que existe e o que NÃO existe

`Lib/src/CrowniclesIcons.ts` fornece tabelas de ícones/emotes por categoria/ID. `DisplayUtils.getItemIcon` as utiliza no Discord. **Isso não é um atlas de imagens WebP/PNG autorizado para web**, nem substitui a família de assets original que ainda precisa ser projetada. Usar emotes customizados fora da plataforma pode depender de licença/acesso; não assumir que são livremente reutilizáveis.

A distinção agora é:

1. **Dado canônico:** ID, categoria, slot, atributo (pacote Core).
2. **Nome canônico traduzido:** função de lookup do `Lang/<locale>/models.json`, com versão/idioma.
3. **Visual do item:** asset ilustrativo/licenciado/autorais do portal, ainda NÃO decidido; fallback necessário.
4. **Nome público do jogador:** Keycloak `attributes.gameUsername[0]`, somente via gateway autorizado, não via resposta perfil nem consulta do navegador.

## Gate atualizado

**Fechada:** a localização *no código* das fontes oficiais de nome do jogador e nomes dos itens.

**Ainda aberta:** integração autorizada da identidade, perfil de permissão/privacidade, projeção segura, extração/versionamento/licenças do catálogo, revisão linguística pt-BR, assets oficiais/autorais, testes contra Core/Keycloak reais, efeitos de cache e revogação, testes com jogadores. Nenhum servidor, banco, token ou dado privado foi acessado; pesquisa foi inteiramente em código público fixado no commit.

UX-P0-003 permanece um contrato de navegação candidato: a descoberta de fontes de nome **não** converte uma proposta em aplicação pronta. A metáfora artística, as páginas e o design system continuam não homologados.