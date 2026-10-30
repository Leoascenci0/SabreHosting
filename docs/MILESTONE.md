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

- **Onda 3:** host-1.1 · cart-1.1 · host-2.3

## Fila

**M1 — Fundação**
- **Onda 4:** host-1.2 · bkp-1.1 · cart-1.2
- **Onda 5:** host-2.1 · bkp-1.2 · cart-1.3
- **Onda 6:** host-2.2 · bkp-2.1 (espera D6) · rede-1.1 (espera D2, D3)
- **Onda 7:** bkp-1.3 · cart-2.1 · rede-2.1
- **Onda 8:** bkp-2.2 · cart-1.4 · host-3.1 [P: teste no PC]

**M2 — Primeira partida**
- **Onda 9:** rede-1.3 · rede-2.2 · app-1.1 (espera D4)
- **Onda 10:** rede-2.3 · app-1.2 · rede-1.2 [P: criar a VM]
- **Onda 11:** app-1.3 · cart-2.2 [P: máquina real]
- Fechamento M2: versão de teste v0.1 + tutorial para o grupo.

**M3 — Mundo em todos** (ondas montadas pela Máxima ao chegar aqui): sync-1.1 → sync-1.2 → sync-2.1 → sync-2.2;
app-2.1, app-2.2, app-3.1 [P]; lanc-1.1 → lanc-1.2 [P] → lanc-1.3 [P] → lanc-1.4 (se D5 tiver mods).
  **lanc-2.1 [P]** (pedido à Microsoft) entra cedo, no começo do M3, porque a resposta pode demorar.

**M4 — Troca sem queda:** migra-1.1 → migra-2.1 → migra-2.2 (SOZINHO) → migra-2.3 → migra-3.1 [P].

**M5 — Adeus hospedagem:** drive-1.1 → drive-1.2 [P]; app-3.2 [P, D9]; piloto-1.1 → 1.2 → 1.3 [P].

**M6 — Launcher próprio** (só com a aprovação da Microsoft): lanc-2.2 [P] · lanc-2.3 → lanc-2.4 [P].

## Pendente do Eliel

Cada uma vira um balão (uma por vez) quando a fila chegar nela. Recomendação primeiro.

- **D2 — Rede privada:** WireGuard próprio na máquina da nuvem (recomendado: grátis, sem limite de pessoas, nada de
  terceiros) · Tailscale (mais fácil, mas o plano grátis limita usuários) · playit.gg (túnel pronto, menos controle).
  *Trava:* rede-1.1.
- **D3 — Máquina na nuvem:** Oracle Cloud Always Free em São Paulo (recomendado: grátis; às vezes demora para liberar
  vaga) · VPS paga barata no Brasil (~R$ 20–40/mês, garantida). Envolve cadastro: só o Eliel faz. *Trava:* rede-1.1.
- **D4 — Ícone do app:** o nome já foi decidido (SabreHosting); falta o ícone. *Trava:* app-1.1.
- **D6 — Regras do grupo:** quantos backups guardar (padrão 10 + 7 diários), folga para trocar de host (padrão 30%),
  quem pode hospedar (padrão: todos que ligarem a opção). *Trava:* bkp-2.1, migra-1.1.
- **D9 — Assinatura do instalador:** sem assinatura (o Windows mostra aviso "editor desconhecido") · certificado de
  assinatura (pago, ~US$ 100+/ano). *Trava:* app-3.2.

## Backlog

- Melhorias da base: `docs/roadmap-base-melhoria.md` (basemel-1.1 e 1.2, CI).

- Bedrock via Geyser (se D1 = Java + Bedrock depois).
- App para Linux e macOS (o núcleo já é multiplataforma).
- Painel web simples na nuvem com o status do servidor.

## Feito

- 30/10/2026 — Onda 1: base-1.1 monorepo TypeScript (PR #3).
- 30/10/2026 — Onda 2: base-1.2 CI (PR #7), base-1.3 mundos de teste (PR #9), base-2.1 modelos de issue (PR #8).

- 30/10/2026 — Decididas D8 (Electron + TypeScript), D1 (Java) e D5 (mods Fabric e Forge juntos: NeoForge + Sinytra
  Connector). Ver `docs/ops/DECISOES.md`.

- 30/10/2026 — Projeto criado: CLAUDE.md e skills adaptados do SEURBH, Máxima, qualidade-sabre, arquitetura,
  10 roadmaps, licença MIT.
