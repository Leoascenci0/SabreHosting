# Briefing basemel-1.5 — Teste da trava contra o cartório real estável sob carga

BASE: d7164b22ddb7f1be59ac6a145837cf2de3ac2353 · RAMO: roadmap/basemel-1.5 · MODELO: sonnet·medium · ISSUE: #73
SKILLS: using-superpowers, qualidade-sabre, systematic-debugging
LEIA: docs/memoria/solucoes.md S-01 (mesmo tipo de falha); qualidade-sabre §1; references/integridade.md (trava)
TRIAGEM (Máxima): M1 · ~10–30 linhas só no teste · risco MÉDIO (o teste protege a regra de ouro 1: não pode ficar mais frouxo no que prova) · MIÚDO: sim.
- Falha vista: `tests/integracao/hospedar-cartorio.test.ts` › "renovando, a trava passa do prazo e outro PC continua recusado; parou, solta" → `expected false to be true` (provável linha `expect(await renovador.temTrava()).toBe(true)` depois de `dormir(3 * TEMPOS.prazoMs)`), com outro vitest pesado rodando ao lado. Isolado: 8/8 verde.
- Causa provável (confirme com systematic-debugging antes de mexer): sob carga a renovação atrasa além do prazo local e o renovador desiste — comportamento CERTO do código (prazo local vence → solta); o teste é que usa tempos curtos demais para máquina ocupada. Corrigir no teste (tempos do teste maiores com margem medida, ou relógio controlado), nunca no código de produção. Se achar bug real no código, PARE e avise a orquestradora.
- Reproduza a falha antes (ex.: 4 `npx vitest run` em paralelo ou `stress`/laço de CPU ao lado) e prove depois.
NÃO ESCREVER: mudança em packages/nucleo ou services/cartorio; `retry` do vitest; aumentar timeout global.

## Item (texto literal)
- **1.5 — Teste da trava contra o cartório real estável sob carga** — trocar a espera por tempo real por relógio injetado ou dar folga medida (ver S-01). *Arquivo:* `tests/integracao/hospedar-cartorio.test.ts`. *Confirmação:* 4 `npx vitest run` em paralelo, 3 vezes seguidas, sem falha.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/basemel-1.5.md como primeiro commit
- [ ] Falha reproduzida antes (registre como no PR) e zero falhas depois (4 em paralelo × 3)
- [ ] `npm run vistoria` APROVADA; seção "Soluções" do PR com a ficha (sintoma, causa, solução, prova) — a Máxima soma em S-01
- [ ] PR com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), código de produção.

## O que NÃO decidir
Nada.
