#!/usr/bin/env bash
# Cria o arquivo de ambiente do cartório com o segredo de admin. Uso: gerar-segredo.sh <arquivo>
# Idempotente: se o arquivo já tem um segredo no formato certo, só garante a permissão 0600 e não troca o valor.
# Arquivo fora do formato (vazio, truncado) é refeito. Nunca imprime o valor.
set -euo pipefail
arquivo=${1:?uso: gerar-segredo.sh <arquivo>}
if grep -Eq '^SABRE_CARTORIO_SEGREDO_ADMIN=[0-9a-f]{64}$' "$arquivo" 2>/dev/null; then
  chmod 600 "$arquivo"
  exit 0
fi
umask 077
seg=$(openssl rand -hex 32)
[[ "$seg" =~ ^[0-9a-f]{64}$ ]] || { echo "ERRO: não consegui gerar o segredo (openssl falhou). Nada foi gravado." >&2; exit 1; }
tmp=$(mktemp "$arquivo.XXXXXX")
trap 'rm -f "$tmp"' EXIT
printf 'SABRE_CARTORIO_SEGREDO_ADMIN=%s\n' "$seg" >"$tmp"
chmod 600 "$tmp"
mv "$tmp" "$arquivo"
