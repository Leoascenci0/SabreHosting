# Fonte comum do adicionar-pc.sh e do ajudante-entrada.sh (não roda sozinho: "source").
# Faixas da rede privada: hub 10.66.0.1; PCs definitivos 10.66.0.2–199; sala de entrada 10.66.0.200–254.
# SABRE_SIMULAR=1 não muda a máquina (só registra os comandos); o estado da simulação fica em SABRE_ESTADO.
# shellcheck shell=bash

INTERFACE=wg0
REDE_PREFIXO=10.66.0
REDE_PCS=10.66.0.0/24
PC_PRIMEIRO=2
PC_ULTIMO=199
SALA_PRIMEIRO=200
SALA_ULTIMO=254

simulando() { [ -n "${SABRE_SIMULAR:-}" ]; }
falhar() { echo "ERRO: $*" >&2; exit 1; }

# Caminhos de verdade ou da simulação. O registro fica numa pasta só do root: o usuário sabre não pode trocar o
# arquivo por um link simbólico e fazer o root escrever onde não deve.
preparar_caminhos() {
  if simulando; then
    ESTADO="${SABRE_ESTADO:-$(mktemp -d)}"
    mkdir -p "$ESTADO"
    CONF="$ESTADO/wg0.conf"
    REGISTRO="$ESTADO/pcs.tsv"
  else
    [ "$(id -u)" -eq 0 ] || falhar "rode como administrador: $1"
    CONF=/etc/wireguard/wg0.conf
    REGISTRO=/var/lib/sabre-wg/pcs.tsv
  fi
}

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

# Porta 1–65535, sem zero à esquerda (a porta 0 não existe para quem conecta).
endpoint_valido() { [[ ${1:-} =~ ^[A-Za-z0-9.-]+:[1-9][0-9]{0,4}$ ]] && [ "${1##*:}" -le 65535 ]; }

# ip_na_faixa <ip> <primeiro> <último>: só "10.66.0.N" com N sem zero à esquerda.
ip_na_faixa() {
  [[ ${1:-} =~ ^10\.66\.0\.([1-9][0-9]{0,2})$ ]] || return 1
  [ "${BASH_REMATCH[1]}" -ge "$2" ] && [ "${BASH_REMATCH[1]}" -le "$3" ]
}

# Escreve o arquivo inteiro de uma vez (arquivo novo na mesma pasta + mv): nunca fica meio escrito.
# Roda em subshell: o trap apaga o temporário se algo cair antes do mv, sem trocar o trap de quem chamou.
gravar_atomico() (
  destino=$1
  tmp=$(mktemp "$destino.XXXXXX")
  trap 'rm -f "$tmp"' EXIT
  cat >"$tmp"
  chmod 600 "$tmp"
  mv -f "$tmp" "$destino"
)

# Só uma execução por vez (dois cadastros ao mesmo tempo poderiam escolher o mesmo IP). Chamar só DEPOIS de validar
# os argumentos. Também garante o wg0.conf (na simulação, cria um vazio).
travar() {
  simulando || [ -e "$CONF" ] || falhar "não achei $CONF: rode antes infra/vps/instalar.sh."
  mkdir -p "$(dirname "$REGISTRO")"
  chmod 700 "$(dirname "$REGISTRO")"
  exec 9>"$REGISTRO.lock"
  flock 9
  [ -e "$REGISTRO" ] || : >"$REGISTRO"
  chmod 600 "$REGISTRO"
  [ -e "$CONF" ] || { simulando && base_conf | gravar_atomico "$CONF"; }
  [ -e "$CONF" ] || falhar "não achei $CONF: rode antes infra/vps/instalar.sh."
  chmod 600 "$CONF"
}

base_conf() {
  cat <<FIM
[Interface]
Address = $REDE_PREFIXO.1/24
ListenPort = 51820
PostUp = wg set %i private-key /etc/wireguard/hub.key

FIM
}

# Linhas do registro: nome<TAB>ip<TAB>chave-publica<TAB>ativo|removido|entrada
achar_ativo() { awk -F'\t' -v n="$1" '$1==n && $4=="ativo"' "$REGISTRO"; }
chave_em_uso() { awk -F'\t' -v k="$1" '$3==k && ($4=="ativo" || $4=="entrada")' "$REGISTRO"; }

