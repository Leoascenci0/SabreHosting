# Roadmap de melhoria — Rede

Melhorias achadas durante os itens do `docs/roadmap-rede.md` (skill `maxima` › `references/melhorias.md`).
**Sigla `redemel`.** Ramos `roadmap/redemel-<id>`. Todo item é RISCO alto (rede).

## Bloco 1 — Máquina e rede privada

- [x] **1.1 — Rede privada mais rígida** (PR #115, 31/10/2026)
  *O que fazer:* `aplicarNoWindows` aceita só o texto exato que `montarConfigDoPc` produz (lista do que é permitido, não
  do que é proibido — hoje `0.0.0.0/1, 128.0.0.0/1` passaria se alguém chamasse sem o montador); o `rm` do `finally` não
  esconde o erro original; no hub, porta 0 recusada no endpoint e `trap` para limpar os temporários do `mktemp`.
  *Arquivo:* `packages/nucleo/src/rede/wireguard.ts`, `infra/vps/wg/adicionar-pc.sh`
  **Tela no app:** não se aplica.
  *Confirmação:* testes de cada caso.
  *Origem:* rede-1.3 · PR #60 · qa

## Bloco 2 — Proxy

- [ ] **2.1 — Whitelist no proxy antes de ligar o Velocity**
  *O que fazer:* o Velocity não tem whitelist nativa; escolher plugin mantido (licença compatível) ou escrever um pequeno
  no plugin do rede-2.2, lendo a lista de jogadores do grupo (cartório). **Obrigatório antes de habilitar a unidade
  `sabre-velocity`**: o `ufw` já abre 25565 e, sem whitelist, qualquer conta Microsoft passaria pelo proxy.
  *Arquivo:* `infra/vps/velocity/`
  **Tela no app:** Configurações › Grupo › "Quem pode entrar" (tela no app-2.2).
  *Confirmação:* teste: nome fora da lista recusado no proxy.
  *Origem:* rede-2.1 · PR #48 · qa segurança

- [ ] **2.2 — Instalação do Velocity mais firme**
  *O que fazer:* instalar o jar com nome temporário + `mv` (atômico); fixar a versão e a build do Velocity (não
  `latest`); endurecer a unidade systemd (ProtectKernel*, RestrictAddressFamilies, CapabilityBoundingSet=); LEIAME avisa
  que o ufw já abre 25565.
  *Arquivo:* `infra/vps/instalar-velocity.sh`, `infra/vps/velocity/LEIAME.md`
  **Tela no app:** não se aplica.
  *Confirmação:* simulação: jar truncado nunca fica no lugar final; build fixa no script.
  *Origem:* rede-2.1 · PR #48 · qa segurança

- [ ] **2.3 — Fixar a release do PicoLimbo e endurecer a unidade**
  *O que fazer:* preencher `infra/vps/limbo/limbo-release.env` com a versão e o SHA-256 da release oficial do PicoLimbo
  (conferidos na fonte, com internet — o script hoje RECUSA instalar sem isso); conferir as chaves do `server.toml` na
  documentação; instalar o jar com nome temporário + `mv`; endurecer a unidade (CapabilityBoundingSet=,
  ProtectKernelModules, RestrictNamespaces, SystemCallFilter). **[P: precisa de internet — sessão com acesso ou o Eliel]**
  *Arquivo:* `infra/vps/limbo/`
  **Tela no app:** não se aplica.
  *Confirmação:* simulação instala com o hash fixado; hash errado recusado.
  *Origem:* rede-2.3 · PR #62 · filha + qa

- [x] **1.2 — Ajudante por socket: acabamentos** (PR #145, 31/10/2026)
  *O que fazer:* regra do ufw do cartório (7710 em wg0) só da faixa dos PCs definitivos 10.66.0.2–199 (ou documentar no
  LEIAME por que a sala já está coberta antes); o wrapper não devolve linha de eco `+ wg set …` no erro (filtrar); o cliente
  do socket no cartório limita a resposta a 4096 bytes mesmo quando o pedaço traz `\n`; testes de linha gigante e de 2º
  pedido na mesma conexão no wrapper; teste automático de concorrência (2+ pedidos em paralelo = IPs distintos);
  socket reiniciado quando a unidade muda numa reinstalação.
  *Arquivo:* `infra/vps/wg/ajudante-socket.sh`, `infra/vps/instalar.sh`, `infra/vps/LEIAME.md`,
  `services/cartorio/src/ajudante.ts`, `tests/infra/`
  **Tela no app:** não se aplica.
  *Confirmação:* testes de cada caso; `tests/infra` verde como root e como usuário comum (S-03).
  *Origem:* rede-1.5 · PR #97 · qa segurança + qa integridade

- [ ] **1.3 — Tirar o peer do WireGuard quando o PC é revogado**
  *O que fazer:* hoje `POST /pcs/:id/revogar` tira só o acesso ao cartório; o peer do PC continua na rede privada. Quando o
  PC é revogado, o cartório pede ao ajudante do WireGuard (socket) para remover o peer e liberar o IP; falha do ajudante
  não desfaz a revogação (fica registrada para nova tentativa).
  *Arquivo:* `services/cartorio/src/ajudante.ts`, `services/cartorio/src/servidor.ts`, `infra/vps/wg/`
  **Tela no app:** não se aplica.
  *Confirmação:* teste com ajudante falso: revogar chama a remoção do peer uma vez; ajudante fora do ar não reverte a revogação.
  *Depende de:* ajudante do WireGuard instalado na máquina da nuvem (ação do Eliel [P] para a instalação real).
  *Origem:* cartmel-2.2 · PR #163 · qa segurança + qa integridade
