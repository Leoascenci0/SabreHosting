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
executar install -d -m 750 -o "$USUARIO" -g "$USUARIO" /var/lib/sabre/cartorio

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
# A sala de entrada (10.66.0.200–254) fica de fora: as before.rules abaixo a barram antes desta regra.
executar ufw route allow in on wg0 out on wg0
# Cartório: só pela rede privada, só no IP do hub. Vale para os PCs definitivos (10.66.0.2–199); a sala de entrada
# já tem a regra própria nas before.rules abaixo.
executar ufw allow in on wg0 to 10.66.0.1 port 7710 proto tcp

# Sala de entrada (convite): só alcança o cartório em 10.66.0.1:7710; nada de repasse de/para outro PC. A faixa não é
# um bloco CIDR, então vai por intervalo (-m iprange) nas before.rules do ufw, que valem antes das regras comuns.
SALA=10.66.0.200-10.66.0.254
MARCA_SALA_INICIO="# sabre-sala-de-entrada: início (gravado pelo instalar.sh)"
MARCA_SALA_FIM="# sabre-sala-de-entrada: fim"
regras_sala() {
  cat <<FIM
$MARCA_SALA_INICIO
-A ufw-before-input -i wg0 -p tcp -m iprange --src-range $SALA -d 10.66.0.1 -m tcp --dport 7710 -j ACCEPT
-A ufw-before-input -m iprange --src-range $SALA -j DROP
-A ufw-before-forward -m iprange --src-range $SALA -j DROP
-A ufw-before-forward -m iprange --dst-range $SALA -j DROP
$MARCA_SALA_FIM
FIM
}
if simulando; then
  BEFORE_RULES=${SABRE_UFW_BEFORE_FALSO:-$ESTADO/before.rules}
  [ -e "$BEFORE_RULES" ] || printf '*filter\n:ufw-before-input - [0:0]\n:ufw-before-output - [0:0]\n:ufw-before-forward - [0:0]\n# End required lines\nCOMMIT\n' >"$BEFORE_RULES"
else
  BEFORE_RULES=/etc/ufw/before.rules
fi
# Bloco atual (entre as marcas) igual ao esperado = nada a fazer.
sala_no_firewall() {
  [ "$(awk -v i="$MARCA_SALA_INICIO" -v f="$MARCA_SALA_FIM" '$0==i{d=1} d{print} $0==f{d=0}' "$BEFORE_RULES")" = "$(regras_sala)" ]
}
if ! ja_feito sala-firewall sala_no_firewall; then
  [ "$(grep -cxF '# End required lines' "$BEFORE_RULES")" -eq 1 ] ||
    falhar "não reconheci $BEFORE_RULES (falta a linha '# End required lines'); firewall da sala de entrada não gravado."
  # Tira o bloco antigo (se houver) e põe o novo logo depois das linhas obrigatórias, antes de qualquer ACCEPT.
  awk -v i="$MARCA_SALA_INICIO" -v f="$MARCA_SALA_FIM" -v bloco="$(regras_sala)" '
    $0==i {pular=1} pular {if ($0==f) pular=0; next}
    {print} $0=="# End required lines" {print bloco}' "$BEFORE_RULES" | gravar 640 "$BEFORE_RULES"
  marcar sala-firewall
fi
executar ufw --force enable
executar ufw reload
gravar 644 /etc/sysctl.d/99-sabre.conf <<'FIM'
net.ipv4.ip_forward = 1
FIM
executar sysctl --system

# ---------- 5b. Segredo do cartório: gerado AQUI (root, 0600), nunca impresso ----------

SEGREDO_CARTORIO=/etc/sabre/cartorio.env
if ! ja_feito segredo-cartorio grep -Eq '^SABRE_CARTORIO_SEGREDO_ADMIN=[0-9a-f]{64}$' "$SEGREDO_CARTORIO"; then
  executar install -d -m 755 -o root -g root /etc/sabre
  executar bash "$AQUI/gerar-segredo.sh" "$SEGREDO_CARTORIO"
  executar chown root:root "$SEGREDO_CARTORIO"
  marcar segredo-cartorio
