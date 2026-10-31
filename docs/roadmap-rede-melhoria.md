# Roadmap de melhoria — Rede

Melhorias achadas durante os itens do `docs/roadmap-rede.md` (skill `maxima` › `references/melhorias.md`).
**Sigla `redemel`.** Ramos `roadmap/redemel-<id>`. Todo item é RISCO alto (rede).

## Bloco 1 — Máquina e rede privada

- [ ] **1.1 — Rede privada mais rígida**
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
