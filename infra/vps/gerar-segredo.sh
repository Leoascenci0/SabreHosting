#!/usr/bin/env bash
# Cria o arquivo de ambiente do cartório com o segredo de admin. Uso: gerar-segredo.sh <arquivo>
# Idempotente: se o arquivo já existe e não está vazio, não troca o segredo. Nunca imprime o valor.
set -euo pipefail
arquivo=${1:?uso: gerar-segredo.sh <arquivo>}
[ -s "$arquivo" ] && exit 0
umask 077
tmp=$(mktemp "$arquivo.XXXXXX")
trap 'rm -f "$tmp"' EXIT
printf 'SABRE_CARTORIO_SEGREDO_ADMIN=%s\n' "$(openssl rand -hex 32)" >"$tmp"
chmod 600 "$tmp"
mv "$tmp" "$arquivo"
