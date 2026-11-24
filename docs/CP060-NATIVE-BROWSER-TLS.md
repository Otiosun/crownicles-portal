# CP060 — prova nativa Chromium + TLS de loopback

Candidata exclusivamente de laboratório sobre PR39 HEAD 1e6a835dff2fca88940e1ba1a4f9803346908c98. Teste novo usa fixture CP049 e código CP059 reais, navegador com rede HTTPS própria, CA temporária importada no NSS isolado e controle negativo sem CA. Não utiliza interceptação de requests, fetch simulado, ignore_https_errors=True, credenciais reais, conta WhatsApp ou banco do Core. Testa dois contextos, atributos e remoção de cookies nativos, autorização e revogação, recarga e inspeção de inventário.

Executar somente em máquina descartável de testes com Node 22.16, Python 3, Playwright 1.57.0, Chromium/Chrome, OpenSSL e certutil: `python lab/ux-p0-010/test_native_browser_tls.cp060.py`. A workflow temporária está restrita a PR da branch CP060 no mesmo repositório; não fazer merge do workflow experimental. Não publica chaves, cookies, códigos, traces ou screenshot. O teste imprime apenas nomes de checks e categoria de falha. Resultado só pode ser marcado PASS após execução real e exit 0. Atributo SameSite Strict inspecionado, mas não testa envio em navegação cross-site. Não equivale a OIDC, CA de produção, Core/WA, MariaDB LOGS ou autorização de deploy.

## Primeira execução remota (RED no encerramento)

Run 45474853195 / job 138732230130: Chrome 157.0.8103.78, Node 22.16.0. 35/36 checks concluídos, incluindo todos os checks de autenticação e isolamento; timeout após ACK de encerramento, sem PASS agregado. Reprodução local independente CP049: enviar exit mantendo stdin aberto -> timeout; fechar stdin -> exit 0. O teste agora fecha o writer de stdin após receber o ACK, sem alterar o servidor. Reexecução justificada por correção causal do harness, não por afrouxar a asserção.
