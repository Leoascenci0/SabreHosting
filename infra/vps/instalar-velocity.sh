#!/usr/bin/env bash
# Instala o proxy Velocity na máquina da nuvem (depois do instalar.sh): jar com SHA-256 conferido, segredo de
# modern forwarding gerado aqui, velocity.toml e unidade systemd (desligada).
# Idempotente. SABRE_SIMULAR=1 só registra os comandos; SABRE_ESTADO guarda o "estado" da simulação.
# SABRE_DESTINO=10.66.0.x:porta troca o servidor de destino inicial. Detalhes: infra/vps/velocity/LEIAME.md
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USUARIO=sabre
PASTA_JAR=/opt/sabre/velocity
PASTA_DADOS=/var/lib/sabre/velocity
SEGREDO="$PASTA_DADOS/forwarding.secret"
VERSAO="${SABRE_VELOCITY_VERSAO:-3.4.0-SNAPSHOT}"
DESTINO="${SABRE_DESTINO:-10.66.0.2:25565}"
API=https://fill.papermc.io/v3
PROTOCOLOS='=https'

simulando() { [ -n "${SABRE_SIMULAR:-}" ]; }
falhar() { echo "ERRO: $*" >&2; exit 1; }

if simulando; then
  ESTADO="${SABRE_ESTADO:-$(mktemp -d)}"
  mkdir -p "$ESTADO"
  # API e arquivo:// falsos só valem na simulação (os testes); de verdade é sempre https oficial.
  API="${SABRE_API_PAPERMC:-$API}"
  [ -z "${SABRE_API_PAPERMC:-}" ] || PROTOCOLOS='=https,file'
fi

executar() {
  if simulando; then echo "SIMULADO: $*"; else
    echo "+ $*" >&2
    "$@"
  fi
}

gravar() {
  local modo=$1 destino=$2 tmp
  if simulando; then
    echo "SIMULADO: GRAVAR $modo $destino"
    sed 's/^/SIMULADO:   | /'
    return 0
  fi
  echo "+ gravar $modo $destino" >&2
  tmp=$(mktemp)
  cat >"$tmp"
  install -m "$modo" -o "$USUARIO" -g "$USUARIO" "$tmp" "$destino"
  rm -f "$tmp"
}

# Mensagem de progresso: na simulação sai como comando simulado (os testes leem).
aviso() { if simulando; then echo "SIMULADO: $*"; else echo "+ $*" >&2; fi; }

ja_feito() {
  local chave=$1
  shift
  if simulando; then [ -e "$ESTADO/vel-$chave" ]; else "$@" >/dev/null 2>&1; fi
}
marcar() { if simulando; then : >"$ESTADO/vel-$1"; fi; }

# ---------- 0. Conferências antes de mudar qualquer coisa ----------

[ "${SABRE_FALSO_UID:-$(id -u)}" -eq 0 ] || falhar "rode como administrador: sudo bash infra/vps/instalar-velocity.sh"
simulando || id "$USUARIO" >/dev/null 2>&1 || falhar "o usuário $USUARIO não existe: rode primeiro infra/vps/instalar.sh."

# Destino só na rede privada (10.66.0.2 a 10.66.0.254); o .1 é o próprio hub.
OCTETO='([2-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-4])'
[[ "$DESTINO" =~ ^10\.66\.0\.$OCTETO:([0-9]{1,5})$ ]] || falhar "destino inválido '$DESTINO': use 10.66.0.x:porta (x de 2 a 254)."
PORTA_DESTINO="${BASH_REMATCH[2]}"
[ "$PORTA_DESTINO" -ge 1 ] && [ "$PORTA_DESTINO" -le 65535 ] || falhar "destino inválido '$DESTINO': porta de 1 a 65535."
[[ "$VERSAO" =~ ^[0-9][0-9A-Za-z.-]*$ ]] || falhar "versão do Velocity inválida: $VERSAO"

# ---------- 1. Jar: fonte oficial, SHA-256 conferido ANTES de usar ----------

