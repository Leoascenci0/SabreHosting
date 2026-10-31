# Plano syncmel-1.7 — isolar headersTimeout de requestTimeout

Método: M1 (reaproveitar a opção de teste `tempoOciosoMs`). ~30 linhas de código + ~40 de teste.

1. `OpcoesServidor` ganha `tempoCabecalhoMs?`, `tempoRequisicaoMs?`, `intervaloConferenciaMs?` (só teste; padrão = constantes atuais).
2. Ligar `servidor.connectionsCheckingInterval` ao intervalo injetado (senão o Node confere a cada ~30 s).
3. Testes: cabeçalho incompleto (cabeçalho 1 s, requisição 4 s) prova `headersTimeout`; cabeçalho completo com corpo prometido e nunca enviado (cabeçalho 1 s, requisição 2,5 s) prova `requestTimeout`.
4. Provar no PR: remover só um prazo faz só o teste dele falhar. Medir o tempo do arquivo antes (>31 s) e depois.

Não muda: constantes de produção, espalhar.ts, aplicar.ts.
