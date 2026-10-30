# Plano rede-1.2 — Tutorial: criar a máquina na nuvem

Método: M3 (molde dos LEIAME de `infra/vps`). Só texto, sem código. Risco médio: a instrução mexe em conta e rede
(Security List, SSH, firewall); erro de porta ou de chave deixa a máquina aberta ou o Eliel trancado fora.
Regras: nenhum IP, conta, chave ou senha de verdade (só exemplos óbvios, como `203.0.113.10`); não ligar o proxy
(`sabre-velocity` fica desligado); não tocar máquina real.

1. Reler `instalar.sh`, `instalar-velocity.sh` e os dois LEIAME para listar o que o tutorial precisa citar: portas
   (22/tcp, 25565/tcp, 51820/udp), caminhos (`/etc/wireguard/hub.key`, `/var/lib/sabre/velocity/forwarding.secret`),
   serviços (`wg-quick@wg0`, `sabre-cartorio`, `sabre-proxy`, `sabre-velocity`), rede `10.66.0.1/24`.
2. Escrever `docs/tutoriais/rede-criar-maquina.md` em pt-BR para quem não programa: 7 passos do briefing (conta Oracle
   e "Out of capacity", instância Ampere A1 Ubuntu 24.04 4 OCPU/24 GB, chave SSH, Security List, SSH + clone + conferir
   a impressão digital da chave NodeSource + `instalar.sh`, onde ficam os segredos, como conferir, o que NÃO fazer).
   Siglas abertas na primeira vez; "onde clicar" em texto; quadro "Se der errado" por passo.
3. Conferir texto × scripts (portas, caminhos, serviços, nomes) com `grep` e listar as conferências no PR.
4. `npm run vistoria`; PR `Closes #49`.
