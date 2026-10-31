# Desenho — convite do grupo (um texto só)

**Aprovado pelo Eliel em 31/10/2026.** Conversa com o Eliel em 31/10/2026 (skill `brainstorming`, chamada pela `/maxima`). Destrava o **app-1.3** e o
**appmel-1.4**. Itens que saem daqui: **rede-1.4**, **cart-1.5**, **app-1.3** (reescrito).

## 1. Intenção

O amigo recebe **um texto** (no WhatsApp, por exemplo), cola no app (ou clica, quando o link for clicável) e entra no
grupo **sem editar arquivo nenhum**. Regras do Eliel: código aberto e genérico por grupo, **nenhum segredo no
repositório** e **um convite vazado não pode dar acesso permanente**.

**Metas:** entrar no grupo com um texto; no máximo **um** pedido de administrador do Windows; o endereço do Jogar
chega pelo cartório (fim do `SABRE_ENDERECO`); o token fica no cofre do sistema.
**Não-metas:** tirar amigo do grupo pela tela (fica para cartmel-1.1 + Backlog); mais de um dono; convite para vários
PCs de uma vez.
**Anti-metas (seria fracasso mesmo funcionando):** abrir porta nova na internet; token ou chave em texto aberto no PC;
convite que continua valendo depois de usado ou vencido.

## 2. O problema (ovo e galinha)

O cartório só escuta dentro da rede privada WireGuard (`10.66.0.1:7710`). O PC novo precisa entrar na rede **antes**
de falar com o cartório, e hoje a entrada na rede é manual (`infra/vps/wg/adicionar-pc.sh`, rodado pelo dono na nuvem
com a chave pública do PC).

## 3. Caminhos considerados

| Caminho | Troca | Escolha |
|---|---|---|
| **A. Chave provisória no convite** | o convite leva uma chave WireGuard provisória (de uso único, com prazo); no 1º uso o PC cria a própria chave e o cartório troca a provisória por ela | **Escolhido pelo Eliel**: nenhuma porta nova; vazou depois de usado, não vale nada |
| B. Porta de recepção pública | a chave secreta nunca viaja, mas abre a 4ª porta na internet e precisa de certificado próprio | descartado: mais superfície de ataque |
| C. Manual como hoje | simples e seguro, mas o amigo depende do dono e não é "um texto só" | descartado |

## 4. Decisões do Eliel

1. **Entrada na rede:** chave provisória no convite, trocada no 1º uso (caminho A).
2. **Quem convida:** só o **dono do grupo**, pelo app (Configurações › Grupo › "Criar convite"). O primeiro convite
   (o do dono) sai **uma vez** por comando na máquina da nuvem.
3. **Sem cofre do sistema (`safeStorage`):** o app **recusa** guardar o token e explica; nunca grava em texto aberto.

## 5. Como funciona

### 5.1 Criar o convite (PC do dono)
1. O app do dono chama `POST /convites` com o token dele (o cartório confere que o PC é **dono**; quem não é recebe 403).
   O corpo leva o nome do PC convidado.
2. O cartório gera o código do convite (32 bytes, já existe), um **par de chaves provisório** e reserva um IP na
   **sala de entrada** (`10.66.0.200`–`10.66.0.254`). Pede ao **ajudante do WireGuard** (5.4) para cadastrar o peer
   provisório. Guarda só o **hash** do código; a chave privada provisória **não fica no banco** (só no texto devolvido).
3. Devolve o **texto do convite** (5.3). O app mostra o texto com botão "Copiar" e o prazo ("vale até amanhã, 22:40").

### 5.2 Usar o convite (PC do amigo)
1. O amigo cola o texto (ou o app abre pelo link `sabre://`). O app confere o formato e o prazo **antes** de qualquer
   coisa e mostra "Entrar no grupo <nome>?".
2. O app gera a **chave própria** do PC (`gerarChavesDoPc`, já existe).
3. **Um** pedido de administrador: o passo elevado instala o túnel com a chave provisória, chama
   `POST /convites/usar {convite, chave_publica}` no cartório, recebe `{token, pacote}` (pacote de ligação definitivo:
   IP fixo em `10.66.0.2`–`10.66.0.199` + dados do hub) e regrava o túnel com a chave própria. A chave privada própria
   nunca sai do PC.
4. No cartório, `POST /convites/usar` (uso único, já existe) passa a: trocar o peer provisório pelo definitivo (via
   ajudante), registrar o PC e devolver token + pacote. Convite inválido, usado ou vencido → 401 com a mensagem atual.
5. O app guarda o token no **cofre** (`safeStorage`); sem cofre, para aqui e explica (decisão 3). Depois chama
   `GET /grupo` → `{nome, endereco_jogar}` (fecha o appmel-1.4).
6. Seguem os outros dois passos do assistente: **EULA** (núcleo já pronto: `perguntaEula`, `gerarEula`, `podeSubir`) e
   **pasta**.

### 5.3 O texto do convite
- Forma: `sabre://convite/1.<base64url de um JSON>` — o mesmo texto serve para **colar** e para **link**. O `1` é a
  versão do formato.
- JSON: `g` nome do grupo, `h` endereço do hub (`host:porta`), `k` chave pública do hub, `i` IP provisório, `p` chave
  privada provisória, `c` código do convite, `a` porta do cartório (padrão 7710), `e` vence em (epoch, segundos).
