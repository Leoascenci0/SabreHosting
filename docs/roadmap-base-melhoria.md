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

- [x] **1.3 — Testes estáveis sob carga** (PR #43, 30/10/2026)
  *O que fazer:* o teste de corrida da trava (`services/cartorio/src/trava.test.ts`, "10 workers … 20 rodadas") exige que
  os perdedores vejam a época da MESMA rodada; sob carga, um perdedor atrasado lê a época de uma rodada seguinte e o
  teste falha (a garantia "exatamente 1 ganha" continua valendo). Sincronizar as rodadas (barreira: a rodada N+1 só
  começa quando todos os workers responderam a N) ou conferir só que a época vista pelo perdedor é ≥ a do vencedor.
  Prazo explícito (30 s) nos testes pesados de 20 MB (`packages/nucleo/test/mundos.test.ts`,
  `packages/nucleo/src/backup/manifesto.test.ts`). Achado na Onda 6: 1 falha em 15 rodadas normais; 2–4 falhas por
  rodada com 4 vitest em paralelo.
  *Arquivo:* `services/cartorio/src/trava.test.ts`, `services/cartorio/src/trava-corrida.worker.mjs`, os testes citados
  **Tela no app:** não se aplica.
  *Confirmação:* 4 `npx vitest run` em paralelo, 3 vezes seguidas, sem falha.
  *Origem:* onda 6 · revisão da orquestradora

- [x] **1.4 — Verificador barra marcador de conflito de merge** (PR #65, 31/10/2026)
  *O que fazer:* `scripts/verificar.py` recusa arquivo com linha que começa com `<<<<<<< `, `=======` sozinho ou
  `>>>>>>> ` (em `--staged` e `--base`). Aconteceu na Onda 6: um commit de controle levou um conflito do
  `docs/ops/DECISOES.md` e o verificador aprovou.
  *Arquivo:* `scripts/verificar.py`
  **Tela no app:** não se aplica.
  *Confirmação:* commit de teste com marcador → REPROVADO; `.md` com `=======` como sublinhado de título não é falso positivo
  (exigir o trio ou a linha exata `=======` entre `<<<<<<<` e `>>>>>>>`).
  *Origem:* onda 6 · orquestradora
