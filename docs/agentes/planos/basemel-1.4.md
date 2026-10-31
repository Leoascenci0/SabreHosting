# Plano basemel-1.4 — Verificador barra marcador de conflito de merge

Issue #63 · ramo `roadmap/basemel-1.4` · método M3 (molde das checagens de `scripts/verificar.py`).

## Desenho
- `scripts/verificar.py`: função `achar_conflito(texto)` devolve o número da linha do bloco de conflito: linha que
  começa com `<<<<<<< `, depois linha exatamente `=======`, depois linha que começa com `>>>>>>> `.
- Roda para todo arquivo de texto do diff (`--staged` e `--base`), inclusive o próprio verificador e as docs de
  segurança (sem tratamento especial). Erro: `arquivo:linha: marcador de conflito de merge`.
- `=======` sozinho (sublinhado de título Markdown) não reprova: exige o trio na ordem.
- O verificador não pode conter o trio literal em linhas começando por esses marcadores (monta as strings por concatenação).

## Testes (primeiro, vermelhos)
`tests/infra/verificar.test.ts`: cria repo git temporário, roda `verificar.py --staged`:
1. arquivo com o trio → REPROVADO com arquivo e linha.
2. `.md` com título sublinhado por `=======` → APROVADO.
3. `<<<<<<<` sem fechamento (`>>>>>>>`) → APROVADO (exige o trio).

## Entrega
`npm run vistoria`, PR com `Closes #63`.
