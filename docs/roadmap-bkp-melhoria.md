# Roadmap de melhoria — Backup

Melhorias achadas durante os itens do `docs/roadmap-bkp.md` (skill `maxima` › `references/melhorias.md`).
**Sigla `bkpmel`.** Ramos `roadmap/bkpmel-<id>`. Todo item é RISCO alto (toca o mundo).

## Bloco 1 — Pacote

- [x] **1.1 — Validar caminhos do manifesto para Windows (antes de o sync escrever em disco)**
  *O que fazer:* `validarManifesto` recusa nomes reservados do Windows (CON, PRN, AUX, NUL, COM1–9, LPT1–9, com ou sem
  extensão), ponto/espaço no fim do nome, `<>:"|?*` e caracteres de controle; recusa caminhos que colidem sem
  diferenciar maiúscula (`R.mca` e `r.mca`); limites de quantidade de arquivos, profundidade e tamanho do caminho;
  devolve objeto reconstruído, sem campos extras; arquivos não comuns (FIFO, socket) geram aviso em vez de serem
  pulados em silêncio. **Obrigatório antes do sync-1.2** (que escreve nesses caminhos).
  *Arquivo:* `packages/nucleo/src/backup/manifesto.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes com cada caso recusado; manifesto com campo extra volta sem ele.
  *Origem:* bkp-1.1 · PR #21 · qa segurança + qa integridade · **feito no PR #29 (30/10/2026)**

- [x] **1.2 — Colisões de nome além de maiúscula** (PR #90, 31/10/2026)
  *O que fazer:* normalizar Unicode (NFC) antes de comparar colisões (macOS trata `é` e `e`+acento como o mesmo nome);
  recusar arquivo `a` junto de pasta `a/b` no mesmo manifesto.
  *Arquivo:* `packages/nucleo/src/backup/manifesto.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes com `é` nas duas formas e com `a` + `a/b` recusados.
  *Origem:* bkpmel-1.1 · PR #29 · qa

- [ ] **1.3 — Mensagens e sobras do backup agendado**
  *O que fazer:* `criarPacote` preserva a mensagem específica do manifesto ("o mundo mudou durante a leitura") em vez
  da genérica; quando o servidor cai no meio do backup, o pacote não chega a ganhar o nome final (descartar antes do
  rename) em vez de ser apagado depois.
  *Arquivo:* `packages/nucleo/src/backup/pacote.ts`, `packages/nucleo/src/backup/agendador.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes: mensagem específica chega ao amigo; servidor que cai não deixa arquivo com nome final em nenhum momento.
  *Origem:* bkp-1.3 · PR #45 · qa

## Bloco 2 — Guardar

- [x] **2.1 — Restauração: atalho no lugar do mundo e marcador garantido** (PR #86, 31/10/2026)
  *O que fazer:* `haMundo` com `lstat` (um link quebrado no lugar da pasta do mundo é recusado, não tratado como
  "inexistente"); se gravar o `RESTAURACAO-INCOMPLETA.txt` falhar, avisar em pt-BR em vez de engolir o erro.
  *Arquivo:* `packages/nucleo/src/backup/restaurar.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes: link quebrado recusado; falha ao gravar o marcador vira aviso.
  *Origem:* bkp-2.2 · PR #64 · qa
