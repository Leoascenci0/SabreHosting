# Tutorial — criar a máquina na nuvem (Oracle Cloud)

Este passo a passo cria a **máquina na nuvem** do SabreHosting: um computador alugado que fica ligado o tempo todo e
guarda o cartório, o proxy e a rede privada do grupo. Usamos a **Oracle Cloud, plano "Always Free"** (sempre grátis),
região **São Paulo**. Tempo: cerca de 1 hora, a maior parte esperando a conta ser aprovada.

Você não precisa saber programar. Onde aparecer um quadro de código, é só copiar e colar. Siglas e termos em inglês
estão explicados na primeira vez.

> **Regra de ouro:** nenhuma senha, chave ou segredo vai para o chat, para o GitHub ou para print de tela. Eles ficam
> no seu PC e na própria máquina (e numa cópia no seu cofre de senhas).

**Termos usados aqui**
- **VM** (*virtual machine*, máquina virtual): o computador alugado na nuvem.
- **SSH** (*Secure Shell*): jeito seguro de "entrar" na VM e digitar comandos a partir do seu PC.
- **Chave SSH**: um par de arquivos. A **pública** pode ser mostrada à Oracle; a **privada** nunca sai do seu PC.
- **Security List** (lista de segurança): o "porteiro" da Oracle, que decide quais portas ficam abertas para a
  internet, antes mesmo de chegar à VM.
- **Porta**: a "porta numerada" por onde um serviço recebe conexões (ex.: Minecraft usa a 25565).
- **Firewall** (`ufw`): o segundo porteiro, dentro da própria VM.
- **WireGuard**: a rede privada entre os PCs dos amigos e a VM.

---

## Passo 1 — Criar a conta na Oracle Cloud

1. No navegador, abra `https://www.oracle.com/br/cloud/free/` e clique em **Começar gratuitamente** (*Start for
   free*).
2. Preencha nome, e-mail e país (Brasil). Confirme o e-mail pelo link que a Oracle enviar.
3. Escolha a **região inicial** (*home region*): **Brazil East (São Paulo)**. Essa escolha **não pode ser trocada
   depois**.
4. Informe um cartão de crédito. É **só verificação de identidade**: a Oracle faz uma cobrança pequena e a devolve.
   Enquanto você usar só recursos "Always Free", nada é cobrado.
5. Aguarde o e-mail "sua conta está pronta" (de minutos a algumas horas) e entre no **Console** (o painel da Oracle).

| Se der errado | O que fazer |
|---|---|
| O cartão é recusado | Tente outro cartão de crédito (débito e pré-pago costumam ser recusados). |
| A conta fica "em análise" por mais de 1 dia | Espere; se passar de 2 dias, abra o chat de suporte da Oracle no próprio site. |
| Você já tem conta Oracle antiga | Use a mesma; confira em **Perfil › Tenancy** que a região inicial é São Paulo. |

## Passo 2 — Gerar a chave SSH no seu PC

Isto é feito **no seu PC Windows**, não na Oracle.

1. Clique no menu Iniciar, digite `Terminal` e abra o **Terminal** (ou *Windows PowerShell*). Os comandos deste passo e do passo 5 (item 1) são do **PowerShell**; os comandos depois de entrar na máquina são do Ubuntu (Linux).
2. Cole o comando abaixo e aperte Enter. As três perguntas seguintes podem ser respondidas só com Enter; se quiser,
   crie uma frase-senha (*passphrase*), que protege a chave caso alguém pegue seu PC.

```
ssh-keygen -t ed25519 -f "$HOME\.ssh\sabre_nuvem" -C "sabre-nuvem"
```

3. Foram criados dois arquivos na pasta `.ssh` do seu usuário:
   - `sabre_nuvem` — a chave **privada**. **Nunca** envie, copie para a nuvem, cole no chat ou guarde no GitHub.
   - `sabre_nuvem.pub` — a chave **pública**. Esta é a que vai para a Oracle.
