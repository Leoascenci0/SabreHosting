# Plano — appmel-1.24 e appmel-1.25 (um ramo, um PR, um commit por item)

## 1.24 — limite exato de 30 min na reemissão do convite
- `services/cartorio/src/convite.test.ts`: caso novo com o relógio em exatamente 30 min após o uso → 200 (o cartório usa `>`).
- `apps/desktop/src/main/boas-vindas.ts`: comentário dizendo que o app usa `>=` (mais estrito que o cartório, de propósito).
- Prova: trocar `>` por `>=` em `banco.ts`, ver o teste novo falhar, voltar.

## 1.25 — `contents: write` só na release
- `versao.yml`: job `instalador` (contents: read, checkout com `persist-credentials: false`, sobe .exe + SHA256SUMS como artefato nos dois gatilhos) e job `release` (needs, só em push de tag, contents: write, baixa o artefato e roda `gh release create`). SHAs fixados, checksums e conferência de tag mantidos.
- `tests/infra/versao.test.ts`: fixa que o job do ensaio não tem `contents: write`, que o checkout não persiste credenciais e que só `release` escreve.
- Não roda o workflow no GitHub.
