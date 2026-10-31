# Briefing syncmel-1.7 — Isolar headersTimeout de requestTimeout num teste

BASE: 07626345350607c80302a72f0f0bb4a9b403e388 · RAMO: roadmap/syncmel-1.7 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; integridade §6; solucoes.md S-01 e S-08
TRIAGEM: M1, ~30 linhas + ~20 teste. Reaproveitar opção de teste tempoOciosoMs (transferencia.ts ~48, ~186). Passos: 1) OpcoesServidor ganha tempoCabecalhoMs?, tempoRequisicaoMs? e intervaloConferenciaMs? (só teste; padrão = constantes atuais); 2) ligar server.connectionsCheckingInterval ao intervalo injetado (senão o Node confere a cada ~30 s); 3) testes com valores diferentes (ex.: cabeçalho 1 s, requisição 4 s) para cada prazo ter prova própria; 4) provar que remover só um prazo faz um teste falhar (mostre no PR). NÃO mudar constantes de produção; nada em espalhar.ts/aplicar.ts. Meça o tempo do arquivo de teste antes e depois (hoje >31 s).

## Item (texto literal do roadmap, em docs/roadmap-sync-melhoria.md, item 1.7)
- [ ] **1.7 — Isolar `headersTimeout` de `requestTimeout` num teste**
  *O que fazer:* expor os prazos do servidor como opção de teste (ou usar valores diferentes) para que cada um tenha prova própria; o teste de cabeçalho lento de hoje gasta ~30 s reais (Node confere a cada ~30 s): com prazos injetáveis cai para segundos.
  *Arquivo:* `packages/nucleo/src/sync/transferencia.ts`, `transferencia.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* teste novo que falha ao remover só um dos dois prazos; arquivo de teste mais rápido que os 31 s de hoje.
  *Origem:* syncmel-1.6 · PR #172 · filha + qa integridade

## Decisões que valem para este item
syncmel-1.70

## Soluções conhecidas que se aplicam
S-01 (teste de tempo: folga/prazo explícito só no teste), S-06 (token de geração antes de qualquer await; agendador único), S-07 (caminho/marcador lido do disco é entrada não confiável), S-08 (socket cru: s.resume(); prazo de cabeçalho do Node corta em ~30 s), S-09 (hash completo), S-10 (PR de correção traz linhas "Regressão:" e "Tela no app:"), S-11 (no commit/PR, não escreva a flag que pula o pre-commit nem dentro de heredoc). Rodar vistorias uma de cada vez.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/syncmel-1.7.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento/Regressão/Tela no app

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada além do que está nas decisões acima.
