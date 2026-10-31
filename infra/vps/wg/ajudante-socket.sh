#!/bin/bash
# Porta de entrada do ajudante da sala de entrada pelo socket /run/sabre/ajudante.sock (rede-1.5). Roda como root, uma
# vez por conexão (sabre-ajudante-entrada@.service, Accept=yes): a conexão é o stdin/stdout. Só confere o FORMATO do
# pedido; a validação de verdade mora no ajudante-entrada.sh.
#   pedido (1 linha): {"comando":"entrada-adicionar|entrada-trocar|entrada-remover","args":["…"]}
#   resposta (1 linha): o JSON do ajudante ({"ok":true} quando ele não imprime JSON);
#     {"codigo":1,"erro":"<linha ERRO do ajudante>"} = ajudante recusou (nada mudou);
#     {"codigo":2,"erro":"pedido recusado"} = pedido fora do formato (o ajudante nem foi chamado).
# Detalhes: infra/vps/LEIAME.md
set -uo pipefail

AJUDANTE="$(dirname "${BASH_SOURCE[0]}")/ajudante-entrada.sh"
ARG='"[A-Za-z0-9+/=.:-]{1,64}"'
PEDIDO="^\{\"comando\":\"(entrada-adicionar|entrada-trocar|entrada-remover)\",\"args\":\[($ARG(,$ARG){0,2})\]\}$"

recusar() { echo '{"codigo":2,"erro":"pedido recusado"}'; exit 0; }

# Uma linha só, com \n, em até 10 s; depois dela, nada mais (um 2º pedido na mesma conexão também é recusado).
IFS= read -r -t 10 -n 1024 linha || recusar
resto=
read -r -t 0.2 -n 1 resto
[ -z "$resto" ] || recusar
[[ $linha =~ $PEDIDO ]] || recusar
comando=${BASH_REMATCH[1]}
IFS=, read -r -a args <<<"${BASH_REMATCH[2]//\"/}"
case "$comando:${#args[@]}" in
  entrada-adicionar:1 | entrada-trocar:3 | entrada-remover:1) ;;
  *) recusar ;;
esac

# Ambiente limpo: nada do chamador chega ao ajudante. Simulação só fora do systemd (testes): todo serviço do systemd
# tem INVOCATION_ID, e a unidade ainda tira as variáveis de simulação (UnsetEnvironment).
ambiente=(PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin)
if [ -z "${INVOCATION_ID:-}" ] && [ -n "${SABRE_SIMULAR:-}" ]; then
  for v in SABRE_SIMULAR SABRE_ESTADO SABRE_ENDPOINT_HUB SABRE_CHAVE_PUB_HUB; do
    [ -n "${!v:-}" ] && ambiente+=("$v=${!v}")
  done
fi

erros=$(mktemp)
trap 'rm -f "$erros"' EXIT
saida=$(env -i "${ambiente[@]}" bash "$AJUDANTE" "$comando" "${args[@]}" 2>"$erros")
codigo=$?
if [ "$codigo" -eq 0 ]; then
  resposta=$(grep -m 1 '^{' <<<"$saida") || resposta='{"ok":true}'
  echo "$resposta"
elif [ "$codigo" -eq 2 ]; then
  recusar
else
  erro=$(grep -m 1 '^ERRO: ' "$erros" || head -n 1 "$erros")
  erro=$(printf '%s' "$erro" | tr -d '\000-\037' | sed 's/\\/\\\\/g; s/"/\\"/g')
  printf '{"codigo":1,"erro":"%s"}\n' "${erro:-ajudante falhou}"
fi
