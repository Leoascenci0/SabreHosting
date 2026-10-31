# Plano appmel-1.19 — reler `level-name` a cada operação

Problema: `pc.pastaMundo` é calculado uma vez (`lerConfigPc`). Se o `level-name` do `server.properties` mudar com o app
aberto, o backup agendado e o backup antes de trocar de versão seguem apontando o mundo antigo.

Método: M1 + M4 (reaproveita `nomeDoMundo`, que já valida o arquivo como entrada não confiável, S-07).

1. `config-pc.ts`: `pastaDoMundoAgora(pastaServidor)` = `join(pastaServidor, await nomeDoMundo(pastaServidor))`.
2. `agenda-backups.ts` e `deps-backups.ts`: opção `mundoAgora?()` que, quando existe, vale mais que `pastaDoMundo`; lida a CADA
   `iniciarAgendaReal` (cada servidor pronto) e a cada `backupParado`.
3. `principal.ts`: passa `mundoAgora` nos dois pontos (agenda e backup antes de trocar versão).
4. Testes (mundos inventados): muda `level-name` entre dois Hospedar e o backup segue o novo; mesma coisa em `backupParado`.
Fora: save-off/save-all flush, rotação e `packages/nucleo` (intocados).
