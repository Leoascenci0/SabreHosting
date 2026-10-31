# Briefing basemel-1.6 — Quarto teste da trava com folga medida

BASE: 852b89fbdac9b3aa6322651a9e086aee7e304093 · RAMO: roadmap/basemel-1.6 · MODELO: sonnet·medium (gatilho Opus: nenhum) · ISSUE: #121
SKILLS: using-superpowers, qualidade-sabre, systematic-debugging
LEIA: docs/memoria/solucoes.md S-01 (mesmo tipo de falha) e S-03; qualidade-sabre §1; §integridade (trava)
TRIAGEM (Máxima): M1 · ~10–30 linhas só no teste · risco MÉDIO (o teste protege a regra de ouro 1: não pode ficar mais frouxo no que prova) · MIÚDO: não. Molde: o que o basemel-1.5 (PR #76) fez no 1º teste do mesmo arquivo. Atenção: o hostmel-2.5 (PR #114, já na main) mexeu neste arquivo (o spawn agora passa pelo vigia); identifique o "4º teste" pela folga de ~700 ms na main atual.
- Reproduza a falha antes (4 `npx vitest run tests/integracao/hospedar-cartorio.test.ts` em paralelo + laço de CPU ao lado, ex. `node -e "for(;;){}"` x núcleos) e prove depois (3 vezes, zero falha).
NÃO ESCREVER: mudança em packages/nucleo ou services/cartorio; retry do vitest; timeout global maior.

## Item (texto literal do roadmap)
- [ ] **1.6 — Quarto teste da trava com folga medida**
  *O que fazer:* em `tests/integracao/hospedar-cartorio.test.ts`, o 4º teste (folga de ~700 ms) ainda estoura sob carga
  extrema de CPU; aplicar o mesmo tratamento do basemel-1.5 (tempos folgados só onde o teste exige a trava viva, prazo
  explícito), sem afrouxar o que ele prova.
  *Arquivo:* `tests/integracao/hospedar-cartorio.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* 4 `npx vitest run` em paralelo com laço de CPU ao lado, 3 vezes, sem falha.
  *Origem:* basemel-1.5 · PR #76 · filha (achado baixo)

## Critério de pronto
- [ ] Plano em docs/agentes/planos/basemel-1.6.md como primeiro commit
- [ ] Falha reproduzida antes e zero falhas depois (cole as contagens no PR, como no #76)
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #121) com linha Regressão:, seções do modelo e Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/ (não commitar
as PNGs regeradas). Só tests/integracao/hospedar-cartorio.test.ts.

## O que NÃO decidir (perguntar à orquestradora)
nada