- Tamanho ~350 caracteres (cabe numa mensagem). Nada do grupo vai para o repositório: o texto nasce no cartório de
  cada grupo.
- Limite dito: o WhatsApp nem sempre deixa `sabre://` clicável; **colar** é o caminho garantido, o link é bônus.

### 5.4 Ajudante do WireGuard na nuvem (rede-1.4)
- O cartório roda como usuário `sabre`, sem privilégio. Mexer no WireGuard pede root, então entra um **ajudante**
  pequeno, liberado no `sudoers` **só** para os comandos `entrada-adicionar <ip> <chave>`, `entrada-trocar
  <ip-prov> <nome> <chave>` e `entrada-remover <ip>`, com a mesma validação do `adicionar-pc.sh` (reaproveitar).
- **Sala de entrada no firewall:** IPs `10.66.0.200`–`254` só alcançam `10.66.0.1:7710` (cartório); nada de repasse
  para outros PCs nem para o servidor de jogo.
- Faixa dos PCs definitivos passa a `10.66.0.2`–`10.66.0.199` (o `adicionar-pc.sh` muda o `ULTIMO`).

### 5.5 Prazo e limpeza
- Convite não usado vence em **24 h** (padrão; dono ajusta em Configurações › Grupo › "Validade do convite").
- A limpeza que já apaga convites vencidos (`apagarConvitesVencidos`) também **remove o peer provisório** na hora em que
  o convite vence (não espera 7 dias): convite vencido = túnel provisório morto.
- O limite de tentativas por IP do cartório (cartmel-1.2) vale para a sala de entrada.

### 5.6 O primeiro dono
- O script de instalação do cartório (cart-2.2) ganha o comando `criar-convite-dono`, rodado **uma vez** como root
  na nuvem: imprime o texto do convite com a marca "dono". Recusa se já houver dono.

## 6. Escolhas da Máxima (reversíveis, "decidi por você")
- **Pasta:** uma pasta-base só (`%LOCALAPPDATA%\SabreHosting` por padrão, o amigo pode trocar), com `servidor\` e
  `mundos\` dentro. Tela: Configurações › Geral › "Pasta do SabreHosting".
- **Arquivos da tela:** seguem a estrutura real do app: `apps/desktop/src/ui/boas-vindas.*` e
  `apps/desktop/src/main/boas-vindas.ts` (o roadmap dizia `src/telas/`, que não existe).
- **Validade padrão de 24 h** e faixa `200–254` para a sala de entrada.
- **Dono = coluna no registro do PC** no cartório (um dono só).

## 7. Segurança (resumo)
- Convite vazado **antes** do uso: dá uma entrada única e só até o prazo; o dono vê quem entrou (nome do PC).
- Convite vazado **depois** do uso ou vencido: não vale nada (código usado; peer provisório removido).
- Chave privada definitiva nasce e fica no PC; token só no cofre do sistema; nada disso em log (redact já existe).
- Nenhuma porta nova: continuam SSH, Minecraft e WireGuard.

### 5.7 Respostas da revisão de quem constrói (escolhas da Máxima, reversíveis)
- **Banco:** a linha do convite guarda também o **IP provisório** e a **chave pública** provisória (pública, pode
  ficar) e o prazo; a privada provisória nunca. A tabela de PCs ganha a coluna `dono`.
- **Amarração pela rede:** `POST /convites/usar` só vale se o pedido chega **do IP provisório reservado** para aquele
  convite. Da sala de entrada, o cartório só atende `POST /convites/usar` (e a confirmação abaixo); o resto pede token.
- **Sem PC encalhado (duas fases):** `usar` **adiciona** o peer definitivo antes de mexer no provisório e devolve
  token + pacote. O provisório só sai quando o PC confirma **do IP definitivo** (`POST /convites/confirmar` com o
  token) ou quando o prazo vence. Se a resposta se perder, o PC repete `usar` com a **mesma** chave pública ainda
  pelo provisório: o cartório devolve o mesmo IP e um token novo (o anterior deixa de valer). Chave pública diferente
  num convite já usado → 401.
- **`/convites`:** o segredo de administrador sai dessa rota (passa a ser token de PC dono; outro PC → 403) e fica
  só no `criar-convite-dono`. Validade: padrão 24 h, máximo 72 h. O esquema do corpo de `usar` aceita `chave_publica`.
- **Nome do PC:** o app do dono transforma o nome digitado no formato da rede (minúsculas, números e hífen, até 32) e
  mostra como ficou; nome já usado por PC ativo ou convite pendente → recusa com mensagem.
- **Registro da nuvem:** peers provisórios entram no `pcs.tsv` com estado `entrada`; a conferência de `AllowedIPs`
  do `adicionar-pc.sh` passa a aceitar as duas faixas, cada uma no seu estado.
- **Dono perdeu o PC:** comando `trocar-dono` na nuvem (root), que passa a marca para outro PC ativo ou gera novo
  convite de dono; sem tela para isso (não-meta).
- **Queda curta do túnel** ao regravar com a chave própria é aceita (acontece só na entrada, sem jogo rodando).

## 8. Fica para quem constrói
- Mecanismo exato do passo elevado no Windows (um processo elevado que faz instalar → usar → regravar), desde que seja
  **um** pedido de administrador.
- Nome exato das rotas e campos internos, desde que o texto do convite siga 5.3.
- Como o app registra o `sabre://` no Windows (`setAsDefaultProtocolClient`) e trata o link com o app já aberto.
