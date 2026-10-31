# Plano syncmel-1.2 — timeout/teto de conexões no servidor de sync; parcial completo não rebaixa

Método: M4 + M1 (triagem). Regras de ouro 2–3 (hash antes de renomear).

1. `servirArquivos`: `headersTimeout` 10 s, `requestTimeout` 10 s, `keepAliveTimeout` 5 s, `timeout` (socket ocioso) 60 s
   (parâmetro opcional `tempoOciosoMs` só para o teste; maior que o `tempoSemDados` de 30 s do cliente), `maxConnections` 16.
2. `baixar.ts`, bloco do 416: se `content-range` = `bytes */N` e N == tamanho do parcial, mantém o parcial e deixa
   `baixarConferido` conferir o hash e renomear; hash errado nesse caso descarta e baixa de novo (uma vez);
   sem content-range ou N diferente: recomeça do zero como hoje.
3. Testes (primeiro, devem falhar): conexão ociosa derrubada; parcial completo sem segundo download; parcial completo
   com hash errado rebaixa; o `expect` do servidor falso vira `autorizacoes.push` conferido depois.
