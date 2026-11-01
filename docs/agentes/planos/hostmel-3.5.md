# Plano hostmel-3.5 — Download local aceita `::1`

Método M4+M1. `new URL("http://[::1]/").hostname` vem como `[::1]` (com colchetes), por isso o teste de "local"
não reconhecia o IPv6 de loopback.

1. Teste primeiro (falha antes): em `baixar.test.ts`, `http://[::1]:porta` com `permitirHttpLocal` passa da validação
   (falha só na rede, nunca com a mensagem de https); sem a opção é recusado sem tocar a rede; `http://[::2]` é
   recusado mesmo com a opção.
2. `baixar.ts`: incluir `[::1]` no teste de `local`.
3. `montar.ts`: incluir `[::1]` nos dois pontos que hoje só aceitam `127.0.0.1` (vigia de host e `hostsPermitidos`).
4. Sem lista nova de hosts; `permitirHttpLocal` segue falso por padrão; `transferencia.ts` não muda.
