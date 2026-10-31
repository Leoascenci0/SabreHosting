# Briefing bkp-2.2 — Restaurar com troca atômica

BASE: 3551d8c652d804278cd5b9edf7d7b8b3631aa2d7 · RAMO: roadmap/bkp-2.2 · MODELO: sonnet (esforço alto; revisão de integridade em Opus) · ISSUE: #61
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; references/integridade.md §3, §4 e §6
TRIAGEM: M1 (`abrirPacote` — extrai em pasta temporária conferindo tudo; `criarPacote`/`fazerBackup` para o backup do
estado atual; `temTrava` como em processo.ts) + M7 pequeno (troca) · ~120 linhas (+~180 teste) · risco ALTO (troca o
mundo) · MIÚDO: não. NÃO ESCREVER: outro extrator; tela; troca de host. PASSOS: `packages/nucleo/src/backup/restaurar.ts`:
`restaurarBackup({pacote, sha256, pastaDoMundo, pastaBackups, temTrava, servidorParado, versao, epoca})`:
1) recusa se o servidor estiver rodando (`servidorParado()` falso) ou sem trava (`temTrava()` com prazo, como no
processo.ts); 2) backup do estado atual com `criarPacote` (o mundo está parado, então é consistente) — se falhar, para
tudo sem tocar no mundo; 3) `abrirPacote` numa pasta temporária IRMÃ da pasta do mundo (mesmo disco, para o rename ser
atômico); 4) troca: `rename(mundo → mundo.antigo-<data>)` e `rename(temp → mundo)`; se o segundo falhar, desfaz o
primeiro; só depois de tudo certo apaga o `.antigo` (ou mantém, se pedido); 5) reconfere a trava logo antes da troca;
6) registra o resultado (devolve {backupDoAtual, restaurado}).
PROVA: falha no meio da extração → mundo original intacto (hashes iguais); falha entre os dois renames (injete) → mundo
original de volta; sem trava ou servidor rodando → nada muda; backup do estado atual existe e confere depois da
restauração; pacote com hash errado → nada muda. Só mundos de teste.

## Item (texto literal do roadmap)
- [ ] **2.2 — Restaurar com troca atômica**
  *O que fazer:* backup do estado atual → extrair em pasta temporária → conferir → `rename` → registrar. Exige trava (no
  modo local, trava local até o cartório existir).
  *Arquivo:* `packages/nucleo/src/backup/restaurar.ts`
  **Tela no app:** Backups › Restaurar (tela no app-2.x).
  *Confirmação:* teste: falha no meio da extração deixa o mundo original intacto.
  *Depende de:* bkp-2.1

## Decisões que valem para este item
- Regras de ouro 1, 3 e 4: só com trava; troca atômica; restaurar faz backup do estado atual antes.
- Apagar o mundo antigo depois da troca: só após a restauração conferida; nunca o backup do estado atual.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/bkp-2.2.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois); testes pesados com prazo explícito
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, `Closes #61` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
