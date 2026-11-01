# Plano appmel-1.23 — Ensaiar o empacotamento sem criar release

Método: M1 (estender `.github/workflows/versao.yml`), ~15 linhas de yml + testes em `tests/infra/versao.test.ts`.

1. Testes primeiro (falham antes): `workflow_dispatch` existe sem `branches`/`pull_request`; `--publish never` no electron-builder; checagem de tag, checksums e `gh release create` só em `push`; `upload-artifact` fixado por hash de 40 hex só em `workflow_dispatch`, com o .exe.
2. Workflow: `workflow_dispatch:` em `on:`; `if: github.event_name == 'push'` na checagem de tag, nos checksums e na release; `--publish never`; passo de `actions/upload-artifact@cf430e03… # v7.0.2` (SHA lido do repositório oficial com `git ls-remote`).
3. `electron-builder.json` (`files`) não muda: sem prova de que falta; a 1ª execução real mostra.
4. Fora do plano: criar tag, rodar o workflow, segredo, assinatura (D9).
5. Prova: `npm run vistoria` e `npm run vistoria:comum`.
