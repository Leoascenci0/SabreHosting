#!/usr/bin/env bash
# Instala a sala de espera (limbo PicoLimbo) na máquina da nuvem, depois do instalar-velocity.sh: binário com SHA-256
# conferido, config só em 127.0.0.1 com o segredo do Velocity, unidade systemd (desligada).
# Idempotente. SABRE_SIMULAR=1 só registra os comandos; SABRE_ESTADO guarda o "estado" da simulação.
# Detalhes: infra/vps/limbo/LEIAME.md
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USUARIO=sabre
PASTA_BIN=/opt/sabre/limbo
PASTA_DADOS=/var/lib/sabre/limbo
CONFIG="$PASTA_DADOS/server.toml"
PASTA_VELOCITY=/var/lib/sabre/velocity
SEGREDO="$PASTA_VELOCITY/forwarding.secret"
PORTA=25566
PROTOCOLOS='=https'

simulando() { [ -n "${SABRE_SIMULAR:-}" ]; }
falhar() { echo "ERRO: $*" >&2; exit 1; }

if simulando; then
  ESTADO="${SABRE_ESTADO:-$(mktemp -d)}"
  mkdir -p "$ESTADO"
  [[ "${SABRE_LIMBO_URL:-}" != file://* ]] || PROTOCOLOS='=https,file'
fi

executar() {
  if simulando; then echo "SIMULADO: $*"; else
    echo "+ $*" >&2
    "$@"
  fi
}
aviso() { if simulando; then echo "SIMULADO: $*"; else echo "+ $*" >&2; fi; }
ja_feito() {
  local chave=$1
  shift
  if simulando; then [ -e "$ESTADO/limbo-$chave" ]; else "$@" >/dev/null 2>&1; fi
}
marcar() { if simulando; then : >"$ESTADO/limbo-$1"; fi; }

# Grava a config com o segredo do Velocity no lugar de @SEGREDO@. O segredo nunca passa por eco nem por log:
# na simulação só aparece o marcador.
gravar_config() {
  local conteudo tmp
  conteudo=$(cat)
  if simulando; then
    echo "SIMULADO: GRAVAR 600 $CONFIG"
    sed 's/^/SIMULADO:   | /' <<<"$conteudo"
    return 0
  fi
  echo "+ gravar 600 $CONFIG" >&2
  tmp=$(mktemp)
  chmod 600 "$tmp"
  SEG=$(<"$SEGREDO") awk '{ i = index($0, "@SEGREDO@"); if (i) $0 = substr($0, 1, i - 1) ENVIRON["SEG"] substr($0, i + 9); print }' \
    <<<"$conteudo" >"$tmp"
  install -m 600 -o "$USUARIO" -g "$USUARIO" "$tmp" "$CONFIG"
  rm -f "$tmp"
}

# ---------- 0. Conferências ----------

[ "${SABRE_FALSO_UID:-$(id -u)}" -eq 0 ] || falhar "rode como administrador: sudo bash infra/vps/limbo/instalar-limbo.sh"
if ! simulando; then
  id "$USUARIO" >/dev/null 2>&1 || falhar "o usuário $USUARIO não existe: rode primeiro infra/vps/instalar.sh."
  [ -s "$SEGREDO" ] || falhar "falta o segredo do Velocity: rode primeiro infra/vps/instalar-velocity.sh."
fi

# ---------- 1. Release fixa e SHA-256 (de arquivo do repositório; nunca da própria rede) ----------

ARQ="${SABRE_ARQUITETURA:-$(uname -m)}"
case "$ARQ" in x86_64 | aarch64) ;; *) falhar "arquitetura sem suporte: $ARQ." ;; esac
url="" sha_esperado=""
# shellcheck disable=SC1091
source "$AQUI/limbo-release.env"
eval "url=\${LIMBO_URL_$ARQ:-} sha_esperado=\${LIMBO_SHA256_$ARQ:-}"
if simulando; then
  url="${SABRE_LIMBO_URL-$url}"
  sha_esperado="${SABRE_LIMBO_SHA256-$sha_esperado}"
fi
[[ "$sha_esperado" =~ ^[0-9a-f]{64}$ ]] || falhar "SHA-256 do limbo não fixado em limbo-release.env. Nada foi instalado."
case "$url" in
  https://*) ;;
  file://*) simulando || falhar "a URL do limbo precisa ser https." ;;
  *) falhar "a URL do limbo precisa ser https." ;;
esac

# ---------- 2. Binário: temporário, hash conferido, só então instala ----------

binario_pronto() { test -s "$PASTA_BIN/picolimbo"; }
if ! ja_feito binario binario_pronto; then
  aviso "baixar o limbo (release fixa) de $url"
  trabalho=$(mktemp -d)
  trap 'rm -rf "$trabalho"' EXIT
  curl -fsSL --proto "$PROTOCOLOS" --max-time 300 --max-filesize 52428800 -o "$trabalho/picolimbo" "$url" ||
    falhar "o download do limbo falhou."
  sha_real=$(sha256sum "$trabalho/picolimbo" | cut -d' ' -f1)
  [ "$sha_real" = "$sha_esperado" ] || falhar "o hash do limbo não confere (esperado $sha_esperado, veio $sha_real). Nada foi instalado."
  aviso "hash conferido: $sha_real"
  executar install -d -m 755 -o root -g root "$PASTA_BIN"
  executar install -m 755 -o root -g root "$trabalho/picolimbo" "$PASTA_BIN/picolimbo"
  marcar binario
fi

# ---------- 3. Config: só em 127.0.0.1, modern forwarding (só se ainda não existe) ----------

executar install -d -m 750 -o "$USUARIO" -g "$USUARIO" "$PASTA_DADOS"
if ! ja_feito config test -s "$CONFIG"; then
  gravar_config <<FIM
# Gerado por infra/vps/limbo/instalar-limbo.sh. Contém o segredo do Velocity: modo 600, nunca vai para o git.
bind = "127.0.0.1:$PORTA"
welcome_message = "Trocando de casa… volta já"

[server_list]
max_players = 20
message_of_the_day = "SabreHosting - sala de espera"

[forwarding]
method = "MODERN"
secret = "@SEGREDO@"
FIM
  marcar config
fi

# ---------- 4. Registrar a sala de espera no velocity.toml que já existe ----------

espera_ok() { grep -q '^espera = ' "$PASTA_VELOCITY/velocity.toml"; }
if ! ja_feito espera espera_ok; then
  executar sed -i "/^\[servers\]/a espera = \"127.0.0.1:$PORTA\"" "$PASTA_VELOCITY/velocity.toml"
  marcar espera
fi

# ---------- 5. Unidade systemd (instalada, DESLIGADA) ----------

if ! ja_feito unidade cmp -s "$AQUI/../systemd/sabre-limbo.service" /etc/systemd/system/sabre-limbo.service; then
  executar install -m 644 "$AQUI/../systemd/sabre-limbo.service" /etc/systemd/system/sabre-limbo.service
  executar systemctl daemon-reload
  marcar unidade
fi

echo "Pronto. A unidade sabre-limbo ficou DESLIGADA: leia infra/vps/limbo/LEIAME.md antes de ligar." >&2
