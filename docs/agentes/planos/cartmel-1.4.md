# Plano cartmel-1.4 — Prova de corrida com dois processos (Closes #130)

Só teste; nenhum código de produção muda.

1. `services/cartorio/src/corrida-convite.worker.mjs`: 2 workers (threads), cada um com a PRÓPRIA conexão ao mesmo
   arquivo de banco novo, esperam a barreira (`Atomics.wait`, igual ao worker da trava) e usam o mesmo convite.
2. `services/cartorio/src/corrida-convite.test.ts`: 20 rodadas, um convite novo por rodada, para os dois caminhos
   (`usarConvite`, sem sala provisória; `entrarPeloConvite`, com sala provisória). Exatamente 1 vence, o outro recebe
   `undefined` (recusa), nenhum erro de banco travado (`busy_timeout` de 5 s do `abrirBanco` espera a transação do
   vencedor), 1 PC e 1 token por convite.
3. Mutação manual (colada no PR): leitura fora da transação / `BEGIN IMMEDIATE` → `BEGIN DEFERRED` → o teste falha.
4. `npm run vistoria`.
