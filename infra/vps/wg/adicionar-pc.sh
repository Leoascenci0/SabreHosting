#!/usr/bin/env bash
# Cadastra (ou remove) um PC na rede privada, no hub (máquina na nuvem). Rode como administrador.
#   adicionar-pc.sh adicionar <nome-do-pc> <chave-publica-do-pc>   -> imprime o "pacote de ligação" (JSON)
#   adicionar-pc.sh remover <nome-do-pc>
# Só entra a chave PÚBLICA: a privada nasce no PC do amigo e nunca chega aqui.
# Variáveis: SABRE_ENDPOINT_HUB (obrigatória, "host:porta" que os PCs usam para achar o hub).
# SABRE_SIMULAR=1 não muda a máquina (só registra os comandos); o estado da simulação fica em SABRE_ESTADO.
# Detalhes e limites: infra/vps/LEIAME.md
set -euo pipefail
umask 077

INTERFACE=wg0
REDE_PREFIXO=10.66.0
REDE_PCS=10.66.0.0/24
PRIMEIRO=2
ULTIMO=254

simulando() { [ -n "${SABRE_SIMULAR:-}" ]; }
falhar() { echo "ERRO: $*" >&2; exit 1; }

if simulando; then
  ESTADO="${SABRE_ESTADO:-$(mktemp -d)}"
  mkdir -p "$ESTADO"
  CONF="$ESTADO/wg0.conf"
  REGISTRO="$ESTADO/pcs.tsv"
else
  [ "$(id -u)" -eq 0 ] || falhar "rode como administrador: sudo bash infra/vps/wg/adicionar-pc.sh ..."
  CONF=/etc/wireguard/wg0.conf
  REGISTRO=/var/lib/sabre/pcs.tsv
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

chave_valida() {
  local k=$1
  # 44 caracteres de base64 terminando em "=": 32 bytes. O 43º símbolo só pode ter os 2 bits finais zerados.
  [ "${#k}" -eq 44 ] || return 1
  [[ $k =~ ^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$ ]] || return 1
  [ "$(printf '%s' "$k" | base64 -d 2>/dev/null | wc -c)" -eq 32 ]
}

nome_valido() { [[ ${1:-} =~ ^[a-z0-9][a-z0-9-]{0,31}$ ]]; }

# Escreve o arquivo inteiro de uma vez (arquivo novo na mesma pasta + mv): nunca fica meio escrito.
gravar_atomico() {
  local destino=$1 tmp
  tmp=$(mktemp "$destino.XXXXXX")
  cat >"$tmp"
  chmod 600 "$tmp"
  mv -f "$tmp" "$destino"
}

# Confere a entrada ANTES de tocar em qualquer arquivo.
comando=${1:-}
nome=${2:-}
chave=${3:-}
endpoint=${SABRE_ENDPOINT_HUB:-}
nome_valido "$nome" || falhar "nome do PC inválido (use letras minúsculas, números e hífen, até 32 caracteres)."
case "$comando" in
  adicionar)
    chave_valida "$chave" || falhar "chave pública inválida (precisa ter 44 caracteres e terminar em '=')."
    [[ $endpoint =~ ^[A-Za-z0-9.-]+:[0-9]{1,5}$ ]] && [ "${endpoint##*:}" -le 65535 ] ||
      falhar "defina SABRE_ENDPOINT_HUB=host:porta (ex.: 203.0.113.5:51820)."
    ;;
  remover) ;;
  *) falhar "uso: adicionar-pc.sh adicionar <nome> <chave-publica> | remover <nome>" ;;
esac

# Só uma execução por vez (dois cadastros ao mesmo tempo poderiam escolher o mesmo IP).
mkdir -p "$(dirname "$REGISTRO")"
exec 9>"$REGISTRO.lock"
flock 9

[ -e "$REGISTRO" ] || : >"$REGISTRO"
chmod 600 "$REGISTRO"

# Linhas do registro: nome<TAB>ip<TAB>chave-publica<TAB>ativo|removido
achar_ativo() { awk -F'\t' -v n="$1" '$1==n && $4=="ativo"' "$REGISTRO"; }
chave_em_uso() { awk -F'\t' -v k="$1" '$3==k && $4=="ativo"' "$REGISTRO"; }

