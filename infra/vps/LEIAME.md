# Máquina na nuvem — instalação

`instalar.sh` prepara uma máquina **Ubuntu 22.04 ou 24.04** (Oracle Always Free, ARM64) para o SabreHosting. Pode rodar
mais de uma vez: o que já existe (usuário, chave, configuração) não é recriado.

```
sudo bash infra/vps/instalar.sh          # de verdade
SABRE_SIMULAR=1 bash infra/vps/instalar.sh   # só mostra o que faria; não muda nada
```

## O que faz

- Instala Java 21, Node 22 (repositório oficial, chave conferida pela impressão digital), WireGuard, firewall e
  atualizações automáticas de segurança.
- Cria o usuário `sabre` (sem sudo, sem shell) e as pastas `/opt/sabre` e `/var/lib/sabre`.
- Gera a chave do hub WireGuard **na própria máquina** (`/etc/wireguard/hub.key`, permissão 600) e sobe a rede privada
  `wg0` em `10.66.0.1/24`.
- SSH só por chave, sem senha e sem login de root. Se nenhum usuário comum tiver chave autorizada, o script **para
  antes de mudar qualquer coisa** (senão você ficaria trancado fora).
- Firewall: entrada negada; abertas só `22/tcp` (SSH), `25565/tcp` (Minecraft) e `51820/udp` (WireGuard). Repasse de
  IP só entre PCs da rede privada (`wg0` ↔ `wg0`).
- Deixa instaladas, **desligadas**, as unidades `sabre-cartorio` e `sabre-proxy` (os itens seguintes as completam).

## O que NÃO faz

- Não configura Velocity, sala de espera nem cartório (itens rede-2.x e cart-2.2).
- Não cadastra amigos na rede privada (sem `[Peer]` ainda).
- **Não abre portas na conta da Oracle.** A Oracle tem uma "Security List" própria, fora da máquina: as mesmas três
  portas precisam ser abertas lá (tutorial rede-1.2). O script avisa no fim.
- Serviços que escutam na rede privada (cartório) precisarão de regra própria no firewall, no item deles.

## Teste sem máquina de verdade

`npm test` roda a simulação duas vezes e confere que a 2ª não recria nada e que as portas são exatamente essas três.
`infra/vps/teste/Dockerfile` repete isso num Ubuntu limpo (com `shellcheck`).
