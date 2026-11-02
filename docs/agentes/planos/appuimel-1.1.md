# Plano appuimel-1.1 — Backup manual e origem do backup

Método: M1+M3 (reaproveitar `fazerBackup` e o molde de `criarBackups`); M4 no `e2e.mjs`. Sem dependência nova.

1. `manifesto.ts`: tipo `OrigemBackup` (`automatico`|`manual`|`antes-de-restaurar`); `Manifesto.origem`; `gerarManifesto` recebe `origem`
   (padrão `automatico`); `validarManifesto` copia a origem normalizada (ausente ou torta = `automatico`).
   Backup antigo sem o campo segue válido e o pacote já gravado não é reescrito (hash intacto).
2. `pacote.ts`/`agendador.ts`: `OpcoesBackup.origem` (agendador grava `automatico`); `restaurar.ts` grava `antes-de-restaurar`.
   `Agenda.fazerAgora()`: mesmo `fazerBackup`, com a MESMA trava de "um backup por vez" do relógio (regra de ouro 2).
3. `listar.ts`: `BackupListado.origem`.
4. Main: `criarBackups().fazer()` recusa (servidor não pronto, backup/restauração em curso, demonstração via `protegerEscrita`);
   estado devolve `prontoParaBackup`; IPC `sabre:backups:fazer`, preload e ponte. Rotação normal roda no `aoConcluir`
   (o manual conta como qualquer outro e o mínimo garantido é do `rotacionarPasta`).
5. Tela: botão "Fazer backup agora" (desabilitado sem servidor pronto; "carregando"; resultado fixo, sem caminho cru);
   linha da lista mostra "Automático" / "Manual" / "Antes de restaurar" · "Este PC".
6. `e2e.mjs` repassa `process.argv.slice(2)` ao vitest.

Provas (TDD, mundos inventados): manifesto (origem gravada/lida, ausente/torta = automatico, sobrevive a `validarManifesto`);
agendador (manual: save-off/flush uma vez, origem manual); `backups.test.ts` (recusas); rotação (manual não derruba o mínimo);
e2e (botão desabilitado/habilitado, linha "Manual").
