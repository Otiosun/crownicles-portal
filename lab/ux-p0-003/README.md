# Crownicles Portal — UX-P0-003 (laboratório)

**Propósito:** testar o fluxo P0 de Personagem → Pertences → Inspeção → Retorno a partir dos campos reais do Crownicles Core, **antes** de qualquer decisão visual. O pacote não contém backend, arte, cliente HTTP, servidor, imagens ou dados de jogadores.

- `UX-P0-003-FLOW-CONTRACT.md`: decisões, proveniência, transições, estados, lacunas, aceitação e crítica.
- `machine.mjs`: estado e transições puras de navegação, com guardas de consistência experimentais. NÃO realiza autorização de produção.
- `machine.test.mjs`: 29 testes determinísticos usando fixtures sintéticas.
- `test-results.tap`: saída do Node v22.16.0.
- `manifest.json`: hashes SHA-256 e ambiente.

Execute `node --test machine.test.mjs` sem dependências npm. Não importar este código para `web/` ou `Core/` como implementação final sem revisão, gate CP027/CI e testes de DOM/usuários.

Referência: https://docs.google.com/document/d/1JlVQZFYtErWtFZ1XSBE_0rvZXRjEkfcM/edit
