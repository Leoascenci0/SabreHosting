# Plano base-1.1 — Monorepo TypeScript com as quatro pastas

Método: M7 (config nova). Sem lógica de negócio; só o esqueleto que os próximos itens enchem.

1. `package.json` raiz (workspaces `apps/desktop`, `packages/nucleo`, `services/cartorio`), `engines.node >=22`, `.nvmrc` = 22.
   Scripts: `test`, `lint` (eslint + tsc), `vistoria` (lint + test + `scripts/verificar.py --base origin/main`).
2. `tsconfig.base.json` estrito + `tsconfig.json` por pacote; `eslint.config.js` (flat config) + Prettier; Vitest.
3. Um teste de exemplo por pacote (`src/exemplo.ts` + `.test.ts`, ~5 linhas cada).
4. `docs/ops/DECISOES.md`: dependências (typescript, eslint, typescript-eslint, prettier, vitest, @types/node), Node 22 LTS,
   "Electron entra no app-1.1".
5. Prova: `npm ci && npm run vistoria` APROVADA; erro de tipo/estilo faz `npm run lint` falhar (sem commitar).

Fora: Electron, CI, tests/mundos, README, mudanças no verificar.py.
