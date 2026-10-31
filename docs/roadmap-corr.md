# Roadmap de correções (sigla `corr`)

**Objetivo:** correção que destrava o resto (CI vermelho, teste instável, bug achado depois do merge). Prioridade máxima
na fila. Ramos `roadmap/corr-<id>`. Toda correção traz teste que falhava antes e passa depois, e ficha em
`docs/memoria/solucoes.md` se o erro pode voltar.

- [x] **1.1 — Testes de infra passam fora do root (CI vermelho na main)** (PR #118, 31/10/2026)
  *O que fazer:* desde ~31/10 o check "Vistoria" da `main` fica vermelho no GitHub (usuário comum) e verde na sessão
  (root): `tests/infra/instalar.test.ts` (24), `instalar-limbo.test.ts` (11) e `instalar-velocity.test.ts` (23) rodam os
  scripts em simulação sem fingir root, e o script recusa ("rode como administrador"). Fazer os ajudantes de teste
  passarem `SABRE_FALSO_UID=0` (ou o equivalente que o script já aceita) e conferir que nenhum teste depende de ser
  root sem dizer (os que precisam de root de verdade ficam como `skip` explícito fora do root). Entender por que alguns
  pushes passaram.
  *Arquivo:* `tests/infra/`
  **Tela no app:** não se aplica.
  *Confirmação:* `npx vitest run tests/infra` verde como usuário comum (não root) e como root; check da `main` verde.
  *Depende de:* nada
