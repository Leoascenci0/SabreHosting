# Roadmap — Backup (pacotes do mundo, rotação e restauração)

Objetivo: fazer backups consistentes do mundo, com manifesto e hashes, guardar com rotação segura e restaurar sem
risco. Base de todo o resto (sync e migração usam o mesmo pacote).

**Sigla `bkp`.** Ramos `roadmap/bkp-<id>`. Código em `packages/nucleo/src/backup/`. Leitura obrigatória:
`qualidade-sabre › references/integridade.md` §2 e §4. Todo item é RISCO alto (toca o mundo).

## Bloco 1 — Pacote

- [x] **1.1 — Manifesto do mundo** (PR #21, 30/10/2026)
  *O que fazer:* percorrer a pasta do mundo em fluxo e gerar `manifesto.json` (caminho relativo, tamanho, SHA-256 de
  cada arquivo; versão; época; data). Recusar caminhos com `..`/absolutos. Comparar dois manifestos → lista do que
  mudou (base do delta).
  *Arquivo:* `packages/nucleo/src/backup/manifesto.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes com mundos de teste: muda 2 regiões → diff aponta só as 2.
  *Depende de:* base-1.3

- [ ] **1.2 — Pacote fechado e conferido**
  *O que fazer:* gerar pacote (zip ou tar.zst, escolher pelo desempenho e registrar) com o manifesto dentro; abrir e
  conferir todos os hashes; compactação em worker com prioridade baixa.
  *Arquivo:* `packages/nucleo/src/backup/pacote.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste: pacote corrompido (1 byte) é recusado; mundo de 20 MB empacota sem travar o processo.
  *Depende de:* bkp-1.1

- [ ] **1.3 — Backup consistente com o servidor rodando**
  *O que fazer:* orquestrar `save-off` → `save-all flush` → manifesto+pacote → `save-on` (sempre, mesmo em erro);
  agendado a cada X minutos.
  *Arquivo:* `packages/nucleo/src/backup/agendador.ts`
  **Tela no app:** Configurações › Backups › Intervalo (padrão 10 min).
  *Confirmação:* teste com servidor falso: `save-on` volta mesmo se o pacote falhar; nada é lido entre `save-off` e o flush.
  *Depende de:* bkp-1.2, host-2.2

## Bloco 2 — Guardar e restaurar

- [ ] **2.1 — Rotação segura**
  *O que fazer:* manter os N mais recentes + 1 por dia dos últimos 7; nunca apagar o último conferido; dry-run nos testes.
  *Arquivo:* `packages/nucleo/src/backup/rotacao.ts`
  **Tela no app:** Configurações › Backups › Quantos guardar (padrão 10). **ESPERA DECISÃO D6** (padrões do grupo).
  *Confirmação:* testes de propriedade: em qualquer sequência, sobra ≥ 1 backup bom.
  *Depende de:* bkp-1.2

- [ ] **2.2 — Restaurar com troca atômica**
  *O que fazer:* backup do estado atual → extrair em pasta temporária → conferir → `rename` → registrar. Exige trava (no
  modo local, trava local até o cartório existir).
  *Arquivo:* `packages/nucleo/src/backup/restaurar.ts`
  **Tela no app:** Backups › Restaurar (tela no app-2.x).
  *Confirmação:* teste: falha no meio da extração deixa o mundo original intacto.
  *Depende de:* bkp-2.1
