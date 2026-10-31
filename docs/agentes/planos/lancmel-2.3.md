# Plano lancmel-2.3 — Download de mod: host de redirect e mod antigo preservado

Método: M4+M1 (~25 linhas). Risco alto (rede). Sem mundo, sem segredo.

1. Teste primeiro (falha antes): `baixar.test.ts` — redirect para host fora de `hostsPermitidos` recusado (direto e encadeado, host de origem liberado); redirect dentro da lista segue; destino antigo com hash diferente continua no lugar se o download falha ou o hash novo não confere.
2. `baixar.ts`: opção `hostsPermitidos` (comparação sem diferença de maiúscula/minúscula); `buscar` checa cada salto; o arquivo final que não confere deixa de ser apagado antes — o novo é baixado em `.parcial`, conferido e só então renomeado sobre o antigo.
3. `mods.ts`: passa `hostsPermitidos: [host da url do mod]`; teste de que o mod antigo (hash velho) fica quando o novo falha.
4. Ficha em `docs/memoria/solucoes.md` e linha no CLAUDE.md não (fora do alcance; vai como proposta no PR).

Fora: outros chamadores (transferência), tela.