proximo_ip() {
  local n
  for ((n = PRIMEIRO; n <= ULTIMO; n++)); do
    # Inclui os removidos: o IP de um PC que saiu nunca vai para outro.
    if ! awk -F'\t' -v ip="$REDE_PREFIXO.$n" '$2==ip {achou=1} END {exit !achou}' "$REGISTRO"; then
      echo "$REDE_PREFIXO.$n"
      return 0
    fi
  done
  return 1
}

base_conf() {
  cat <<FIM
[Interface]
Address = $REDE_PREFIXO.1/24
ListenPort = 51820
PostUp = wg set %i private-key /etc/wireguard/hub.key

FIM
}

[ -e "$CONF" ] || { simulando && base_conf | gravar_atomico "$CONF"; }
[ -e "$CONF" ] || falhar "não achei $CONF: rode antes infra/vps/instalar.sh."
chmod 600 "$CONF"

sem_bloco() { # tira do wg0.conf o bloco "# sabre-pc: <nome>" até a linha em branco
  awk -v marca="# sabre-pc: $1" '
    $0 == marca { pular = 1; next }
    pular && $0 == "" { pular = 0; next }
    pular { next }
    { print }' "$CONF"
}

gravar_conf() { # lê o novo conteúdo na entrada; confere antes de trocar
  local novo
  novo=$(mktemp "$CONF.XXXXXX")
  cat >"$novo"
  if grep -E '^AllowedIPs' "$novo" | grep -vqE '^AllowedIPs = 10\.66\.0\.([2-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-4])/32$'; then
    rm -f "$novo"
    falhar "wg0.conf teria um AllowedIPs que não é um único IP /32; nada foi alterado."
  fi
  chmod 600 "$novo"
  mv -f "$novo" "$CONF"
}

registrar() { # nome ip chave estado: troca a linha do nome ativo (ou acrescenta)
  { awk -F'\t' -v n="$1" '!($1==n && $4=="ativo")' "$REGISTRO"; printf '%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4"; } | gravar_atomico "$REGISTRO"
}

hub_chave_publica() {
  if simulando; then
    echo "${SABRE_CHAVE_PUB_HUB:-$(printf '%043d=' 0 | tr 0 A)}"
  else
    wg show "$INTERFACE" public-key
  fi
}

case "$comando" in
  adicionar)
    hub_pub=$(hub_chave_publica)
    chave_valida "$hub_pub" || falhar "não consegui ler a chave pública do hub."

    existente=$(achar_ativo "$nome")
    if [ -n "$existente" ]; then
      IFS=$'\t' read -r _ ip chave_antiga _ <<<"$existente"
      [ "$chave_antiga" = "$chave" ] || falhar "o PC '$nome' já existe com outra chave; remova-o antes."
    else
      [ -z "$(chave_em_uso "$chave")" ] || falhar "essa chave pública já pertence a outro PC."
      ip=$(proximo_ip) || falhar "a rede privada não tem mais endereço livre (10.66.0.2 a 10.66.0.254)."
      registrar "$nome" "$ip" "$chave" ativo
    fi
    # Passos idempotentes: se algo caiu no meio, rodar de novo conserta.
    { sem_bloco "$nome"; printf '# sabre-pc: %s\n[Peer]\nPublicKey = %s\nAllowedIPs = %s/32\n\n' "$nome" "$chave" "$ip"; } | gravar_conf
    executar wg set "$INTERFACE" peer "$chave" allowed-ips "$ip/32"
    printf '{"ip_pc":"%s","chave_publica_hub":"%s","endpoint":"%s","allowed_ips":"%s"}\n' "$ip" "$hub_pub" "$endpoint" "$REDE_PCS"
    ;;
  remover)
    existente=$(achar_ativo "$nome")
    if [ -z "$existente" ]; then
      echo "O PC '$nome' não está cadastrado; nada a fazer."
      exit 0
    fi
    IFS=$'\t' read -r _ ip chave _ <<<"$existente"
    executar wg set "$INTERFACE" peer "$chave" remove
    sem_bloco "$nome" | gravar_conf
    registrar "$nome" "$ip" "$chave" removido
    echo "PC '$nome' removido (o endereço $ip não será usado por outro PC)."
    ;;
esac
