# Roadmap — Base (fundação do repositório)

Objetivo: deixar o repositório pronto para todo o resto: pastas, ferramentas, testes, vistoria, CI e mundos de teste.
Nenhuma funcionalidade para o amigo ainda.

**Sigla `base`.** Ramos `roadmap/base-<id>`. Um item, um chat, um PR. Item que cria configuração tem a linha
**Tela no app:**; os outros dizem *não se aplica*. Item **ESPERA DECISÃO Dx** não vai para agente até o Eliel
responder (ver `docs/MILESTONE.md`).

**Regras que valem para todos os itens:** `CLAUDE.md` inteiro; regras de ouro do mundo; nenhum segredo; nenhuma
dependência sem linha em `DECISOES.md` (este roadmap registra as da fundação).

## Bloco 1 — Esqueleto

- [x] **1.1 — Monorepo TypeScript com as quatro pastas** (PR #3, 30/10/2026)
  *O que fazer:* criar `package.json` raiz com workspaces (`apps/desktop`, `packages/nucleo`, `services/cartorio`),
  TypeScript estrito, ESLint + Prettier, Vitest; um teste de exemplo em cada pacote; scripts `npm test`,
  `npm run lint`, `npm run vistoria` (lint + testes + `python3 scripts/verificar.py --base origin/main`).
  Registrar em `DECISOES.md` as dependências e a versão do Node (LTS).
  *Arquivo:* `package.json`, `tsconfig*.json`, `.eslintrc*`, `apps/desktop/`, `packages/nucleo/`, `services/cartorio/`
  **Tela no app:** não se aplica.
  *Confirmação:* `npm ci && npm run vistoria` → APROVADA na nuvem.
  *Depende de:* — · D8 decidida (Electron + TypeScript). SOZINHO na onda.

- [x] **1.2 — CI no GitHub Actions** (PR #7, 30/10/2026; proteção da main descrita no PR para o Eliel ligar)
  *O que fazer:* workflow que roda `npm ci` + `npm run vistoria` em todo PR e push na `main` (Ubuntu); PR de fork roda
  sem segredos (`pull_request`, nunca `pull_request_target`). Proteção da `main` documentada no PR para o Eliel ligar.
  *Arquivo:* `.github/workflows/vistoria.yml`
  **Tela no app:** não se aplica.
  *Confirmação:* o próprio PR mostra o check verde.
  *Depende de:* base-1.1

- [x] **1.3 — Gerador de mundos de teste** (PR #9, 30/10/2026)
  *O que fazer:* script que cria em `tests/mundos/` mundos pequenos e falsos (pasta com `level.dat` mínimo e alguns
  `region/r.X.Z.mca` com bytes aleatórios determinísticos), em 3 tamanhos (1 MB, 20 MB, 200 MB sob demanda, este não
  commitado). Funções de ajuda para os testes ("mudar 2 regiões", "corromper 1 arquivo").
  *Arquivo:* `packages/nucleo/test/ajuda/mundos.ts`, `tests/mundos/README.md`
  **Tela no app:** não se aplica.
  *Confirmação:* teste que gera, muda 2 regiões e confere que só elas mudaram de hash.
  *Depende de:* base-1.1

## Bloco 2 — Comunidade

- [x] **2.1 — Issues e rótulos para contribuidores** (PR #8, 30/10/2026; falta o Eliel criar os rótulos, ver docs/ops/rotulos.md)
  *O que fazer:* modelos de issue (bug, ideia, item de roadmap) em pt-BR; lista de rótulos sugeridos
  (`bom-primeiro-item`, `seguranca`, `mundo`, `app`, `nuvem`) num documento para o Eliel criar.
  *Arquivo:* `.github/ISSUE_TEMPLATE/*.yml`, `docs/ops/rotulos.md`
  **Tela no app:** não se aplica.
  *Confirmação:* "New issue" no GitHub mostra os modelos.
  *Depende de:* —
