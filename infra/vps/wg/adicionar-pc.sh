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

# shellcheck source-path=SCRIPTDIR source=comum.sh
. "$(dirname "${BASH_SOURCE[0]}")/comum.sh"
preparar_caminhos "sudo bash infra/vps/wg/adicionar-pc.sh ..."

# Confere a entrada ANTES de tocar em qualquer arquivo.
comando=${1:-}
nome=${2:-}
chave=${3:-}
endpoint=${SABRE_ENDPOINT_HUB:-}
nome_valido "$nome" || falhar "nome do PC inválido (use letras minúsculas, números e hífen, até 32 caracteres)."
case "$comando" in
  adicionar)
    chave_valida "$chave" || falhar "chave pública inválida (precisa ter 44 caracteres e terminar em '=')."
    endpoint_valido "$endpoint" || falhar "defina SABRE_ENDPOINT_HUB=host:porta (ex.: 203.0.113.5:51820)."
    ;;
  remover) ;;
  *) falhar "uso: adicionar-pc.sh adicionar <nome> <chave-publica> | remover <nome>" ;;
esac

travar

case "$comando" in
  adicionar)
    adicionar_definitivo "$nome" "$chave" "$endpoint"
    ;;
  remover)
    existente=$(achar_ativo "$nome")
    if [ -z "$existente" ]; then
      echo "O PC '$nome' não está cadastrado; nada a fazer."
      exit 0
    fi
    IFS=$'\t' read -r _ ip chave _ <<<"$existente"
    executar wg set "$INTERFACE" peer "$chave" remove
    sem_bloco "# sabre-pc: $nome" | gravar_conf
    registrar "$nome" "$ip" "$chave" removido
    echo "PC '$nome' removido (o endereço $ip não será usado por outro PC)."
    ;;
esac
