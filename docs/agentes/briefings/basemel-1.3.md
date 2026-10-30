# Briefing basemel-1.3 — Testes estáveis sob carga

BASE: f3dd8a21aa27ebc064049742a4a82897b7768d58 · RAMO: roadmap/basemel-1.3 · MODELO: sonnet · ISSUE: #39
SKILLS: using-superpowers, qualidade-sabre, systematic-debugging
LEIA: qualidade-sabre §1; references/integridade.md §6
TRIAGEM: M4 (correção pontual de teste) · ~30–60 linhas · risco médio (toca o teste que prova a regra de ouro 1) ·
MIÚDO: não. NÃO ESCREVER: mudança no código de produção da trava; afrouxar a garantia "exatamente 1 ganha por
rodada" nem reduzir o número de workers/rodadas; `retry` de teste. PASSOS: 1) reproduzir: rode 4 `npx vitest run` em
paralelo (`&` + `wait`) e veja a falha "expected Set{ 16, 20 } to deeply equal Set{ 16 }" em trava.test.ts:81;
2) corrigir pela causa (sincronizar as rodadas entre os workers — barreira — ou comparar só que a época vista pelo
perdedor é ≥ a do vencedor DAQUELA rodada, mantendo "exatamente 1 ganha"); 3) prazo explícito de 30 s nos testes de
20 MB de `packages/nucleo/test/mundos.test.ts` e `packages/nucleo/src/backup/manifesto.test.ts` (não mexa em
`pacote.test.ts`: o bkp-1.2 já cuida dele).
PROVA: 4 `npx vitest run` em paralelo, 3 vezes seguidas, sem falha (cole a saída no PR); sabotar a trava para deixar 2
ganharem continua quebrando o teste.

## Item (texto literal do roadmap de melhoria)
- [ ] **1.3 — Testes estáveis sob carga**
  *O que fazer:* o teste de corrida da trava (`services/cartorio/src/trava.test.ts`, "10 workers … 20 rodadas") exige que
  os perdedores vejam a época da MESMA rodada; sob carga, um perdedor atrasado lê a época de uma rodada seguinte e o
  teste falha (a garantia "exatamente 1 ganha" continua valendo). Sincronizar as rodadas (barreira: a rodada N+1 só
  começa quando todos os workers responderam a N) ou conferir só que a época vista pelo perdedor é ≥ a do vencedor.
  Prazo explícito (30 s) nos testes pesados de 20 MB (`packages/nucleo/test/mundos.test.ts`,
  `packages/nucleo/src/backup/manifesto.test.ts`). Achado na Onda 6: 1 falha em 15 rodadas normais; 2–4 falhas por
  rodada com 4 vitest em paralelo.
  *Arquivo:* `services/cartorio/src/trava.test.ts`, `services/cartorio/src/trava-corrida.worker.mjs`, os testes citados
  **Tela no app:** não se aplica.
  *Confirmação:* 4 `npx vitest run` em paralelo, 3 vezes seguidas, sem falha.
  *Origem:* onda 6 · revisão da orquestradora

## Decisões que valem para este item
- Regra de ouro 1; o teste de corrida é a prova dela: não pode ficar mais fraco.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/basemel-1.3.md como primeiro commit
- [ ] `npm run vistoria` APROVADA e a prova de carga no PR
- [ ] PR com `Closes #39` e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento; seção "Soluções" com
      sintoma, causa, solução e prova (vira ficha em docs/memoria/solucoes.md)

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), qualquer segredo.

## O que NÃO decidir (perguntar à orquestradora)
Nada.
