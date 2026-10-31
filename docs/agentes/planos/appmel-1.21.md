# Plano appmel-1.21 — Restaurar backup relê o `level-name` na hora

Método: M1 (reaproveitar `mundoAgora` / `pastaDoMundoAgora`, ~8 linhas). Risco médio-baixo (mexe no caminho de restaurar o mundo, mas só na escolha da pasta-alvo). Sem rede, sem mundo real.

1. Teste primeiro (`apps/desktop/src/main/deps-backups.test.ts`): `pastaDoMundo` velho (lido ao abrir o app) e `mundoAgora` apontando para o mundo novo; `restaurar` tem de trocar o mundo NOVO, deixar o velho intocado e ainda guardar o estado de antes (regra 4). Deve falhar antes.
2. `deps-backups.ts`: em `restaurar`, `pastaDoMundo = (await o.mundoAgora?.()) ?? o.pastaDoMundo` (mesmo padrão de `backupParado`). `depsBackupsReais` ganha o 4º parâmetro opcional `mundoAgora`.
3. `principal.ts`: `criarBackupsDoApp` passa `() => pastaDoMundoAgora(pc.pastaServidor)`.
4. Prova: teste verde, `npm run vistoria` APROVADA.

Fora: tela, backup agendado e antes de trocar versão (já feitos no appmel-1.19).
