# Coordenação da Máxima — 31/10/2026 (dia)

- Coordenadora: session_012qrjnuauHQWFgAgmdzp4Fv (ramo `claude/serene-pasteur-xy85h8`), aberta 09:10 com `/maxima retomar`.
- Turno: dia. Autorizações do Eliel (09:12): Onda 20 com os 5 itens; merge pela Máxima com vistoria + `qa`; nada na
  máquina da nuvem de verdade nem no mundo real.
- Próximo número de onda livre: 26.
- Autorização 10:00: "Pode, e siga sozinha" — rodar as próximas ondas sem perguntar; parar só em item P.

## Ondas

| Onda | Itens | Sessão | Base | Estado |
|---|---|---|---|---|
| 20 | cartmel-1.1 · app-2.1 · sync-1.1 · app-2.2 · sync-1.2 | session_012qrjntSMKMZcY3GUuomfqa | bdee520 | fechada 09:59 → main 0b57326 |
| 21 | syncmel-1.4 · appmel-1.7 · cartmel-2.2 · syncmel-1.1 · syncmel-1.2 · appmel-1.8 | session_012qrjnuVvPbMbr49Ryg8nY3 | 0b57326 | fechada 10:36 → main 5f440cc |
| 22 | appmel-1.10 · syncmel-1.5 · piloto-1.1 · syncmel-1.6 · sync-2.1 · drive-1.1 | session_012qrjntw8ggfpCSw7mg4UfD (1ª: …AzcormV8 falhou, hash curto, S-09) | 5f440cc | fechada 11:33 → main 722501a |
| 23 | appmel-1.11 · syncmel-1.8 · piloto-1.1 · Dependabot #95/#96 · hostmel-3.1 · drive-1.1b | session_012qrjnrPqSYeU1jDzU3Fmqk | 37baba7 | fechada 13:34 → main 565b9ee |
| 24 | hostmel-3.1b→c→d · piloto-1.1b→c · espalhar no app | session_012qrjntg73vm87TWPY1tzjP | 565b9ee | fechada 14:27 → main 0762634 |
| 25 | cartmel-2.5 · syncmel-1.9 · syncmel-1.7 · syncmel-1.3 · backup antes de trocar versão · migra-2.1 | session_012qrjntCnjHafcdk8F9QU2a | 0762634 | fechada 15:08 → main 1253600 |

## Relatórios das ondas

- **Onda 20** (09:59): ✅ cartmel-1.1 #154 · sync-1.1 #156 · app-2.1 #157 · sync-1.2 #158 · app-2.2 #160 (corte Geral+Servidor)
  · cartmel-2.3 #161 (novo, destrava "Tirar PC") · controle #162. ⏸️ nenhum. P: nenhum. Decidi por você: "De quem" nos
  backups = "Este PC"; token do sync = token por PC conferido pelo cartório; app-2.2 cortado e tela em ui/. Custo n/d.
  main 0b57326 vistoria APROVADA. Sugeridos: appmel-1.7, syncmel-1.4, syncmel-1.1, appmel-1.8/1.9, sync-2.1.
- **Onda 21** (10:36): ✅ cartmel-2.2 #163 · appmel-1.7 #165 · syncmel-1.4 #164 · syncmel-1.1 #166 · appmel-1.8 #167 (só
  intervalo) · syncmel-1.2 #168 · controle #169. P: appmel-1.11 (ligar rotação + "Quantos guardar": apaga backup);
  redemel-1.3 (tirar peer ao revogar: WireGuard real na nuvem). Decidi por você: appmel-1.8 sem rotação; sync 60 s ocioso/10 s
  cabeçalho/16 conexões; token revogado vale até 30 s no sync; trava vence em até 60 s (doc corrigida). 4 devoluções.
  Fichas S-06, S-07 → promovidas ao CLAUDE.md pela coordenadora. Custo n/d. main 5f440cc APROVADA.
- **Onda 22** (11:33): ✅ appmel-1.10 #171 · syncmel-1.5 #170 (+b no #173) · syncmel-1.6 #172 · sync-2.1a #173 · drive-1.1a #174
  · controle #175. ⏸️ piloto-1.1 (zip = dependência nova, P); drive-1.1b (rotação na pasta: coberta pela decisão 10+7 dias).
  P: syncmel-1.8 (trava de atualização separada × só sem host); zip do piloto. Custo US$ 7,78. main 722501a APROVADA.
  Ficha S-08 da onda (socket cru) colidiu com a S-08 da coordenação → a da coordenação virou S-09.
- **Onda 23** (13:34): ✅ appmel-1.11 #179 · syncmel-1.8a #178 + 1.8b #182 · piloto-1.1a #177 (yauzl 3.4.0) · hostmel-3.1a #180 ·
  drive-1.1b #181 · Dependabot #95/#96 · controle #183. P: nenhum. Decidi por você: rotação = N mais novos + tudo dos
  últimos 7 dias; marcas bom/ruim no app; rotação na pasta sincronizada apaga também na nuvem (tela avisa); versão: loaders
  consultados na hora com "sem mods" de reserva. Custo ~US$ 15,0. main 565b9ee APROVADA. Ficha S-10 → CLAUDE.md.
- **Onda 24** (14:27): ✅ hostmel-3.1b #186 · 3.1c #188 · 3.1d #185 · piloto-1.1b #184 · 1.1c #189 · cartmel-2.4 #187 · controle #190.
  ⏸️ sync-2.1b → syncmel-1.9. P: sha1 do NeoForge 1.20.1 (maven.neoforged.net bloqueado na nuvem); importar o mundo real
  (tutorial docs/tutoriais/piloto-importar.md); PORTA_ESPALHAR=25570 → decidido pela coordenadora (fica). Custo ~US$ 15,2
  (1.1c em Opus 8,37). main 0762634 APROVADA. Ficha S-11 → CLAUDE.md.
- **Onda 25** (15:08): ✅ cartmel-2.5 #194 · syncmel-1.7 #191 · syncmel-1.9a #192 · hostmel-3.2 #193 · syncmel-1.10 #195 ·
  migra-2.1 #197 (Opus) · controle #198. P: nenhum. Decidi por você: banda padrão 10 MB/s; versão órfã fica registrada
  sem prazo. Custo ~US$ 10,2. main 1253600 APROVADA. Sugeridos: syncmel-1.9b (tela de banda), syncmel-1.3, syncmel-1.11,
  hostmel-3.3; migra-2.2 depende de rede-2.2.

## Bastão

Passado às 15:10 (6 ondas, contexto 29%, custo US$ 5,09) → ver linha abaixo.
Eliel (14:30): vai liberar maven.neoforged.net e repo.papermc.io; a Onda 26 confere com curl e puxa rede-2.2 + hashes NeoForge 1.20.1.
