# Roadmap — Rede (máquina na nuvem, rede privada e proxy)

Objetivo: os amigos entram sempre pelo mesmo endereço (o proxy na nuvem), os PCs se falam por uma rede privada sem
abrir porta em casa, e o proxy encontra o host da vez.

**Sigla `rede`.** Ramos `roadmap/rede-<id>`. Código em `infra/vps/`. **Nenhuma filha acessa a máquina de verdade:**
os itens entregam scripts testados num contêiner local e um tutorial; quem executa na nuvem é o Eliel (itens **P**).
Leitura obrigatória: `qualidade-sabre › references/seguranca.md` §1.

## Bloco 1 — Máquina e rede privada

- [x] **1.1 — Script de instalação da máquina na nuvem** (PR #42, 30/10/2026; conferir a impressão digital da chave NodeSource antes de rodar)
  *O que fazer:* script idempotente (Ubuntu) que instala Java, Node, WireGuard, firewall (só portas do Minecraft e do
  WireGuard abertas), usuário sem privilégio, serviços systemd. Testado num contêiner Docker na nuvem do Claude.
  *Arquivo:* `infra/vps/instalar.sh`, `infra/vps/teste/Dockerfile`
  **Tela no app:** não se aplica.
  *Confirmação:* rodar duas vezes no contêiner sem erro; `ufw status` com as 2 portas.
  *Depende de:* — · D2 (WireGuard) e D3 (Oracle Always Free SP) decididas

- [x] **1.2 — Tutorial: criar a máquina na nuvem** (PR #51, 30/10/2026; a execução é do Eliel)
  *O que fazer:* passo a passo com prints descritos para o Eliel criar a VM (D3), apontar o script e guardar os segredos
  no cofre dele (não no chat).
  *Arquivo:* `docs/tutoriais/rede-criar-maquina.md`
  **Tela no app:** não se aplica.
  *Confirmação:* o Eliel conclui e a VM responde. **[P: criar conta/VM]**
  *Depende de:* rede-1.1

- [x] **1.3 — Rede privada: hub e convite de PC** (PR #60, 31/10/2026; prova real no PC pendente [P])
  *O que fazer:* no hub, gerar a configuração WireGuard de um PC novo a partir de um convite; no núcleo, módulo que
  aplica a configuração no Windows (pede permissão de administrador uma vez) e testa a ligação.
  *Arquivo:* `infra/vps/wg/`, `packages/nucleo/src/rede/wireguard.ts`
  **Tela no app:** Configurações › Grupo › "Entrar com convite".
  *Confirmação:* teste em contêineres: dois "PCs" falam entre si só pela rede privada. **[P: prova real no PC]**
  *Depende de:* rede-1.1

## Bloco 2 — Proxy

- [x] **2.1 — Velocity com whitelist e modern forwarding** (PR #48, 30/10/2026; whitelist pendente em redemel-2.1, unidade desligada)
  *O que fazer:* configuração do Velocity (porta pública), segredo de forwarding gerado na instalação, servidor de
  destino dinâmico.
  *Arquivo:* `infra/vps/velocity/`
  **Tela no app:** não se aplica.
  *Confirmação:* contêiner com Velocity + servidor falso: conexão encaminhada.
  *Depende de:* rede-1.1

- [ ] **2.2 — Plugin do proxy: trocar o host da vez**
  *O que fazer:* plugin Velocity pequeno (Java) que expõe, só na rede privada e autenticado, "o host agora é X" e "mande
  todos para a sala de espera / de volta".
  *Arquivo:* `infra/vps/velocity-plugin/`
  **Tela no app:** não se aplica.
  *Confirmação:* teste de integração em contêiner: troca de destino sem derrubar a conexão do cliente de teste.
  *Depende de:* rede-2.1

- [x] **2.3 — Sala de espera (limbo)** (PR #62, 31/10/2026; hash da release do PicoLimbo a fixar — redemel-2.3 [P])
  *O que fazer:* instalar e configurar o limbo leve como servidor de espera do Velocity, com mensagem em pt-BR.
  *Arquivo:* `infra/vps/limbo/`
  **Tela no app:** não se aplica.
  *Confirmação:* contêiner: cliente de teste vai para o limbo e volta.
  *Depende de:* rede-2.1
