# Candidatos de consulta — NÃO conectar à produção

Fontes de CP035, com o reparo de ordem dos alimentos do CP039 em `PortalCompanionsQuery.ts`. Os imports de TS são relativos ao **local esperado dentro de Crownicles Core 6.2.0.b**, portanto estes arquivos não constituem um backend independente compilável neste repositório.

A instalação deve acontecer apenas em checkout descartável do Core compatível, com autenticação server-side, transação consistente, checagem de proprietário e gate MariaDB real. Os 75/75 testes de CP035 são de laboratório com ORM simulado, não certificação de DB. Não registrar rotas nem ações de jogo automaticamente.

O CP027 segue com **0/12 testes nativos MariaDB concluídos**.
