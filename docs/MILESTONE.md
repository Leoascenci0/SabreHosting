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

**Próxima onda: 21** (numeração única; as rodadas sem número depois da Onda 11 ficam como 12–19 no histórico).

Onda 20 (31/10) — cartmel-1.1 · app-2.1 · sync-1.1 · app-2.2 · sync-1.2 — sessão https://claude.ai/code/session_012qrjntSMKMZcY3GUuomfqa

⏸️ rede-2.2 [P: liberar `repo.papermc.io` na rede do ambiente]

## Fila

**M1 — Fundação** — tudo feito, falta só:
- host-3.1 [P: teste no PC — precisa da versão do Minecraft escolhida pelo Eliel]

**M2 — Primeira partida**
- rede-2.2 (plugin do proxy: trocar o host da vez + whitelist = redemel-2.1) [P: liberar repo.papermc.io]
- **Convite:** rede-1.4 ✅ (#85) · cart-1.5 ✅ (#84) · rede-1.5 ✅ (#97) → **app-1.3** (com appmel-1.4) [P: prova real no PC]
- Depois: redemel-2.3 [P: internet para fixar o hash do PicoLimbo] · redemel-2.2 [P: internet para fixar a versão do Velocity] · cart-2.2 [P: máquina real; levar o achado do SABRE_CARTORIO_SEGREDO_ADMIN que ninguém lê]
- Fechamento M2: versão de teste v0.1 + tutorial para o grupo.

**M3 — Mundo em todos** (ondas montadas pela Máxima ao chegar aqui): sync-1.1 → sync-1.2 → sync-2.1 → sync-2.2;
app-2.1, app-2.2, app-3.1 [P]; lanc-1.1 → lanc-1.2 [P] → lanc-1.3 [P] → lanc-1.4 (se D5 tiver mods).
  **lanc-2.1 [P]** (pedido à Microsoft) entra cedo, no começo do M3, porque a resposta pode demorar.

**M4 — Troca sem queda:** migra-1.1 → migra-2.1 → migra-2.2 (SOZINHO) → migra-2.3 → migra-3.1 [P].

**M5 — Adeus hospedagem:** drive-1.1 → drive-1.2 [P]; app-3.2 [P, D9]; piloto-1.1 → 1.2 → 1.3 [P].

**M6 — Launcher próprio** (só com a aprovação da Microsoft): lanc-2.2 [P] · lanc-2.3 → lanc-2.4 [P].

## Pendente do Eliel

Cada uma vira um balão (uma por vez) quando a fila chegar nela. Recomendação primeiro.

- **Liberar `repo.papermc.io`** na rede do ambiente da nuvem (Allowed domains). *Trava:* rede-2.2.
- **Versão do Minecraft** (e do NeoForge): escolha do Eliel antes do host-3.1 (teste no PC).
- **Dependabot #95 e #96** (actions do CI 4→7): PR de autor externo, merge é do Eliel.
- **Provas no PC Windows:** appmel-1.5, hostmel-2.5, appmel-1.1 (passo a passo nos PRs #101, #114, #144).
- **D9 — Assinatura do instalador:** sem assinatura (o Windows mostra aviso "editor desconhecido") · certificado de
  assinatura (pago, ~US$ 100+/ano). *Trava:* app-3.2.

## Backlog

- Melhorias: quase tudo feito na madrugada de 31/10. Abertos: appmel-1.4 (vai com o app-1.3); lancmel-1.1 parte
  "marcador da instância" (vai com o lanc-1.3); redemel-2.1 (com o rede-2.2), 2.2 e 2.3 [P: internet]; cartmel-1.1 (destravado: só o dono, pelo app — próximo da fila);
  hostmel-2.1 [P: PCs reais].
- Achados menores para um próximo item: vigia dentro do `app.asar` (asarUnpack no app-3.1); teste do PUT com corpo > 1 MB;
  `::1` no download local; vistoria local também como usuário comum (S-03).

- Bedrock via Geyser (se D1 = Java + Bedrock depois).
- App para Linux e macOS (o núcleo já é multiplataforma).
- Painel web simples na nuvem com o status do servidor.

## Feito

- 31/10/2026 (madrugada) — 33 PRs: convite completo (rede-1.4 #85, cart-1.5 #84, rede-1.5 #97); correção do CI da main
  (corr-1.1 #118); host: 2.3 #89, 2.4 #99, 1.1 #102, 1.2 #106, 1.3 #109, 2.5 vigia #114, 1.4 #122, 2.2 #139; backup:
  bkpmel-2.1 #86, 1.2 #90, 1.3 #105; app: appmel-1.5 #101, 1.3 #126, 1.2 #131, 1.6 #137, 1.1 #144; cartório: cartmel-2.1
  #123, 1.6 #127, 1.4 #133, 1.8 #135, 1.9 #143; rede: redemel-1.1 #115, 1.2 #145; base: basemel-1.1 #93, 1.2 #111, 1.6
  #128/#138; launcher: lancmel-1.1 (a+b) #117.

- 31/10/2026 — app-1.1 janela, bandeja e design system (#70); cartmel-1.2/1.3 cartório endurecido e banco em /var/lib (#69); basemel-1.5 teste da trava estável (#76); cartmel-1.7 segredo do cartório em arquivo 0600 (#75); app-1.2 tela inicial com 4 estados e saída segura (#74).

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
