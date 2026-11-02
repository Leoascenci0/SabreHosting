# Roadmap de melhoria — Interface do app (appui)

Melhorias achadas durante os itens do `docs/concluidos/roadmap-appui.md` (skill `maxima` › `references/melhorias.md`).
**Sigla `appuimel`.** Ramos `roadmap/appuimel-<id>`.

## Bloco 1 — Tela Backups

- [x] **1.1 — Backup manual e origem do backup** (✅ PR #294, 02/11/2026; decisão do Eliel, 01/11/2026; onda 43)
  *O que fazer:* (1) núcleo: campo `origem` (`automatico` | `manual` | `antes-de-restaurar`) no manifesto do pacote de backup; ausente em backup antigo ou valor desconhecido lido do disco = `automatico` (sem migração, sem reescrever backup existente). O agendador grava `automatico`, o restaurar grava `antes-de-restaurar`. (2) Botão "Fazer backup agora" na tela Backups, habilitado só com o servidor pronto (estado vem do main), pelo MESMO `fazerBackup` (save-off + save-all flush + save-on); recusado no main se o servidor não está pronto, se há backup ou restauração em andamento, ou em modo demonstração; botão com estado "carregando" e resultado em texto fixo seguro. (3) A lista mostra a origem em palavras ("Automático", "Manual", "Antes de restaurar"). O manual conta na rotação como qualquer outro e nunca derruba o mínimo garantido. (4) Junto, se couber: `npm run test:e2e -w apps/desktop -- <arquivo>` passa o filtro ao vitest (`apps/desktop/scripts/e2e.mjs`).
  *Arquivo:* `packages/nucleo/src/backup/manifesto.ts` e vizinhos, `apps/desktop/src/main/backups.ts`, `apps/desktop/src/ui/`, `apps/desktop/scripts/e2e.mjs`, testes
  **Tela no app:** Backups › "Fazer backup agora"; linha da lista com a origem.
  *Confirmação:* testes que falham antes e passam depois (manifesto: origem gravada/lida, ausente e torta = automático; `backups.ts`: recusas e uma chamada de save-off/flush; e2e: botão desabilitado sem servidor, habilitado com servidor pronto, linha nova "Manual"; rotação com manual não derruba o mínimo). Windows real e servidor Minecraft real **[P: Eliel]**.
  *Origem:* Eliel · PR #286