fi

# ---------- 5c. Ajudante da sala de entrada: serviço próprio (root) atrás de um socket; o cartório fica sem sudo ----------

executar install -d -m 755 -o root -g root /opt/sabre/wg
for arq in ajudante-entrada.sh:755 ajudante-socket.sh:755 comum.sh:644; do
  if ! ja_feito "wg-${arq%%:*}" cmp -s "$AQUI/wg/${arq%%:*}" "/opt/sabre/wg/${arq%%:*}"; then
    executar install -m "${arq##*:}" -o root -g root "$AQUI/wg/${arq%%:*}" "/opt/sabre/wg/${arq%%:*}"
    marcar "wg-${arq%%:*}"
  fi
done

# Registro dos PCs numa pasta só do root (antes ficava em /var/lib/sabre, que é do usuário sabre).
executar install -d -m 700 -o root -g root /var/lib/sabre-wg
if ! simulando && [ -f /var/lib/sabre/pcs.tsv ] && [ ! -L /var/lib/sabre/pcs.tsv ] && [ ! -e /var/lib/sabre-wg/pcs.tsv ]; then
  executar install -m 600 -o root -g root /var/lib/sabre/pcs.tsv /var/lib/sabre-wg/pcs.tsv
  executar rm -f /var/lib/sabre/pcs.tsv /var/lib/sabre/pcs.tsv.lock
fi

# Endereço do hub que o ajudante põe no pacote do PC (só quando informado: SABRE_ENDPOINT_HUB=host:porta).
if [ -n "${SABRE_ENDPOINT_HUB:-}" ]; then
  [[ $SABRE_ENDPOINT_HUB =~ ^[A-Za-z0-9.-]+:[0-9]{1,5}$ ]] && [ "${SABRE_ENDPOINT_HUB##*:}" -le 65535 ] ||
    falhar "SABRE_ENDPOINT_HUB precisa ser host:porta (ex.: 203.0.113.5:51820)."
  executar install -d -m 755 -o root -g root /etc/sabre
  printf 'SABRE_ENDPOINT_HUB=%s\n' "$SABRE_ENDPOINT_HUB" | gravar 644 /etc/sabre/hub.env
fi

# O sudoers do convite (rede-1.4) saiu: o cartório fala com o ajudante pelo socket /run/sabre/ajudante.sock.
if ! ja_feito sem-sudoers test ! -e /etc/sudoers.d/sabre-entrada; then
  executar rm -f /etc/sudoers.d/sabre-entrada
  marcar sem-sudoers
fi

# ---------- 6. Unidades systemd (de exemplo, DESLIGADAS; só o socket do ajudante fica ligado) ----------

for unidade in sabre-cartorio.service sabre-proxy.service sabre-ajudante-entrada.socket sabre-ajudante-entrada@.service; do
  if ! ja_feito "unidade-$unidade" cmp -s "$AQUI/systemd/$unidade" "/etc/systemd/system/$unidade"; then
    executar install -m 644 "$AQUI/systemd/$unidade" "/etc/systemd/system/$unidade"
    marcar "unidade-$unidade"
  fi
done
executar systemctl daemon-reload
# O socket do ajudante fica LIGADO (só root e o grupo sabre conectam); o ajudante só roda quando chega um pedido.
socket_ativo() { systemctl is-enabled -q sabre-ajudante-entrada.socket && systemctl is-active -q sabre-ajudante-entrada.socket; }
if ! ja_feito socket-ajudante socket_ativo; then
  executar systemctl enable --now sabre-ajudante-entrada.socket
  marcar socket-ajudante
fi

echo "Pronto. Falta: abrir as mesmas portas na 'Security List' da conta Oracle (tutorial rede-1.2)." >&2
if ! simulando && [ ! -s /etc/sabre/hub.env ]; then
  echo "Falta também: rodar de novo com SABRE_ENDPOINT_HUB=<ip-ou-nome-da-nuvem>:$PORTA_WG (o convite precisa dele)." >&2
fi
