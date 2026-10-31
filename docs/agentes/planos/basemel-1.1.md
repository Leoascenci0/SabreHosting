# Plano basemel-1.1 — Fixar as actions do CI por hash de commit

Método: M7 (edição de YAML). Dois arquivos, ~25 linhas, sem segredo, sem código novo.

1. Conferir os hashes com `git ls-remote` na tag exata (tags leves): `actions/checkout` v4.2.2 e
   `actions/setup-node` v4.4.0. Se bater com o briefing, seguir.
2. `.github/workflows/vistoria.yml`: trocar `@v4` por `@<hash de 40 hex>  # vX.Y.Z`, mantendo o resto do
   arquivo igual (nada de `permissions`, `fetch-depth`, `.nvmrc` ou passos npm).
3. `.github/dependabot.yml` (não existe): `version: 2`, `package-ecosystem: github-actions`, `directory: /`,
   `schedule: interval weekly`. Só GitHub Actions, sem ecossistema npm.
4. Prova: grep de `uses:` mostra só hash de 40 hex com comentário de versão; `ls-remote` bate com o hash;
   YAML carrega (`python3 -c "import yaml"` ou `node`); `npm run vistoria` APROVADA.
5. Fora do escopo: verificador novo de `uses:` sem hash (vira melhoria, se o Eliel quiser).