jar_pronto() { test -s "$PASTA_JAR/velocity.jar"; }
if ! ja_feito jar jar_pronto; then
  aviso "baixar Velocity $VERSAO da API oficial do PaperMC"
  trabalho=$(mktemp -d)
  trap 'rm -rf "$trabalho"' EXIT
  meta=$(curl -fsSL --proto "$PROTOCOLOS" --max-time 30 "$API/projects/velocity/versions/$VERSAO/builds/latest") ||
    falhar "não consegui consultar a API do PaperMC."
  dados=$(node -e '
    const d = JSON.parse(require("fs").readFileSync(0, "utf8")).downloads["server:default"];
    console.log(d.url, d.checksums.sha256);' <<<"$meta") || falhar "resposta inesperada da API do PaperMC."
  read -r url_jar sha_esperado <<<"$dados"
  [[ "$sha_esperado" =~ ^[0-9a-f]{64}$ ]] || falhar "a API não trouxe um SHA-256 válido. Nada foi instalado."
  case "$url_jar" in
    https://*) ;;
    file://*) simulando || falhar "a URL do jar precisa ser https." ;;
    *) falhar "a URL do jar precisa ser https." ;;
  esac
  curl -fsSL --proto "$PROTOCOLOS" --max-time 300 --max-filesize 104857600 -o "$trabalho/velocity.jar" "$url_jar" ||
    falhar "o download do jar falhou."
  sha_real=$(sha256sum "$trabalho/velocity.jar" | cut -d' ' -f1)
  [ "$sha_real" = "$sha_esperado" ] || falhar "o hash do jar não confere (esperado $sha_esperado, veio $sha_real). Nada foi instalado."
  aviso "hash conferido: $sha_real"
  executar install -d -m 755 -o root -g root "$PASTA_JAR"
  executar install -m 644 -o root -g root "$trabalho/velocity.jar" "$PASTA_JAR/velocity.jar"
  marcar jar
fi

# ---------- 2. Pasta de dados e segredo de forwarding (gerado AQUI, nunca impresso) ----------

executar install -d -m 750 -o "$USUARIO" -g "$USUARIO" "$PASTA_DADOS"
if ! ja_feito segredo test -s "$SEGREDO"; then
  executar bash -c "umask 077 && head -c 48 /dev/urandom | base64 -w0 > '$SEGREDO'"
  executar chown "$USUARIO:$USUARIO" "$SEGREDO"
  executar chmod 600 "$SEGREDO"
  marcar segredo
fi

# ---------- 3. Configuração (só se ainda não existe: o rede-2.2 troca o destino, o Eliel pode ajustar) ----------

if ! ja_feito toml test -s "$PASTA_DADOS/velocity.toml"; then
  gravar 640 "$PASTA_DADOS/velocity.toml" <<FIM
# Gerado por infra/vps/instalar-velocity.sh. O segredo fica em forwarding.secret (nunca neste arquivo).
config-version = "2.7"
bind = "0.0.0.0:25565"
motd = "SabreHosting"
show-max-players = 20
# O proxy confere a conta Microsoft; o servidor do host fica com online-mode=false só na rede privada.
online-mode = true
force-key-authentication = true
player-info-forwarding-mode = "modern"
forwarding-secret-file = "forwarding.secret"
prevent-client-proxy-connections = false

[servers]
# Destino provisório na rede privada; o plugin do rede-2.2 passa a trocar pelo host da vez.
host = "$DESTINO"

try = ["host"]

[forced-hosts]
FIM
  marcar toml
fi

# Lista de quem pode entrar (um nome ou UUID por linha). O Velocity não tem whitelist nativa: ver LEIAME.md.
if ! ja_feito whitelist test -e "$PASTA_DADOS/whitelist.txt"; then
  gravar 640 "$PASTA_DADOS/whitelist.txt" <<'FIM'
# Um nome ou UUID de conta Microsoft por linha. Preenchido pelo cartório (itens seguintes).
FIM
  marcar whitelist
fi

# ---------- 4. Unidade systemd (instalada, DESLIGADA) ----------

if ! ja_feito unidade cmp -s "$AQUI/systemd/sabre-velocity.service" /etc/systemd/system/sabre-velocity.service; then
  executar install -m 644 "$AQUI/systemd/sabre-velocity.service" /etc/systemd/system/sabre-velocity.service
  executar systemctl daemon-reload
  marcar unidade
fi

echo "Pronto. A unidade sabre-velocity ficou DESLIGADA: leia infra/vps/velocity/LEIAME.md antes de ligar." >&2
