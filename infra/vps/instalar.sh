#!/usr/bin/env bash
# Instala a máquina na nuvem do SabreHosting (Ubuntu 22.04/24.04, ARM64 ou x86_64).
# Idempotente: pode rodar de novo sem recriar usuário, chave nem configuração.
# SABRE_SIMULAR=1 só registra os comandos (nada muda); SABRE_ESTADO guarda o "estado" da simulação.
# Detalhes e limites: infra/vps/LEIAME.md
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USUARIO=sabre
REDE_HUB=10.66.0.1/24
PORTA_WG=51820
CHAVE_HUB=/etc/wireguard/hub.key
# Impressão digital da chave do repositório oficial do Node (NodeSource); se mudar, o script para.
NODESOURCE_DIGITAL=6F71F525282841EEDAF851B42F59B5F99B1BE0B4

simulando() { [ -n "${SABRE_SIMULAR:-}" ]; }
falhar() { echo "ERRO: $*" >&2; exit 1; }

if simulando; then
  ESTADO="${SABRE_ESTADO:-$(mktemp -d)}"
  mkdir -p "$ESTADO"
fi

# Todo comando que muda a máquina passa por aqui.
executar() {
  if simulando; then
    echo "SIMULADO: $*"
  else
    echo "+ $*" >&2
    "$@"
  fi
}

# gravar <modo> <destino>: o conteúdo vem da entrada padrão.
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
  install -m "$modo" "$tmp" "$destino"
  rm -f "$tmp"
}

# ja_feito <chave> <teste real...>: na simulação olha o estado; de verdade roda o teste.
# SABRE_CHECAR_REAL=1 (só testes) faz a simulação rodar os testes reais, que só leem.
ja_feito() {
  local chave=$1
  shift
  if simulando && [ -z "${SABRE_CHECAR_REAL:-}" ]; then [ -e "$ESTADO/$chave" ]; else "$@" >/dev/null 2>&1; fi
}
marcar() { if simulando; then : >"$ESTADO/$1"; fi; }

# ---------- 0. Conferências antes de mudar qualquer coisa ----------

[ "${SABRE_FALSO_UID:-$(id -u)}" -eq 0 ] || falhar "rode como administrador: sudo bash infra/vps/instalar.sh"

if simulando && [ -n "${SABRE_OS_RELEASE_FALSO:-}" ]; then
  # shellcheck disable=SC1090
  . <(printf '%b\n' "$SABRE_OS_RELEASE_FALSO")
else
  # shellcheck disable=SC1091
  . /etc/os-release
fi
case "${ID:-}-${VERSION_ID:-}" in
  ubuntu-22.04 | ubuntu-24.04) ;;
  *) falhar "este script serve para Ubuntu 22.04 ou 24.04 (encontrei ${ID:-?} ${VERSION_ID:-?})." ;;
esac

# Sem chave autorizada para um usuário comum, desligar a senha trancaria o Eliel fora da máquina.
tem_chave_ssh() {
  local f
  for f in /home/*/.ssh/authorized_keys; do
    [ -s "$f" ] && return 0
  done
  return 1
}
if ! simulando && ! tem_chave_ssh; then
  falhar "nenhum usuário comum tem chave SSH autorizada (/home/*/.ssh/authorized_keys). Sem ela, desligar a senha trancaria você fora. Nada foi alterado."
fi

# ---------- 1. Pacotes ----------

PACOTES=(openjdk-21-jre-headless wireguard-tools ufw unattended-upgrades curl gnupg ca-certificates)

# Todos os pacotes precisam estar instalados (um faltando já refaz a instalação).
pacotes_prontos() {
  local p
  for p in "${PACOTES[@]}"; do
    dpkg -s "$p" >/dev/null 2>&1 || return 1
  done
}
# Node velho (ex.: o 18 do Ubuntu) não serve: só vale a linha 22.
node22_pronto() {
  [[ "$(node -v 2>/dev/null)" == v22.* ]]
}

if ! ja_feito pacotes pacotes_prontos; then
  executar apt-get update
  executar apt-get install -y --no-install-recommends "${PACOTES[@]}"
  marcar pacotes
fi

if ! ja_feito node22 node22_pronto; then
  # Node 22 pelo repositório oficial, só depois de conferir a impressão digital da chave.
  if simulando; then
    echo "SIMULADO: nodesource: baixar chave, conferir 1 chave com impressão digital $NODESOURCE_DIGITAL e gravar em /etc/apt/keyrings/nodesource.gpg"
  else
    install -d -m 755 /etc/apt/keyrings
    chave_tmp=$(mktemp)
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key -o "$chave_tmp"
    lista=$(gpg --show-keys --with-colons "$chave_tmp")
    [ "$(grep -c '^pub:' <<<"$lista")" -eq 1 ] || falhar "o arquivo de chave do Node não tem exatamente 1 chave. Nada foi instalado dele."
    digital=$(awk -F: '/^fpr:/{print $10; exit}' <<<"$lista")
    [ "$digital" = "$NODESOURCE_DIGITAL" ] || falhar "a chave do repositório do Node não confere (veio $digital). Nada foi instalado dela."
    gpg --dearmor <"$chave_tmp" >/etc/apt/keyrings/nodesource.gpg
    rm -f "$chave_tmp"
  fi
  gravar 644 /etc/apt/sources.list.d/nodesource.list <<'FIM'
deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main
FIM
  executar apt-get update
  executar apt-get install -y --no-install-recommends nodejs
  marcar node22
fi

# Atualizações de segurança automáticas.
if ! ja_feito auto-upgrades test -s /etc/apt/apt.conf.d/20auto-upgrades; then
  gravar 644 /etc/apt/apt.conf.d/20auto-upgrades <<'FIM'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
FIM
  marcar auto-upgrades
fi

# ---------- 2. Usuário sem privilégio e pastas ----------

if ! ja_feito usuario id "$USUARIO"; then
  executar useradd --system --home-dir /var/lib/sabre --shell /usr/sbin/nologin "$USUARIO"
  marcar usuario
fi
executar install -d -m 755 -o root -g root /opt/sabre
executar install -d -m 750 -o "$USUARIO" -g "$USUARIO" /var/lib/sabre

# ---------- 3. WireGuard (hub): chave gerada AQUI, nunca vem de fora ----------

if ! ja_feito chave-hub test -s "$CHAVE_HUB"; then
  executar bash -c "umask 077 && install -d -m 700 /etc/wireguard && wg genkey > '$CHAVE_HUB'"
  marcar chave-hub
fi

# A chave privada não entra no arquivo: o PostUp lê de $CHAVE_HUB. Os amigos entram como [Peer] nos itens seguintes.
if ! ja_feito wg0-conf test -s /etc/wireguard/wg0.conf; then
  gravar 600 /etc/wireguard/wg0.conf <<FIM
[Interface]
Address = $REDE_HUB
ListenPort = $PORTA_WG
PostUp = wg set %i private-key $CHAVE_HUB
FIM
  marcar wg0-conf
fi
# Habilitado mas parado também precisa subir.
wg0_ativo() { systemctl is-enabled -q wg-quick@wg0 && systemctl is-active -q wg-quick@wg0; }
if ! ja_feito wg0-ativo wg0_ativo; then
  executar systemctl enable --now wg-quick@wg0
  marcar wg0-ativo
fi

# ---------- 4. SSH só com chave, sem root ----------

# "00-" para ser lido antes de 50-cloud-init.conf (no sshd vale a primeira ocorrência).
if ! ja_feito ssh-conf test -s /etc/ssh/sshd_config.d/00-sabre.conf; then
  gravar 644 /etc/ssh/sshd_config.d/00-sabre.conf <<'FIM'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
FIM
  # Config inválida não pode derrubar o SSH: testa antes de recarregar e desfaz se falhar.
  executar bash -c "sshd -t || { rm -f /etc/ssh/sshd_config.d/00-sabre.conf; echo 'sshd_config inválido; mudança desfeita' >&2; exit 1; }"
  executar systemctl reload ssh
  marcar ssh-conf
fi

# ---------- 5. Firewall: entrada negada; só SSH, Minecraft e WireGuard ----------

executar ufw default deny incoming
executar ufw default allow outgoing
executar ufw default deny routed
# SSH PRIMEIRO, antes de ligar: ligar sem ele derrubaria a sessão atual.
executar ufw allow 22/tcp
executar ufw allow 25565/tcp
executar ufw allow "$PORTA_WG"/udp
# Repasse só dentro da rede privada (PC ↔ PC passando pelo hub); nada de wg0 ↔ internet.
executar ufw route allow in on wg0 out on wg0
executar ufw --force enable
gravar 644 /etc/sysctl.d/99-sabre.conf <<'FIM'
net.ipv4.ip_forward = 1
FIM
executar sysctl --system

# ---------- 6. Unidades systemd de exemplo (instaladas, DESLIGADAS) ----------

for unidade in sabre-cartorio.service sabre-proxy.service; do
  if ! ja_feito "unidade-$unidade" cmp -s "$AQUI/systemd/$unidade" "/etc/systemd/system/$unidade"; then
    executar install -m 644 "$AQUI/systemd/$unidade" "/etc/systemd/system/$unidade"
    marcar "unidade-$unidade"
  fi
done
executar systemctl daemon-reload

echo "Pronto. Falta: abrir as mesmas portas na 'Security List' da conta Oracle (tutorial rede-1.2)." >&2
