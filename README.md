# Crownicles Portal

Portal complementar ao RPG Crownicles no WhatsApp. Este repositório privado centraliza a interface pictórica editorial, seus contratos de leitura e os testes de integração.

**Estado:** laboratório, sem conexão com jogadores reais e sem implantação. O Crownicles Core continua como única fonte de verdade.

## Decisões de engenharia

- Uma direção visual universal (fantasia pictórica editorial), ainda sujeita a aceite.
- Personagem, inventário, companheiro, jardim e patrimônio compartilham a identidade e a navegação.
- As consultas só podem operar com identidade derivada de uma sessão autenticada pelo servidor. A projeção no navegador **não substitui autorização**.
- Nenhuma escrita ou simulação de ação de jogo é habilitada pelo portal.
- O gate MariaDB/Core do CP027 permanece **0/12 testes reais executados**. Os testes HTTPS e os mocks locais não o substituem.

## Origem e rastreabilidade

O material de partida vem dos checkpoints CP035 (consultas), CP037/038 (cinco superfícies e proteção de estados), CP039 (reparos de contratos e HTTPS de laboratório), preservados no Drive do projeto. O conteúdo será importado por uma branch/PR de consolidação, sem copiar os ZIPs inteiros ou fontes de terceiros.

Não inserir chaves, tokens, senhas, dados pessoais dos jogadores ou configuração de produção no Git.
