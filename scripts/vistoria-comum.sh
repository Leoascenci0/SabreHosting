#!/usr/bin/env bash
# Roda a suíte de testes como usuário SEM privilégio, como o CI faz (S-03: na sessão da nuvem somos root e
# o script que confere `id -u` passa onde o CI falha). Copia o repositório limpo (só o que está no HEAD) para
# uma pasta temporária e roda lá. Devolve o código de saída do comando de teste.
# Variáveis (só para teste do próprio script): SABRE_FALSO_UID, SABRE_COMUM_COMANDO, SABRE_COMUM_INSTALAR.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMANDO="${SABRE_COMUM_COMANDO:-npx vitest run}"
INSTALAR="${SABRE_COMUM_INSTALAR:-npm ci}"
USUARIO="teste"

if [ "${SABRE_FALSO_UID:-$(id -u)}" != "0" ]; then
  cd "$RAIZ"
  exec bash -c "$COMANDO"
fi

id "$USUARIO" >/dev/null 2>&1 || useradd -m "$USUARIO"
PASTA="$(mktemp -d)"
trap 'rm -rf "$PASTA"' EXIT
git -C "$RAIZ" archive HEAD | tar -x -C "$PASTA"
chown -R "$USUARIO" "$PASTA"
chmod 755 "$PASTA"

# su mantém parte do ambiente do root: repassa o PATH (para achar node/npm) e dá ao usuário um HOME e um cache do npm
# próprios (o de /root não é dele). Certificado extra do proxy, se existir, vai numa cópia legível pelo usuário.
CERT=""
if [ -n "${NODE_EXTRA_CA_CERTS:-}" ] && [ -r "$NODE_EXTRA_CA_CERTS" ]; then
  CERT="$PASTA/ca.pem"
  cp "$NODE_EXTRA_CA_CERTS" "$CERT"
  chown "$USUARIO" "$CERT"
fi
set +e
su -s /bin/bash "$USUARIO" -c "export PATH='$PATH' HOME='$PASTA' npm_config_cache='$PASTA/.npm' NODE_EXTRA_CA_CERTS='$CERT'; cd '$PASTA' && $INSTALAR && $COMANDO"
exit $?
