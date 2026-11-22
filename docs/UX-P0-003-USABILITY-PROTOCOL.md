# Crownicles Portal — UX-P0-003 | Protocolo qualitativo de testes de tarefa

**Preparado em 22/11/2026. NÃO EXECUTADO COM PESSOAS.** Instrumento candidato; nenhuma conclusão de usabilidade deve ser derivada apenas deste roteiro ou dos 29 testes automáticos de lógica.

## Objetivo

Verificar se jogadores do Crownicles conseguem consultar o próprio personagem, localizar um item por categoria e posição, inspecionar atributos e retornar ao contexto original, com estados/ausências inteligíveis, sem precisar de um retrato individual ou imagem do item. Não testar estética antes de o sistema visual ser definido.

## Preparação segura

- Cinco participantes é uma proposta para uma primeira rodada qualitativa, não amostra estatística. Preferir jogadores reais com familiaridade variada com o RPG e celular; registrar perfil apenas em termos amplos, sem nomes/IDs/telefones.
- Usar fixtures sintéticas rotuladas, sem contas ou dados de jogadores reais, e tarefas neutras, sem induzir o caminho.
- Testar em um protótipo navegável de **baixa fidelidade de UX** aprovado para teste, ainda NÃO criado. A máquina de estados sozinha não é interface para participantes.
- Observador não ensina os controles durante a tarefa; anotar caminhos, dúvidas, erro e recuperação.
- Obter concordância para observação e para gravação se houver; não gravar mensagens privadas de WhatsApp ou identificadores do usuário.

## Tarefas, critérios e perguntas pós-tarefa

| ID | Tarefa lida ao participante | Sucesso observável | Risco que revela |
|---|---|---|---|
| T01 | “Encontre o nível e a vida atual do seu personagem.” | Localiza ambos e distingue valor atual/máximo sem ajuda. | Hierarquia de personagem e significado de números. |
| T02 | “Verifique se a sua classe aparece e encontre a missão/progresso apresentado.” | Identifica os campos quando disponíveis; reconhece opcional ausente sem inventar informação. | Classe ID sem tradução, campos opcionais e navegação. |
| T03 | “Veja o equipamento de arma ativo e depois encontre o item na primeira posição de reserva.” | Distingue ativo e reserva sem depender de pintura ou rótulo inventado. | Posição/slot, semântica de `id=0`, separação de categorias. |
| T04 | “Inspecione um item repetido em dois slots distintos e volte ao mesmo lugar.” | Seleciona o slot pedido, compreende os atributos exibidos e recupera posição/foco, sem voltar ao início. | Chave categoria+slot+id e manutenção de contexto. |
| T05 | “A consulta de inventário ficou indisponível. O que você entende e o que faria?” | Não confunde `unavailable`, `restricted` e `not_initialized`; identifica caminho seguro de retorno. | Mensagens, privacidade, estados e confiança. |
| T06 | “Sua sessão terminou enquanto você estava vendo o item. O que acontece com as informações na tela?” | Entende necessidade de entrar novamente; nenhum dado antigo é mostrado. | Privacidade, limpeza ao revogar sessão, mensagens 401. |

### Itens de observação por tarefa

- `concluiu`: sim / com ajuda / não;
- `tempo`: segundos, medidos a partir da instrução (não usar para comparar com benchmark não estabelecido);
- `erros`: navegação errada, seleção errada, interpretação errada;
- `recuperação`: voltou por conta própria? fez ações redundantes?;
- `confiança verbalizada`: alta / média / baixa com fala curta, sem atribuir causa sem evidência;
- `ocorrências`: print da interface sintética ou anotação, sem dados reais;
- `ambiguidade da tarefa`: marcar se o próprio enunciado causou confusão.

### Critério de encerramento da rodada

Não fixar meta artificial de '90% de aprovação' sobre apenas cinco pessoas. Agrupar os problemas por severidade:
- **Crítico:** acesso a dados indevidos, perda de contexto irrecuperável, ação perigosa apresentada como permitida, falha de teclado/toque que impede tarefa essencial.
- **Alto:** mais de um jogador não consegue cumprir tarefa P0 sem ajuda ou interpreta `restricted` como outra causa.
- **Médio:** caminhos longos, nomenclatura não clara, ausência de sinal de seleção/foco.
- **Baixo:** atrito cosmético com impacto pequeno.

Corrigir os problemas críticos antes de expandir escopo; testar novamente após correção. As observações alimentam UX-001/UX-004 e, quando a linguagem visual existir, o gate artístico separado.

## Não confundir

O script está pronto, **mas ainda não houve** recrutamento, teste com usuários, navegador autorizado, design visual, API real ou autenticação. A evidência dos 29 testes automatizados cobre apenas o modelo puro de navegação. Endpoints CP012/014 seguem candidatos e CP027 MariaDB/Keycloak continua sem homologação.