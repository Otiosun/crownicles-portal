# CP045 — revisão de aceitação e cortes de integração P0

**Estado 22/11/2026 — todos os gates produtivos OFF; PRs em DRAFT; não mesclar/deploy.**

## Uma árvore candidata, sem somar frentes cegamente

- Base versionada `chore/consolidate-portal-foundation` (PR #1, head `2664f4e`).
- UX `research/ref-ux-001-video-atlas` PR #4 → ponte `integration/cp041-profile-inventory-p0-bridge-20261122` PR #10 → guard `fix/p0-guard-capacity-optional-fields-cp043-20261122` PR #12 → **integração P0 `integration/cp045-p0-convergence-20261122` PR #15**.
- PR #15 incorpora via blob pinado a projeção CP042 PR #11 e as correções CP044 de PRs #13 (servidor) e #14 (cliente), ambos **sem merge**; não tentar mesclar #11, #13 e #14 de novo sobre #15 como se faltassem. Confirmar o diff Git antes de eventual mudança de base.
- HTTP read-boundary CP040 PR #6 e revalidação de vínculo de sessão PR #9 **não entram** no PR #15. São outra trilha, indispensável antes de um endpoint real.
- **Não** fundir inventário do personagem com `chest`: chest é baú da propriedade, não o inventário CP012.

## Provas disponíveis e seus limites

| Gate | Evidência existente | Condição para aceitar |
| --- | --- | --- |
| G0 Integridade local | CP045 171/171 Node22/TS5.8, ZIP 30/30 SHA, PR #15 blobs verificados; R3 77/77 CP012 e 86/86 CP014 com testes de origem | Aceitar **apenas como laboratório offline** |
| G1 Core compilado | Upstream público Core pinado já teve CI nativo verde; **adaptado privado não foi compilado** | Node>=24, pnpm10.34.3, TS6.0.3, patches `sequelize@6.37.8` íntegros, Core/Lib mesmo checkout e single Sequelize physical copy |
| G2 DB isolado | CP027 0/12, sem MariaDB no executor deste chat | MariaDB GAME+LOGS **descartáveis**, grants SELECT-only/rollback demonstrados, duas identidades próprias e cross-owner negado, sem queries produtivas |
| G3 Identidade | CP013/014/CP040/041 são candidatos separados; R3 usa atores simulados | WA/Keycloak OIDC/JWKS corretos, epoch/revogação/binding antes+depois, origem/host/cookie, cross-actor e cancelamento DB reais |
| G4 HTTP e browser | CP014 loopback Node sintético; UX P0 Chromium via data:; HTTP browser top-level bloqueado por administrador | Navegador permitido com HTTP/HTTPS ESM de verdade, foco/teclado/seleção, estados e logout, 320px/200%, TalkBack/NVDA e T01–T06 com jogadores |
| G5 CI privado | GH Actions PR #15 continua `steps:null`; sem runner, sem log de npm | Job atribuído a runner + etapas + logs + check Node22/suíte P0, depois gates Node24/TS6 nativo |
| G6 Catálogo e licença | DTO não fornece nome público traduzido nem ícone canônico para todos os itens | Fonte oficial locale/item ID, direito de uso de arte/fontes, crédito/licença AGPL e QA pt-BR, sem fabricar dados |
| G7 Direção artística | Experiência UX de laboratório, identidade pictórica não homologada | Aceite de referência/editorial em dispositivos reais, sem aprovar arte provisória como acabamento |

## Ajuste de testes CP012 comprovado nesta rodada

Original CP012 ZIP tinha fixture 7 espaços e mock `count>=7`, contrários a `PlantConstants.MAX_PLANT_SLOTS=3`. Patch em cópia descartável e seis regressões de fonte demonstraram 77/77; CP014 perfil transpilado → CP045 projector/guard demonstrou 86/86. Pacote R3 `https://drive.google.com/file/d/1vDDOijQH3Z57QfyIkYBHPLTfaf-mIGD5/view`; original ZIPs permanecem com hashes canônicos. **Não converter estes testes em homologação MariaDB nem somá-los a G0 como independentes.**

## Decisão antes de qualquer merge

Aprovar PR #15 como **artefato único candidato de P0**, verificar todas as alterações da árvore contra PR #1 e manter abertas as dependências #6/#9. Quando G1–G6 forem efetivamente verdes, escolher uma estratégia de promoção (retarget PR #15 para PR #1 com revisão de diff, ou integrar a cadeia ordenadamente), sem promover as branches históricas CP044 de novo. Nunca habilitar mutações de equipar/usar/vender nem tocar na base de jogadores durante homologação.
