# Plano base-1.2 — CI no GitHub Actions

Método: M6 (cola de `actions/checkout` + `actions/setup-node`). Um arquivo, ~35 linhas, sem segredo.

1. `.github/workflows/vistoria.yml`: `on: pull_request` e `push` na `main` (nunca `pull_request_target`);
   `permissions: contents: read`; `ubuntu-latest`; `timeout-minutes` curto.
2. `actions/checkout@v4` com `fetch-depth: 0` para a ref `origin/main` existir (o verificador compara contra ela).
3. Em push na `main` o checkout deixa o ramo `main` ativo e o verificador reprova "você está na main":
   o passo `git checkout --detach` resolve só no CI, sem mexer em `scripts/verificar.py`.
4. `actions/setup-node@v4` com `node-version-file: .nvmrc` e cache npm; `npm ci`; `npm run vistoria`.
5. Prova: YAML validado; `npm run vistoria` local; `origin/main` presente e check verde no PR.

Fora: ligar a proteção da `main` (só descrita no PR), fixar actions por hash, mudar o verificador.