4. Para ver o texto da chave pública (uma linha só, começando com `ssh-ed25519`), cole:

```
Get-Content "$HOME\.ssh\sabre_nuvem.pub"
```

Copie essa linha; você vai colar na Oracle no passo seguinte.

| Se der errado | O que fazer |
|---|---|
| `ssh-keygen` não é reconhecido | Windows: **Configurações › Aplicativos › Recursos opcionais › Adicionar › Cliente OpenSSH**. Depois feche e abra o Terminal. |
| Já existe uma chave com esse nome | O comando pergunta se quer sobrescrever. Responda **n** e use outro nome no `-f`. |

## Passo 3 — Criar a máquina (instância Ampere A1)

1. No Console da Oracle, abra o menu (☰) no canto superior esquerdo › **Compute** (computação) › **Instances**
   (instâncias) › botão **Create instance** (criar instância).
2. **Name:** `sabre-nuvem`.
3. Em **Image and shape** (imagem e formato) clique em **Edit** (editar):
   - **Image** › **Change image** › **Canonical Ubuntu** › versão **24.04** › **Select image**.
   - **Shape** › **Change shape** › aba **Ampere** (processador ARM) › marque **VM.Standard.A1.Flex** › ajuste
     **4 OCPUs** (núcleos) e **24 GB** de memória. Esse é o limite grátis; não passe disso.
4. Em **Networking** deixe **Assign a public IPv4 address** marcado (a VM precisa de endereço na internet).
5. Em **Add SSH keys** escolha **Paste public keys** e cole a linha do `sabre_nuvem.pub` (passo 2). **Não** use
   "Generate a key pair for me": a Oracle geraria a chave privada fora do seu PC.
6. Em **Boot volume** pode manter o padrão (cerca de 50 GB, dentro do plano grátis).
7. Clique **Create** (criar). Em 1 a 2 minutos o estado muda para **Running** (em execução).
8. Na página da instância, anote o **Public IP address** (endereço público, algo como `203.0.113.10`). Neste
   tutorial usamos esse valor de exemplo; o seu será outro.

| Se der errado | O que fazer |
|---|---|
| Erro **"Out of capacity for shape VM.Standard.A1.Flex"** | A Oracle está sem vaga ARM em São Paulo. É comum. Tente de novo em outro horário (madrugada e manhã cedo costumam ter vaga) e repita o passo 3 até criar. Não troque de região e não pague para "furar a fila". |
| Só aparece o formato "AMD" | Role a lista de formatos e abra a aba **Ampere**; se não houver, a conta ainda está sendo liberada: espere e volte. |
| O limite "4 OCPU / 24 GB" não é aceito | Reduza (ex.: 2 OCPU / 12 GB). Dá para começar menor; o importante é ficar dentro do grátis. |

## Passo 4 — Abrir as portas na Security List da Oracle

A Oracle bloqueia tudo por fora, mesmo que a VM aceite. Abra **só estas três**:

| Porta | Tipo | Para quê |
|---|---|---|
| `22` | TCP | SSH (você entrar na máquina) |
| `25565` | TCP | Minecraft (os amigos entrarem no jogo) |
| `51820` | UDP | WireGuard (rede privada) |

1. Na página da instância, clique no nome da **Virtual cloud network** (VCN) na seção *Primary VNIC*.
2. Abra **Subnets** › clique na subrede pública › clique em **Default Security List for ...**.
3. Aba **Security rules** › **Ingress Rules** (regras de entrada) › **Add Ingress Rules**.
4. Para cada linha da tabela acima crie uma regra: **Source CIDR** `0.0.0.0/0` (qualquer lugar), **IP Protocol**
   `TCP` ou `UDP` conforme a tabela, **Destination Port Range** o número da porta. Salve.
5. A regra da porta 22 provavelmente já existe; não duplique.

