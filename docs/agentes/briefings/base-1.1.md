# Briefing base-1.1 — Monorepo TypeScript com as quatro pastas

BASE: 815fae8ea673455922d134cacc71b18da718d894 · RAMO: roadmap/base-1.1 · MODELO: sonnet · ISSUE: #1
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1 (checklist comum) e references/enxugar.md §1; integridade e seguranca não se aplicam
TRIAGEM: M7 (+M6 só para ferramentas de configuração) · ~120 linhas (quase tudo config; ~15 linhas de .ts de exemplo) ·
risco baixo · MIÚDO: não. REAPROVEITAR: scripts/verificar.py, scripts/limites.json, scripts/estado_roadmaps.py (só
ligar nos scripts npm); .claude/hooks/preparar-nuvem.sh já roda `npm ci` quando houver package.json; .githooks/pre-commit
já existe. NÃO ESCREVER: Electron como dependência (entra no app-1.1); CI/.github/workflows (é base-1.2); tests/mundos
(é base-1.3); lógica de trava, backup ou cartório; README/tutorial; mudanças no verificar.py. PASSOS: 1) package.json
raiz com workspaces + engines + scripts test/lint/vistoria; 2) tsconfig.base.json estrito + tsconfig por pacote,
ESLint (flat config) + Prettier, Vitest com um teste de exemplo por pacote; 3) DECISOES.md: deps e versão do Node.
PROVA: `npm ci && npm run vistoria` → APROVADA.

## Item (texto literal do roadmap)
- [ ] **1.1 — Monorepo TypeScript com as quatro pastas**
  *O que fazer:* criar `package.json` raiz com workspaces (`apps/desktop`, `packages/nucleo`, `services/cartorio`),
  TypeScript estrito, ESLint + Prettier, Vitest; um teste de exemplo em cada pacote; scripts `npm test`,
  `npm run lint`, `npm run vistoria` (lint + testes + `python3 scripts/verificar.py --base origin/main`).
  Registrar em `DECISOES.md` as dependências e a versão do Node (LTS).
  *Arquivo:* `package.json`, `tsconfig*.json`, `.eslintrc*`, `apps/desktop/`, `packages/nucleo/`, `services/cartorio/`
  **Tela no app:** não se aplica.
  *Confirmação:* `npm ci && npm run vistoria` → APROVADA na nuvem.
  *Depende de:* — · D8 decidida (Electron + TypeScript). SOZINHO na onda.

## Decisões que valem para este item
- D8 (30/10/2026): app desktop em Electron + TypeScript.
- Decidido pela Máxima (detalhe reversível): **Electron NÃO entra como dependência agora**; `apps/desktop` só com
  package.json, tsconfig e um teste de exemplo. Registrar em DECISOES "Electron entra no app-1.1".
- Decidido pela Máxima: **Node 22 LTS** (o que a nuvem tem: v22.22.0, npm 10.9.4); `engines.node: ">=22"` e `.nvmrc`
  com `22`. Pode usar `.eslintrc*` ou `eslint.config.*` (flat config, padrão atual do ESLint); diga no PR qual.
- Toda dependência nova = uma linha em `docs/ops/DECISOES.md` (é o único arquivo de docs/ops que este item toca).
- `package-lock.json` vai no commit (o `npm ci` precisa dele).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/base-1.1.md como primeiro commit
- [ ] Um teste de exemplo passando em cada um dos três pacotes
- [ ] `npm ci && npm run vistoria` APROVADA (lint + testes + verificador)
- [ ] `npm run lint` falha de verdade num erro de tipo ou de estilo (prove no PR, sem commitar o erro)
- [ ] PR com as seções do modelo, `Closes #1` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
