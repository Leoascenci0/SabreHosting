#!/bin/bash
# Ajudante da sala de entrada (convite do grupo). Roda como root; o cartório (usuário sabre, sem sudo) pede pelo
# socket /run/sabre/ajudante.sock, e o ajudante-socket.sh (serviço do systemd) chama este script com ambiente limpo.
# Toda a validação mora aqui.
#   entrada-adicionar <chave-pub-prov>               -> {"ip":"10.66.0.2xx"} (sala 200–254; mesma chave = mesmo IP)
#   entrada-trocar <ip-prov> <nome> <chave-pub-def>  -> pacote do adicionar-pc.sh (PC 2–199); NÃO tira o provisório
#   entrada-remover <ip-prov>                        -> tira o provisório (só 200–254 em estado "entrada")
# Códigos: 0 ok; 1 validação/erro ("ERRO:" no stderr, nada alterado); 2 comando fora da lista ou uso errado.
# Endpoint do hub: /etc/sabre/hub.env (SABRE_ENDPOINT_HUB=host:porta, gravado pelo instalar.sh).
# Detalhes e limites: infra/vps/LEIAME.md
set -euo pipefail
umask 077

# Rodado à mão pelo sudo: nada de simulação nem caminho vindo de fora (pelo socket, o wrapper já limpa o ambiente).
if [ -n "${SUDO_USER:-}" ]; then
  unset SABRE_SIMULAR SABRE_ESTADO SABRE_ENDPOINT_HUB SABRE_CHAVE_PUB_HUB
fi

# shellcheck source-path=SCRIPTDIR source=comum.sh
. "$(dirname "${BASH_SOURCE[0]}")/comum.sh"

uso() {
  echo "uso: ajudante-entrada.sh entrada-adicionar <chave> | entrada-trocar <ip-prov> <nome> <chave> | entrada-remover <ip-prov>" >&2
  exit 2
}

# Confere a entrada ANTES de tocar em qualquer arquivo (e antes do lock).
comando=${1:-}
case "$comando:$#" in
  entrada-adicionar:2)
    chave=$2
    chave_valida "$chave" || falhar "chave pública inválida (precisa ter 44 caracteres e terminar em '=')."
    ;;
  entrada-trocar:4)
    ip_prov=$2 nome=$3 chave=$4
    ip_na_faixa "$ip_prov" "$SALA_PRIMEIRO" "$SALA_ULTIMO" || falhar "IP provisório fora da sala de entrada (10.66.0.200 a 10.66.0.254)."
    nome_valido "$nome" || falhar "nome do PC inválido (use letras minúsculas, números e hífen, até 32 caracteres)."
    chave_valida "$chave" || falhar "chave pública inválida (precisa ter 44 caracteres e terminar em '=')."
    if simulando; then
      endpoint=${SABRE_ENDPOINT_HUB:-}
    else
      endpoint=$(sed -n 's/^SABRE_ENDPOINT_HUB=//p' /etc/sabre/hub.env 2>/dev/null | head -n 1)
    fi
    endpoint_valido "$endpoint" || falhar "endereço do hub não configurado (SABRE_ENDPOINT_HUB=host:porta em /etc/sabre/hub.env)."
    ;;
  entrada-remover:2)
    ip_prov=$2
    ip_na_faixa "$ip_prov" "$SALA_PRIMEIRO" "$SALA_ULTIMO" || falhar "IP provisório fora da sala de entrada (10.66.0.200 a 10.66.0.254)."
    ;;
  *) uso ;;
esac

preparar_caminhos "o ajudante da sala de entrada só roda como root (pelo serviço do socket)."
travar

# A linha do registro com esse IP (qualquer estado).
linha_do_ip() { awk -F'\t' -v ip="$1" '$2==ip' "$REGISTRO"; }

case "$comando" in
  entrada-adicionar)
    ip=$(awk -F'\t' -v k="$chave" '$3==k && $4=="entrada" {print $2; exit}' "$REGISTRO")
    if [ -z "$ip" ]; then
      [ -z "$(chave_em_uso "$chave")" ] || falhar "essa chave pública já pertence a um PC."
      ip=$(proximo_ip "$SALA_PRIMEIRO" "$SALA_ULTIMO") || falhar "a sala de entrada está cheia (10.66.0.200 a 10.66.0.254); espere um convite vencer."
      { cat "$REGISTRO"; printf 'entrada\t%s\t%s\tentrada\n' "$ip" "$chave"; } | gravar_atomico "$REGISTRO"
    fi
    { sem_bloco "# sabre-entrada: $ip"; printf '# sabre-entrada: %s\n[Peer]\nPublicKey = %s\nAllowedIPs = %s/32\n\n' "$ip" "$chave" "$ip"; } | gravar_conf
    executar wg set "$INTERFACE" peer "$chave" allowed-ips "$ip/32"
    printf '{"ip":"%s"}\n' "$ip"
    ;;
  entrada-trocar)
    IFS=$'\t' read -r _ _ chave_prov estado <<<"$(linha_do_ip "$ip_prov")"
    [ "${estado:-}" = entrada ] || falhar "o IP $ip_prov não é de um convite em andamento."
    [ "$chave" != "$chave_prov" ] || falhar "a chave definitiva não pode ser a provisória."
    adicionar_definitivo "$nome" "$chave" "$endpoint"
    ;;
  entrada-remover)
    linha=$(linha_do_ip "$ip_prov")
    if [ -z "$linha" ]; then
      echo "Nenhum convite em andamento em $ip_prov; nada a fazer."
      exit 0
    fi
    IFS=$'\t' read -r _ _ chave_prov estado <<<"$linha"
    [ "$estado" = entrada ] || falhar "o IP $ip_prov não é de um convite em andamento; nada foi alterado."
    executar wg set "$INTERFACE" peer "$chave_prov" remove
    sem_bloco "# sabre-entrada: $ip_prov" | gravar_conf
    # O IP da sala volta a ficar livre (a sala tem só 55 vagas).
    awk -F'\t' -v ip="$ip_prov" '$2!=ip' "$REGISTRO" | gravar_atomico "$REGISTRO"
    echo "Convite em $ip_prov encerrado na rede privada."
    ;;
esac
