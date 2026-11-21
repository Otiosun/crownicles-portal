# Interface (laboratório)

A versão de cinco áreas ainda usa dados sintéticos. Abra `index.html` localmente; os arquivos em `assets/` são ilustrações originais do projeto, não retratos nem itens canônicos dos jogadores.

`node --test tests/*.cjs` executa os testes de estados e contratos. O `contract-adapter.js` não autentica sessões nem autoriza consultas; a autorização pertence ao servidor.

Opcional: `python3 -m pip install beautifulsoup4 && python3 build_offline.py` gera `preview-offline.html` localmente. O arquivo gerado não deve ser versionado.
