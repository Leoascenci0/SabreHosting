#!/usr/bin/env bash
# Ativa skills do catálogo Leoascenci0/skills neste ramo (CLAUDE.md, "Skills sob demanda"). Adaptado do SEURBH.
# Uso: bash .claude/ativar-skill.sh <nome ou prefixo> [...]   ex.: bash .claude/ativar-skill.sh secrets-management
# Na nuvem, antes: add_repo Leoascenci0/skills.
set -euo pipefail
[ $# -ge 1 ] || { echo "uso: bash .claude/ativar-skill.sh <nome ou prefixo> [...]"; exit 1; }
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
CATALOGO="${CATALOGO:-/home/user/skills}"
if [ ! -d "$CATALOGO/.git" ]; then
  git clone -q --depth 1 https://github.com/Leoascenci0/skills "$CATALOGO"
fi
achou=0
for prefixo in "$@"; do
  for pasta in "$CATALOGO"/"$prefixo"*/; do
    [ -f "$pasta/SKILL.md" ] || continue
    nome="$(basename "$pasta")"
    cp -R "$pasta" "$RAIZ/.claude/skills/$nome"
    echo "ativada: $nome"; achou=1
  done
done
[ "$achou" = 1 ] || { echo "nada no catálogo casa com: $*"; exit 1; }
echo "Diga na resposta quais skills foram ativadas; elas carregam no próximo turno."
