# MILESTONE — o plano geral

A Máxima só executa o que está aqui. Alimentado por todos os `docs/roadmap-*.md` e pelo Backlog. Uma onda = até 3
itens compatíveis (skill `maxima` §3), cada item num chat/sessão própria. Atualizado em 30/10/2026.

## Marcos (o que o grupo ganha em cada um)

| Marco | O que dá para fazer no fim | Roadmaps |
|---|---|---|
| **M1 — Fundação** | repositório pronto; servidor sobe num PC por linha de comando; backups locais seguros | base, host, bkp |
| **M2 — Primeira partida (v0.1)** | amigos entram pelo endereço fixo da nuvem; host escolhido à mão; mundo guardado na nuvem | rede, cart, app (bloco 1) |
| **M3 — Mundo em todos** | mundo chega sozinho a todos os PCs; quem voltou atualiza; instalador; botão Jogar abre o Prism já conectado | sync, app (blocos 2 e 3.1), lanc (bloco 1) |
| **M4 — Troca sem queda** | servidor muda sozinho para o PC mais forte; host que cai é substituído | migra |
| **M5 — Adeus hospedagem** | histórico no Drive, atualização automática, piloto e cancelamento da hospedagem | drive, app 3.2, piloto |
| **M6 — Launcher próprio** | o SabreHosting abre o jogo sozinho, sem o Prism (depende da aprovação da Microsoft) | lanc (bloco 2) |

## Em curso

Leva 31/10: app-1.1 ✅ (#70) · cartmel-1.2/1.3 🔄 (#69) · rede-2.2 ⏸️ [P: liberar repo.papermc.io na rede do ambiente]

## Fila

**M1 — Fundação** — tudo feito, falta só:
- host-3.1 [P: teste no PC — precisa da versão do Minecraft escolhida pelo Eliel]

**M2 — Primeira partida**
- **Próxima onda (Eliel pediu app-1.1 primeiro, para ter prévia):** app-1.1 · rede-2.2 (plugin do proxy: trocar o host da vez + whitelist = redemel-2.1) ·
  cartmel-1.2/1.3 (endurecer a entrada do cartório; banco fora do diretório atual)
- Depois: app-1.2 · app-1.3 · redemel-2.3 [P: internet para fixar o hash do PicoLimbo] · cart-2.2 [P: máquina real]
- Fechamento M2: versão de teste v0.1 + tutorial para o grupo.

**M3 — Mundo em todos** (ondas montadas pela Máxima ao chegar aqui): sync-1.1 → sync-1.2 → sync-2.1 → sync-2.2;
app-2.1, app-2.2, app-3.1 [P]; lanc-1.1 → lanc-1.2 [P] → lanc-1.3 [P] → lanc-1.4 (se D5 tiver mods).
  **lanc-2.1 [P]** (pedido à Microsoft) entra cedo, no começo do M3, porque a resposta pode demorar.

**M4 — Troca sem queda:** migra-1.1 → migra-2.1 → migra-2.2 (SOZINHO) → migra-2.3 → migra-3.1 [P].

**M5 — Adeus hospedagem:** drive-1.1 → drive-1.2 [P]; app-3.2 [P, D9]; piloto-1.1 → 1.2 → 1.3 [P].

**M6 — Launcher próprio** (só com a aprovação da Microsoft): lanc-2.2 [P] · lanc-2.3 → lanc-2.4 [P].

## Pendente do Eliel

Cada uma vira um balão (uma por vez) quando a fila chegar nela. Recomendação primeiro.

- **Versão do Minecraft** (e do NeoForge): escolha do Eliel antes do host-3.1 (teste no PC).
- **D9 — Assinatura do instalador:** sem assinatura (o Windows mostra aviso "editor desconhecido") · certificado de
  assinatura (pago, ~US$ 100+/ano). *Trava:* app-3.2.

## Backlog

- Melhorias do app: `docs/roadmap-app-melhoria.md` (appmel-1.1, 1.2).
- Melhorias do launcher: `docs/roadmap-lanc-melhoria.md` (lancmel-1.1).
- Melhorias da rede: `docs/roadmap-rede-melhoria.md` (redemel-1.1; 2.1 obrigatório antes de ligar o proxy; 2.2; 2.3 [P]).
- Melhorias do backup: `docs/roadmap-bkp-melhoria.md` (bkpmel-1.1 feito; 1.2, 1.3, 2.1).
- Melhorias do cartório: `docs/roadmap-cart-melhoria.md` (cartmel-1.1 a 1.4 e 1.6; 1.5 feito).
- Melhorias do host: `docs/roadmap-host-melhoria.md` (hostmel-1.1 a 1.4, 2.1 [P], 2.2 a 2.4).
- Melhorias da base: `docs/roadmap-base-melhoria.md` (basemel-1.1, 1.2 e 1.5, CI).

- Bedrock via Geyser (se D1 = Java + Bedrock depois).
- App para Linux e macOS (o núcleo já é multiplataforma).
- Painel web simples na nuvem com o status do servidor.

## Feito

- 31/10/2026 — app-1.1 janela, bandeja e design system (#70).

- 30/10/2026 — Decididas D6 (regras padrão), D2 (WireGuard), D3 (Oracle Always Free SP), D4 (ícone do Eliel).

- 31/10/2026 — Ondas 7–11: cart-2.1 cliente e trava (#41), basemel-1.3 testes estáveis (#43), rede-1.1 script da nuvem
  (#42), bkp-1.3 backup agendado (#45), rede-2.1 Velocity (#48), bkp-2.1 rotação (#50), rede-1.2 tutorial (#51),
  migra-1.1 quem hospeda (#54), lanc-1.2 instância Prism (#57), cart-1.4 cópia na nuvem (#58), rede-1.3 WireGuard (#60),
  rede-2.3 limbo (#62), bkp-2.2 restaurar (#64), basemel-1.4 verificador (#65).
- 30/10/2026 — Onda 6: cart-1.3 versões do mundo (PR #32), lanc-1.1 achar o Prism (PR #36), bkp-1.2 pacote
  fechado (PR #38).
- 30/10/2026 — Onda 5: host-2.1 subir/parar (PR #24), bkpmel-1.1 caminhos Windows (PR #29), cartmel-1.5 época
  blindada (PR #27); host-2.2 comandos pelo console (PR #30).
- 30/10/2026 — Onda 4: host-1.2 EULA e configuração (PR #20), bkp-1.1 manifesto (PR #21), cart-1.2 trava de host
  (PR #22).
- 30/10/2026 — Onda 3: host-1.1 download com hash (PR #12), cart-1.1 cartório com token (PR #15), host-2.3 nota do PC
  (PR #16).
- 30/10/2026 — Onda 2: base-1.2 CI (PR #7), base-1.3 mundos de teste (PR #9), base-2.1 modelos de issue (PR #8).
- 30/10/2026 — Onda 1: base-1.1 monorepo TypeScript (PR #3).

- 30/10/2026 — Decididas D8 (Electron + TypeScript), D1 (Java) e D5 (mods Fabric e Forge juntos: NeoForge + Sinytra
  Connector). Ver `docs/ops/DECISOES.md`.

- 30/10/2026 — Projeto criado: CLAUDE.md e skills adaptados do SEURBH, Máxima, qualidade-sabre, arquitetura,
  10 roadmaps, licença MIT.
