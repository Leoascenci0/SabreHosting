#!/usr/bin/env bash
# Insere ou atualiza (idempotente) o bloco "roteador-modelo-esforco" no CLAUDE.md de um projeto.
# Uso: aplicar-no-projeto.sh <pasta-do-projeto> [arquivo-alvo, padrão CLAUDE.md; ex.: AGENTS.md]
# Não faz commit nem push. Quem chama cria a branch e commita (Regra 7).
set -euo pipefail

proj="${1:?uso: aplicar-no-projeto.sh <pasta-do-projeto> [arquivo-alvo]}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
snippet="$here/../references/snippet-claude-md.md"
target="$proj/${2:-CLAUDE.md}"
begin='<!-- BEGIN roteador-modelo-esforco'
end='<!-- END roteador-modelo-esforco'

[ -d "$proj" ] || { echo "pasta não existe: $proj" >&2; exit 1; }
[ -f "$snippet" ] || { echo "snippet não encontrado: $snippet" >&2; exit 1; }

if [ ! -f "$target" ]; then
  printf '# %s\n\n' "$(basename "$target")" > "$target"
fi

tmp="$(mktemp)"
if grep -qF "$begin" "$target"; then
  # Substitui o bloco existente pelo snippet atual.
  awk -v b="$begin" -v e="$end" -v s="$snippet" '
    index($0,b){skip=1; while((getline l < s)>0) print l; next}
    index($0,e){skip=0; next}
    !skip{print}
  ' "$target" > "$tmp"
  acao="atualizado"
else
  { cat "$target"; printf '\n'; cat "$snippet"; } > "$tmp"
  acao="inserido"
fi

if cmp -s "$tmp" "$target"; then
  echo "sem mudanças: $target"
  rm -f "$tmp"
else
  cat "$tmp" > "$target"
  rm -f "$tmp"
  echo "$acao: $target"
fi
