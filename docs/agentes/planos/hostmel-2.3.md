# Plano hostmel-2.3 — Processo do servidor mais robusto

Método: M4 (+M7 pequeno). Arquivo: `packages/nucleo/src/servidor/processo.ts` e o teste vizinho.

1. `iniciarServidor` recusa `pasta` não absoluta e `javaPath` relativo com separador (nome sem barra, como `java`, vale).
2. Guarda: conjunto de pastas resolvidas em uso no módulo, marcado antes de qualquer `await`; segunda chamada na mesma
   pasta é recusada; libera se a subida falhar antes do spawn e quando o servidor vira `parado`/`caiu`.
3. "Pronto" só pela linha `Done (` do próprio servidor (logo após o prefixo do log), nunca por chat (`<Nome> Done (`).
4. Java inexistente: o `close` que vem depois do `error` não repete o aviso "encerrou sozinho".
5. Testes primeiro (devem falhar sem o conserto): caminho relativo recusado, segunda chamada recusada (e liberada
   depois), chat com "Done (" não muda o estado, aviso único com Java inexistente.

Fora: cartório, trava, lógica de parada.
