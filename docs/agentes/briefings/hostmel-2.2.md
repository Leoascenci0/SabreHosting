# Briefing hostmel-2.2 — Workers da medição: corte e falha

BASE: 1dd817d7b4130ffc46f04555aee45c1c5d58e9e9 · RAMO: roadmap/hostmel-2.2 · MODELO: haiku (MIÚDO) · ISSUE: #136
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1 e §enxugar
TRIAGEM: M4 (+M1) | ~35 linhas (≈5 produção + ≈30 teste) | RISCO baixo | MIÚDO: sim | REAPROVEITAR: medirPc e o setTimeout/controle.abort do teto em packages/nucleo/src/nota/medir.ts:42-52; rodarLaco medir.ts:20; teste de corte medir.test.ts:5 (padrão lenta) | NÃO ESCREVER: mecanismo novo de teto/cancelamento; nada em formula.ts, cartório, tela ou E2E | PASSOS: 1. teste: medirPc({ uploadMbps: 10, tetoMs: 300, janelaMs: 5000, cpuUmNucleo: async () => 1 }) rejeita com /passou de/ e termina em < ~2 s; 2. bug: quando um rodarLaco rejeita, o Promise.all (medir.ts:55) rejeita mas o controle não é abortado — envolver em try/catch que chama controle.abort(erro) e relança; 3. gancho só de teste (ex. cpuNucleo?: (sinal) => Promise<number>, no molde de cpuUmNucleo) para provar: um worker falha e os demais saem (sinal.aborted em todos) | PROVA: testes falham antes e passam depois; vistoria APROVADA.

## Item (texto literal do roadmap)
- [ ] **2.2 — Workers da medição: corte e falha**
  *O que fazer:* teste do corte por tempo na fase de vários núcleos; ao um worker falhar, abortar os demais.
  *Arquivo:* `packages/nucleo/src/nota/medir.ts`, `packages/nucleo/src/nota/medir.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* testes terminam rápido e nenhum worker fica vivo.
  *Origem:* host-2.3 · PR #16 · filha + qa

## Critério de pronto
- [ ] Plano em docs/agentes/planos/hostmel-2.2.md como primeiro commit
- [ ] Testes novos em packages/nucleo/src/nota/medir.test.ts
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #136) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/. Só nota/medir.ts e o teste.

## O que NÃO decidir (perguntar à orquestradora)
nada