# proximo_ip <primeiro> <último>: o primeiro IP da faixa que não aparece no registro.
proximo_ip() {
  local n
  for ((n = $1; n <= $2; n++)); do
    # Inclui os removidos: o IP de um PC que saiu nunca vai para outro.
    if ! awk -F'\t' -v ip="$REDE_PREFIXO.$n" '$2==ip {achou=1} END {exit !achou}' "$REGISTRO"; then
      echo "$REDE_PREFIXO.$n"
      return 0
    fi
  done
  return 1
}

sem_bloco() { # tira do wg0.conf o bloco que começa na linha <marca> até a linha em branco
  awk -v marca="$1" '
    $0 == marca { pular = 1; next }
    pular && $0 == "" { pular = 0; next }
    pular { next }
    { print }' "$CONF"
}

gravar_conf() ( # lê o novo conteúdo na entrada; confere antes de trocar (subshell + trap: como gravar_atomico)
  novo=$(mktemp "$CONF.XXXXXX")
  trap 'rm -f "$novo"' EXIT
  cat >"$novo"
  # Cada AllowedIPs é um único IP /32 e fica na faixa do seu bloco: "sabre-pc" 2–199, "sabre-entrada" 200–254.
  if ! awk -v p1="$PC_PRIMEIRO" -v p2="$PC_ULTIMO" -v s1="$SALA_PRIMEIRO" -v s2="$SALA_ULTIMO" '
    /^# sabre-pc: / { a = p1; b = p2; next }
    /^# sabre-entrada: / { a = s1; b = s2; next }
    /^AllowedIPs/ {
      if (!a || $0 !~ /^AllowedIPs = 10\.66\.0\.[1-9][0-9]?[0-9]?\/32$/) exit 1
      split($3, p, /[./]/); if (p[4] + 0 < a || p[4] + 0 > b) exit 1
    }
    /^$/ { a = 0 }' "$novo"; then
    falhar "wg0.conf teria um AllowedIPs fora da faixa do bloco ou que não é um único IP /32; nada foi alterado."
  fi
  chmod 600 "$novo"
  mv -f "$novo" "$CONF"
)

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

# adicionar_definitivo <nome> <chave> <endpoint>: cadastra (ou repete) o PC na faixa 2–199 e imprime o pacote JSON.
# Mesmo nome com a mesma chave devolve o mesmo IP; passos idempotentes: se algo caiu no meio, rodar de novo conserta.
adicionar_definitivo() {
  local nome=$1 chave=$2 endpoint=$3 hub_pub existente ip chave_antiga
  hub_pub=$(hub_chave_publica)
  chave_valida "$hub_pub" || falhar "não consegui ler a chave pública do hub."

  existente=$(achar_ativo "$nome")
  if [ -n "$existente" ]; then
    IFS=$'\t' read -r _ ip chave_antiga _ <<<"$existente"
    [ "$chave_antiga" = "$chave" ] || falhar "o PC '$nome' já existe com outra chave; remova-o antes."
  else
    [ -z "$(chave_em_uso "$chave")" ] || falhar "essa chave pública já pertence a outro PC."
    ip=$(proximo_ip "$PC_PRIMEIRO" "$PC_ULTIMO") ||
      falhar "a rede privada não tem mais endereço livre ($REDE_PREFIXO.$PC_PRIMEIRO a $REDE_PREFIXO.$PC_ULTIMO)."
    registrar "$nome" "$ip" "$chave" ativo
  fi
  { sem_bloco "# sabre-pc: $nome"; printf '# sabre-pc: %s\n[Peer]\nPublicKey = %s\nAllowedIPs = %s/32\n\n' "$nome" "$chave" "$ip"; } | gravar_conf
  executar wg set "$INTERFACE" peer "$chave" allowed-ips "$ip/32"
  printf '{"ip_pc":"%s","chave_publica_hub":"%s","endpoint":"%s","allowed_ips":"%s"}\n' "$ip" "$hub_pub" "$endpoint" "$REDE_PCS"
}