> **Não abra mais nada.** Outras portas (cartório, transferências) falam só dentro da rede privada e **não** vão para
> a internet.

| Se der errado | O que fazer |
|---|---|
| Não acha "Default Security List" | O nome varia; é a lista de segurança ligada à subrede da instância. |
| Criou regra com a porta errada | Clique nos três pontinhos da regra › **Remove** e crie de novo. |

## Passo 5 — Entrar na máquina por SSH e instalar

1. No Terminal do seu PC (troque `203.0.113.10` pelo IP público da **sua** instância; o usuário inicial do Ubuntu
   na Oracle é `ubuntu`):

```
ssh -i "$HOME\.ssh\sabre_nuvem" ubuntu@203.0.113.10
```

2. Na primeira vez o SSH pergunta se confia naquela máquina (`Are you sure you want to continue connecting`).
   Responda `yes`. Aparece o prompt `ubuntu@sabre-nuvem:~$`: agora os comandos rodam **na nuvem**.
3. Baixe o projeto (o repositório é público, não pede senha):

```
git clone https://github.com/Leoascenci0/SabreHosting.git
cd SabreHosting
```

4. **Antes de instalar, confira a chave do Node.** O instalador baixa o Node 22 do repositório oficial (NodeSource)
   e só aceita a chave se a **impressão digital** (*fingerprint*, o "RG" da chave) for igual à gravada no script.
   Veja o valor do script:

```
grep NODESOURCE_DIGITAL= infra/vps/instalar.sh
```

   O valor esperado está na linha `NODESOURCE_DIGITAL=` do `infra/vps/instalar.sh`. Agora confira de onde ele vem:
   baixe a chave pela URL oficial do NodeSource e veja a impressão digital dela:

```
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key -o /tmp/nodesource.key
gpg --show-keys --with-fingerprint /tmp/nodesource.key
```

   A impressão digital mostrada tem de ser **igual** à do script (ignorando espaços). Se forem diferentes, **pare**
   e não rode o instalador (o próprio script também recusa nesse caso).

> **ATENÇÃO:** isso só prova que a chave baixada hoje bate com o script. Se você **não** tiver uma fonte oficial
> que confirme a impressão digital do script, **peça à Máxima antes de rodar o instalador**. Não procure a impressão
> digital em sites aleatórios.

5. Se você quiser ver o que ele faria sem mudar nada, rode primeiro a simulação:

```
sudo SABRE_SIMULAR=1 bash infra/vps/instalar.sh
```

6. Instale de verdade (com `sudo`, o administrador; o script exige isso e leva alguns minutos):

```
sudo bash infra/vps/instalar.sh
```

O script instala Java 21, Node 22, WireGuard e firewall; cria o usuário `sabre`; liga a rede privada `wg0`
(`10.66.0.1`); e deixa o SSH só por chave. No fim ele avisa: *"Falta: abrir as mesmas portas na Security List"* —
que é o passo 4, já feito. Pode rodar de novo sem medo: ele não recria o que já existe.

**Ainda não ligue o proxy.** O `instalar-velocity.sh` e a unidade `sabre-velocity` ficam para o próximo item
(rede-2.1/2.2). Aqui só preparamos a máquina.

| Se der errado | O que fazer |
|---|---|
| `Permission denied (publickey)` | Você usou o arquivo errado (precisa ser o `sabre_nuvem` **sem** `.pub`) ou usuário errado (`ubuntu`). |
| `Connection timed out` | A porta 22 não está aberta na Security List (passo 4) ou a VM ainda está iniciando. Espere 2 minutos. |
| `ERRO: nenhum usuário comum tem chave SSH autorizada` | O script se recusou para não trancar você fora. Confirme que colou a chave pública no passo 3. Nada foi alterado. |
| `ERRO: a chave do repositório do Node não confere` | **Pare.** Não force. O script bloqueou de propósito (ver item 4). |
| `ERRO: este script serve para Ubuntu 22.04 ou 24.04` | A imagem escolhida não foi Ubuntu 24.04. Crie a instância de novo (passo 3). |
| Instalação aceitou mas conexão de fora não funciona | Confira o passo 4 e rode `sudo ufw status`. Se as portas estão certas nos dois lugares e ainda não conecta, avise: imagens da Oracle trazem regras próprias de `iptables` que podem precisar de ajuste (não verificado aqui). |

