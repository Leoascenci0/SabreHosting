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
- Gera o segredo do cartório **na própria máquina** em `/etc/sabre/cartorio.env` (dono root, permissão 600) e a unidade
  `sabre-cartorio` o lê dali. Rodar de novo **não troca** o segredo, e ele nunca aparece na tela. Para ler quando
  precisar (ex.: criar convites): `sudo cat /etc/sabre/cartorio.env`.
- SSH só por chave, sem senha e sem login de root. Se nenhum usuário comum tiver chave autorizada, o script **para
  antes de mudar qualquer coisa** (senão você ficaria trancado fora).
- Firewall: entrada negada; abertas só `22/tcp` (SSH), `25565/tcp` (Minecraft) e `51820/udp` (WireGuard). Repasse de
  IP só entre PCs da rede privada (`wg0` ↔ `wg0`).
- Deixa instaladas, **desligadas**, as unidades `sabre-cartorio` e `sabre-proxy` (os itens seguintes as completam).

## O que NÃO faz

- Não configura Velocity, sala de espera nem cartório (itens rede-2.x e cart-2.2). O Velocity tem script próprio,
  `instalar-velocity.sh` (rede-2.1): ver `velocity/LEIAME.md`.
- Não cadastra amigos na rede privada: isso é o `wg/adicionar-pc.sh` (abaixo).
- **Não abre portas na conta da Oracle.** A Oracle tem uma "Security List" própria, fora da máquina: as mesmas três
  portas precisam ser abertas lá (tutorial rede-1.2). O script avisa no fim.
- Serviços que escutam na rede privada (cartório) precisarão de regra própria no firewall, no item deles.

## Teste sem máquina de verdade

`npm test` roda a simulação duas vezes e confere que a 2ª não recria nada e que as portas são exatamente essas três.
`infra/vps/teste/Dockerfile` repete isso num Ubuntu limpo (com `shellcheck`).

## Cadastrar um PC na rede privada (rede-1.3)

```
sudo SABRE_ENDPOINT_HUB=<ip-ou-nome-da-nuvem>:51820 bash infra/vps/wg/adicionar-pc.sh adicionar <nome-do-pc> <chave-publica>
sudo bash infra/vps/wg/adicionar-pc.sh remover <nome-do-pc>
```

- A chave **privada** nasce no PC do amigo (`gerarChavesDoPc`, no app); aqui só entra a pública (44 caracteres).
- Cada PC ganha o próximo IP livre de `10.66.0.2` a `10.66.0.254`, sempre `/32` no hub. O IP de um PC removido
  não volta a ser usado. O registro fica em `/var/lib/sabre/pcs.tsv` (modo 600).
- A saída é o "pacote de ligação" (JSON): IP do PC, chave pública e endereço do hub, e `10.66.0.0/24` como única
  rede do lado do PC (nunca `0.0.0.0/0`). O núcleo (`packages/nucleo/src/rede/wireguard.ts`) transforma isso na
  configuração do WireGuard do PC.
- `SABRE_SIMULAR=1` só mostra o que faria. Rodar de novo com o mesmo PC e a mesma chave devolve o mesmo pacote.
- Ainda não existe a rota do cartório que valida o convite e chama este script (item de melhoria).
