# Plano rede-1.1 — Script de instalação da máquina na nuvem

Método: M7 (script novo). Risco alto: firewall e SSH; um erro aqui tranca o Eliel fora da máquina ou abre porta demais.
Regras: nunca tocar máquina de verdade (só simulação); nenhum segredo no git (chave do WireGuard gerada na máquina, `umask 077`).

1. Testes primeiro (falham, o script não existe): `tests/infra/instalar.test.ts` roda `SABRE_SIMULAR=1` duas vezes
   com o mesmo estado e confere: 1ª vez cria usuário, chave, `wg0` e regras; 2ª vez não cria usuário nem chave nem
   `wg0.conf`; `ufw allow` são exatamente 22/tcp, 25565/tcp, 51820/udp; entrada negada por padrão; SSH só com chave
   e SSH liberado antes do `ufw enable`; unidades systemd instaladas mas nunca habilitadas; nenhum segredo no script;
   recusa fora do Ubuntu 22.04/24.04 e sem root.
2. `infra/vps/instalar.sh`: `set -euo pipefail`; função `executar` (só registra em simulação); estado de simulação em
   pasta (`SABRE_ESTADO`) para provar idempotência sem Docker. Passos: pacotes (Java 21 headless, Node 22 pelo
   repositório oficial com impressão digital da chave conferida, wireguard-tools, ufw, unattended-upgrades); usuário
   `sabre` de sistema sem sudo e sem shell; `/opt/sabre`, `/var/lib/sabre`; chave do hub só se não existir; `wg0` em
   10.66.0.1/24 sem chave dentro do arquivo; SSH só chave (arquivo `00-` para vencer o do cloud-init; recusa se não
   houver chave autorizada, para não trancar o Eliel); firewall (negar entrada, SSH primeiro, depois as 3 portas);
   repasse de IP só wg0→wg0; unidades systemd de exemplo (desligadas).
3. `infra/vps/systemd/*.service`, `infra/vps/teste/Dockerfile` (simulação duas vezes + `bash -n` + shellcheck),
   `infra/vps/LEIAME.md`.
4. `npm run vistoria`; PR `Closes #40`.
