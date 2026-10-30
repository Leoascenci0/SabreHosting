# Roadmap de melhoria — Backup

Melhorias achadas durante os itens do `docs/roadmap-bkp.md` (skill `maxima` › `references/melhorias.md`).
**Sigla `bkpmel`.** Ramos `roadmap/bkpmel-<id>`. Todo item é RISCO alto (toca o mundo).

## Bloco 1 — Pacote

- [ ] **1.1 — Validar caminhos do manifesto para Windows (antes de o sync escrever em disco)**
  *O que fazer:* `validarManifesto` recusa nomes reservados do Windows (CON, PRN, AUX, NUL, COM1–9, LPT1–9, com ou sem
  extensão), ponto/espaço no fim do nome, `<>:"|?*` e caracteres de controle; recusa caminhos que colidem sem
  diferenciar maiúscula (`R.mca` e `r.mca`); limites de quantidade de arquivos, profundidade e tamanho do caminho;
  devolve objeto reconstruído, sem campos extras; arquivos não comuns (FIFO, socket) geram aviso em vez de serem
  pulados em silêncio. **Obrigatório antes do sync-1.2** (que escreve nesses caminhos).
  *Arquivo:* `packages/nucleo/src/backup/manifesto.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes com cada caso recusado; manifesto com campo extra volta sem ele.
  *Origem:* bkp-1.1 · PR #21 · qa segurança + qa integridade
