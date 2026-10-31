# Roadmap de melhoria — App

Melhorias achadas durante os itens do `docs/roadmap-app.md` (skill `maxima` › `references/melhorias.md`).
**Sigla `appmel`.** Ramos `roadmap/appmel-<id>`. Entram nas próximas ondas, depois das correções e da segurança.

## Bloco 1 — Janela e bandeja

- [ ] **1.1 — Ícone próprio para a bandeja**
  *O que fazer:* recortar só a cabeça do tigre do ícone (o texto "SABRE HOSTING" não se lê em 16–32 px) e usar esse
  recorte na bandeja, nos tamanhos 16, 24 e 32 px.
  *Arquivo:* `apps/desktop/recursos/icone/`, `apps/desktop/src/main/principal.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* no Windows, com escala 100% e 150%, o ícone da bandeja aparece nítido.
  *Origem:* app-1.1 · PR #70 · filha

- [ ] **1.2 — Teste de chamada de fora recusada pela ponte**
  *O que fazer:* teste que prova que `veioDaPagina` (processo principal) recusa chamada cujo remetente não é a página
  do app (hoje o código confere, mas nenhum teste cai se a conferência sumir).
  *Arquivo:* `apps/desktop/src/main/principal.ts` (extrair a conferência para `seguranca.ts`), `seguranca.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* sabotar a conferência derruba o teste.
  *Origem:* app-1.1 · PR #70 · qa
