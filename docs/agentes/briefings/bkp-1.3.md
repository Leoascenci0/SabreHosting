# Briefing bkp-1.3 — Backup consistente com o servidor rodando

BASE: 6c0ca14942d125fc76a2b6addf138fda94a3cdc6 · RAMO: roadmap/bkp-1.3 · MODELO: sonnet (esforço alto; revisão com duas lentes) · ISSUE: (criada pela orquestradora)
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; references/integridade.md §2 e §4; references/desempenho.md
TRIAGEM: M1 (reaproveitar `salvarSeguro` de servidor/comandos.ts — já faz save-off → save-all flush → copiar → save-on no
finally — e `criarPacote` de backup/pacote.ts) + M7 pequeno (agendador) · ~100 linhas (+~150 teste) · risco ALTO ·
MIÚDO: não. NÃO ESCREVER: outro fluxo de save-off/save-on (use `salvarSeguro`); outro empacotador; rotação (é bkp-2.1);
envio ao cartório (é cart-1.4/sync). PASSOS: 1) `packages/nucleo/src/backup/agendador.ts`:
`fazerBackup({servidor, pastaDoMundo, pastaBackups, versao, epoca})` = `salvarSeguro(servidor, () => criarPacote(...))`;
o pacote vai para `<pastaBackups>/<data>-v<versao>.tar.gz` (gravação já atômica no criarPacote); devolve {caminho,
sha256, tamanho, duracaoMs}; 2) `agendarBackups({intervaloMin = 10, ...})`: um backup por vez (se o anterior ainda roda,
pula e avisa), só com o servidor "pronto", relógio injetado; `parar()` cancela o timer e espera o backup em curso;
3) se o servidor cair no meio, o pacote parcial é descartado e o erro sai em pt-BR.
PROVA: servidor falso: `save-on` volta mesmo se o pacote falhar; nenhuma leitura do mundo entre `save-off` e o
`Saved the game` (espione o `criarPacote`/fs e prove que começou só depois); dois disparos seguidos não fazem 2 backups
simultâneos; intervalo configurável; `parar()` sem timer pendurado; mundo de teste de 1 MB.

## Item (texto literal do roadmap)
- [ ] **1.3 — Backup consistente com o servidor rodando**
  *O que fazer:* orquestrar `save-off` → `save-all flush` → manifesto+pacote → `save-on` (sempre, mesmo em erro);
  agendado a cada X minutos.
  *Arquivo:* `packages/nucleo/src/backup/agendador.ts`
  **Tela no app:** Configurações › Backups › Intervalo (padrão 10 min).
  *Confirmação:* teste com servidor falso: `save-on` volta mesmo se o pacote falhar; nada é lido entre `save-off` e o flush.
  *Depende de:* bkp-1.2, host-2.2

## Decisões que valem para este item
- Regra de ouro 2: nunca copiar o mundo com o servidor gravando — só dentro do `salvarSeguro`.
- Intervalo padrão 10 min ("Configurações › Backups › Intervalo", tela no app-2.2).

## Critério de pronto
- [ ] Plano em docs/agentes/planos/bkp-1.3.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois); nada pendurado
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo, `Closes #<issue>` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real,
mundo real dos amigos, qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
