# Roadmap de melhoria — Base

Melhorias achadas durante os itens do `docs/concluidos/roadmap-base.md` (skill `maxima` › `references/melhorias.md`).
**Sigla `basemel`.** Ramos `roadmap/basemel-<id>`. Entram nas próximas ondas, depois das correções e da segurança.

## Bloco 1 — Esqueleto

- [ ] **1.1 — Fixar as actions do CI por hash de commit**
  *O que fazer:* trocar `actions/checkout@v4` e `actions/setup-node@v4` por hash de commit (com o número da versão em
  comentário) e ligar o Dependabot só para GitHub Actions, para atualizar os hashes por PR.
  *Arquivo:* `.github/workflows/vistoria.yml`, `.github/dependabot.yml`
  **Tela no app:** não se aplica.
  *Confirmação:* o workflow segue verde com os hashes; o Dependabot abre PR quando sair versão nova.
  *Origem:* base-1.2 · PR #7 · filha

- [ ] **1.2 — Vistoria em push na main também confere arquivos**
  *O que fazer:* em push na `main`, o verificador compara com a própria `main` e não confere nada de arquivo (só lint e
  testes valem). Fazer o CI passar `--base` do commit anterior (`github.event.before`) nesse caso.
  *Arquivo:* `.github/workflows/vistoria.yml`
  **Tela no app:** não se aplica.
  *Confirmação:* push de teste na main com arquivo proibido faz o check ficar vermelho (num ramo de teste espelhado).
  *Origem:* base-1.2 · PR #7 · qa