## Passo 6 — Onde ficam os segredos (e o que fazer com eles)

O instalador **gera** os segredos dentro da máquina; ninguém precisa digitá-los:

| Segredo | Onde fica | Quem lê |
|---|---|---|
| Chave privada do WireGuard (hub) | `/etc/wireguard/hub.key` (permissão 600) | só o administrador (`root`) |
| Segredo do Velocity (*modern forwarding*), criado no item rede-2.1 | `/var/lib/sabre/velocity/forwarding.secret` (permissão 600) | só o usuário `sabre` |

- **Não copie** esses arquivos para nenhum lugar, nem para o chat, e-mail, GitHub ou print. Nunca use `cat` neles
  com a tela sendo compartilhada.
- A chave privada do SSH (`sabre_nuvem`) fica **só no seu PC**. Faça uma cópia no seu cofre de senhas (por exemplo,
  um gerenciador de senhas com senha-mestra forte) e anote o IP público da máquina também lá.
- Se achar que um segredo vazou, avise a Máxima **sem colar o valor**: a solução é gerar um novo na
  própria máquina.

## Passo 7 — Conferir que deu certo

Ainda dentro da máquina (SSH aberto), rode:

```
sudo ufw status verbose
```

Deve aparecer **Status: active**, entrada padrão negada (`deny (incoming)`) e **só estas três** regras de entrada
liberadas: `22/tcp`, `25565/tcp` e `51820/udp`.

```
sudo wg show
```

Deve aparecer a interface `wg0` com `listening port: 51820`. Ainda não há amigos (nenhum `peer`): isso é esperado.

```
systemctl is-active wg-quick@wg0
systemctl is-enabled sabre-cartorio sabre-proxy
```

O primeiro deve responder `active`. O segundo responde `disabled` para as duas unidades: elas são instaladas
**desligadas** de propósito, até os itens seguintes.

Por fim, teste a entrada pela chave de novo, de **outro** Terminal do seu PC (sem fechar o primeiro): se conectar,
está tudo certo. Tentar senha deve ser recusado.

| Se der errado | O que fazer |
|---|---|
| `ufw status` mostra `inactive` | Rode `sudo bash infra/vps/instalar.sh` de novo e confira o texto de erro final. |
| Aparece uma porta a mais | Não apague no escuro. Anote qual e avise; pode ser regra antiga da imagem. |
| `wg show` não mostra nada | Rode `sudo systemctl status wg-quick@wg0` e leia a mensagem; ou rode o instalador de novo. |

## O que NÃO fazer

- **Não abra outras portas** (nem na Security List, nem no `ufw`). Porta nova só entra por um item no
  roadmap.
- **Não desligue o firewall** (`ufw disable`) "só para testar", nem a senha do SSH que o script já bloqueou.
- **Não cole segredo no chat**: chave privada, conteúdo de `hub.key`, `forwarding.secret`, token do cartório.
- **Não use o usuário `root`** para entrar; use `ubuntu` e `sudo`.
- **Não ligue o proxy** (`sabre-velocity`) nem o cartório antes dos itens que os completam.
- **Não exceda 4 OCPU / 24 GB / 200 GB de disco**, o limite grátis; fora dele a Oracle pode cobrar.

## Pronto?

Quando o passo 7 estiver certo, avise a Máxima ("máquina criada, ufw e wg0 conferidos") **sem enviar o IP nem
nenhuma chave**. Ela segue para o próximo item da etapa de rede.
