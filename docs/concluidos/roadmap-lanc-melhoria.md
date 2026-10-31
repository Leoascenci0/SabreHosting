# Roadmap de melhoria — Launcher

Melhorias achadas durante os itens do `docs/roadmap-lanc.md` (skill `maxima` › `references/melhorias.md`).
**Sigla `lancmel`.** Ramos `roadmap/lancmel-<id>`. Nunca copiar código do Prism (GPL-3.0).

## Bloco 1 — Integração com o Prism

- [x] **1.1 — Detecção e instância mais firmes** (PR #200, 31/10/2026; emoji e ENOENT já estavam prontos)
  *O que fazer:* comparar a versão completa do Prism (major.minor.patch) se o mínimo virar 8.x; marcador próprio da
  instância do SabreHosting (arquivo dentro da pasta) além do nome; cortar o nome do grupo sem partir emoji (par
  substituto); `readFile(...).catch` só para "não existe", repassando outros erros.
  *Arquivo:* `packages/nucleo/src/launcher/prism.ts`, `packages/nucleo/src/launcher/instancia.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes de cada caso.
  *Origem:* lanc-1.1 · PR #36 e lanc-1.2 · PR #57 · qa
