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

- [ ] **1.2 — Vistoria local também como usuário comum (S-03)**
  *O que fazer:* a sessão roda como root e o CI não; criar `scripts/vistoria-comum.sh` (e `npm run vistoria:comum`) que copia o repositório limpo para uma pasta temporária, roda `npx vitest run` como usuário sem privilégio (`useradd -m` se faltar; `su`) e devolve o resultado. O PR descreve a linha que a Máxima deve acrescentar à regra do S-03 (a filha não edita `.claude/`).
  *Arquivo:* `scripts/vistoria-comum.sh`, `package.json`
  **Tela no app:** não se aplica.
  *Confirmação:* o script falha num teste que só passa como root (criado no teste do próprio script) e passa na `main`.
  *Origem:* corr-1.1 · S-03 · Backlog do milestone · máxima
