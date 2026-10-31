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
- Cria o usuário `sabre` (sem shell e sem `sudo`) e as pastas `/opt/sabre` e `/var/lib/sabre`.
- Gera a chave do hub WireGuard **na própria máquina** (`/etc/wireguard/hub.key`, permissão 600) e sobe a rede privada
  `wg0` em `10.66.0.1/24`.
- Gera o segredo do cartório **na própria máquina** em `/etc/sabre/cartorio.env` (dono root, permissão 600) e a unidade
  `sabre-cartorio` o lê dali. Rodar de novo **não troca** o segredo, e ele nunca aparece na tela. Para ler quando
  precisar (ex.: criar convites): `sudo cat /etc/sabre/cartorio.env`.
- SSH só por chave, sem senha e sem login de root. Se nenhum usuário comum tiver chave autorizada, o script **para
  antes de mudar qualquer coisa** (senão você ficaria trancado fora).
- Firewall: entrada negada; abertas na internet só `22/tcp` (SSH), `25565/tcp` (Minecraft) e `51820/udp` (WireGuard);
  o cartório (`7710/tcp`) só pela rede privada, no IP do hub e de origem `10.66.0.x`
  (`ufw allow in on wg0 from 10.66.0.0/24 to 10.66.0.1 port 7710 proto tcp`). Uma regra só basta para os PCs
  definitivos (`.2`–`.199`): a sala de entrada (`.200`–`.254`) já é decidida antes, nas `before.rules` (abaixo), que o
  ufw confere antes das regras comuns; por isso não são precisas várias regras para a faixa `.2`–`.199`. Repasse de
  IP só entre PCs da rede privada (`wg0` ↔ `wg0`), **fora a sala de entrada** (abaixo).
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
- Cada PC ganha o próximo IP livre de `10.66.0.2` a `10.66.0.199`, sempre `/32` no hub (de `.200` a `.254` é a sala
  de entrada). O IP de um PC removido não volta a ser usado. O registro fica em `/var/lib/sabre-wg/pcs.tsv` (pasta só
  do root, modo 600; o `instalar.sh` muda de lugar o `/var/lib/sabre/pcs.tsv` antigo, se houver).
- A saída é o "pacote de ligação" (JSON): IP do PC, chave pública e endereço do hub, e `10.66.0.0/24` como única
  rede do lado do PC (nunca `0.0.0.0/0`). O núcleo (`packages/nucleo/src/rede/wireguard.ts`) transforma isso na
  configuração do WireGuard do PC.
- `SABRE_SIMULAR=1` só mostra o que faria. Rodar de novo com o mesmo PC e a mesma chave devolve o mesmo pacote.
- O convite do grupo não usa este script: usa o ajudante da sala de entrada (abaixo).

## Sala de entrada e ajudante do convite (rede-1.4, serviço próprio desde o rede-1.5)

O cartório roda como `sabre`, blindado (`NoNewPrivileges`, `ProtectSystem=strict`) e **sem `sudo`**. Para pôr na rede
privada o PC de quem recebeu um convite, ele pede ao **ajudante**, um serviço próprio do systemd que roda como root:

- `sabre-ajudante-entrada.socket` escuta em `/run/sabre/ajudante.sock` (dono `root`, grupo `sabre`, `0660`): só o
  root e o cartório conectam. Uma conexão = um pedido = uma execução de `sabre-ajudante-entrada@.service`. Numa
  reinstalação, se a unidade `.socket` mudou, o instalador a reinicia (`systemctl restart`); a resposta tem teto de
  4096 bytes no cartório.
- O serviço roda `/opt/sabre/wg/ajudante-socket.sh`, que lê **uma linha** em até 10 s, confere só o formato e chama o
  `ajudante-entrada.sh` com ambiente limpo (`env -i`). Blindagem: só escreve em `/etc/wireguard` e
  `/var/lib/sabre-wg`, só tem a capacidade de mexer na rede (`CAP_NET_ADMIN`), `NoNewPrivileges`, até 10 s por pedido.

```
pedido:   {"comando":"entrada-adicionar","args":["<chave-pub-provisória>"]}
          {"comando":"entrada-trocar","args":["<ip-prov>","<nome-do-pc>","<chave-pub-definitiva>"]}
          {"comando":"entrada-remover","args":["<ip-prov>"]}
resposta: {"ip":"10.66.0.2xx"} · pacote do PC (ip_pc, chave_publica_hub, endpoint, allowed_ips) · {"ok":true} (remover)
erro:     {"codigo":1,"erro":"ERRO: …"} = o ajudante recusou (nada mudou); só a linha "ERRO: …" volta; sem
          ela, "ERRO: falha interna do ajudante" (o resto do stderr, ex.: eco "+ wg set …", nunca sai)
          {"codigo":2,"erro":"pedido recusado"} = JSON torto, comando fora da lista ou argumento fora de
          [A-Za-z0-9+/=.:-] (o ajudante nem foi chamado)
```

Para testar à mão na nuvem: `printf '%s\n' '<pedido>' | sudo socat - UNIX-CONNECT:/run/sabre/ajudante.sock` (se tiver
o `socat`). O `sudoers` do convite do rede-1.4 saiu: o instalador apaga `/etc/sudoers.d/sabre-entrada`.

- **Sala de entrada** = `10.66.0.200` a `.254` (estado `entrada` no `pcs.tsv`). Mesma chave = mesmo IP; sala cheia =
  erro. O IP volta a ficar livre quando o provisório sai.
- `entrada-trocar` exige o provisório em estado `entrada`, recusa a chave provisória como definitiva e **só
  acrescenta** o PC definitivo (`10.66.0.2`–`199`, mesma saída do `adicionar-pc.sh`; repetir devolve o mesmo IP). O
  provisório sai pelo `entrada-remover`, chamado pelo cartório na confirmação ou no vencimento do convite.
- `entrada-remover` só aceita IP da sala em estado `entrada`; sem peer, não faz nada (código 0).
- Códigos: 0 ok; 1 erro de validação (`ERRO:`, nada alterado); 2 comando fora da lista ou uso errado. Argumento
  torto é recusado antes de abrir qualquer arquivo. Pelo serviço (e pelo `sudo`, à mão), as variáveis de simulação
  são ignoradas.
- O endereço do hub fica **só** em `/etc/sabre/hub.env` (o ajudante põe no pacote do PC e o cartório põe no convite;
  `SABRE_HUB_ENDPOINT` só vale onde o arquivo não existe, como nos testes): rode o instalador uma vez com
  `sudo SABRE_ENDPOINT_HUB=<ip-ou-nome-da-nuvem>:51820 bash infra/vps/instalar.sh`.
- **Firewall da sala:** nas `before.rules` do ufw (valem antes das regras comuns), a faixa `.200`–`.254` só alcança
  `10.66.0.1:7710/tcp` (cartório); qualquer outro destino no hub e qualquer repasse de ou para outro PC é descartado.
  Nenhuma porta nova na internet.
- O ajudante, a porta do socket (`wg/ajudante-socket.sh`) e a fonte comum (`wg/comum.sh`, também usada pelo `adicionar-pc.sh`) são copiados para `/opt/sabre/wg`
  (dono root).
