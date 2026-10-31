# Briefing hostmel-1.3 — Testes de redirecionamento com sucesso e dos limites

BASE: 36c0d83bb0c9422a154904ec3ef553ee30a421b0 · RAMO: roadmap/hostmel-1.3 · MODELO: sonnet (gatilho Opus: nenhum)
ISSUE: #108
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre §1; §seguranca (download e hash); docs/memoria/solucoes.md S-01 (tempo curto em máquina ocupada)
TRIAGEM: M1 (só testes, reaproveitando o harness de baixar.test.ts) | ~60 linhas de teste | RISCO alto (download) | MIÚDO: não | REAPROVEITAR: topo de baixar.test.ts (servidor, responder(), manipulador, requisicoes, wrapper baixar() com permitirHttpLocal); teste de 301 para http (~290-301) como modelo; MAX_SALTOS = 5 e buscar() em baixar.ts; opção tempoTotal em OpcoesDownload | NÃO ESCREVER: servidor/harness novo se o atual servir; mudança em baixar.ts (é só teste — se o teste revelar defeito, pare e avise a orquestradora); fake timers (use tempoTotal curto real com servidor que goteja) | PASSOS: 1. redirecionamento https até o 200 final dentro do limite: baixa, hash confere, sem parcial; 2. um salto além do limite: recusa, sem arquivo final; 3. tempoTotal pequeno com servidor lento: "demorou demais", sem arquivo final; 4. mutação manual (não commitada): tirar salto >= MAX_SALTOS e o timer de tempoTotal → cada teste cai | ATENÇÃO: todo salto de redirecionamento exige https mesmo com permitirHttpLocal (hostmel-1.2). Para o caso de sucesso use servidor https local de teste (certificado gerado no próprio teste com node:crypto/openssl já disponível, CA passada só ao teste) — se exigir afrouxar baixar.ts, pare e avise | PROVA: cada teste falha quando a regra é removida; vistoria APROVADA; folga de tempo medida (S-01), sem afrouxar o que o teste prova.

## Item (texto literal do roadmap)
- [ ] **1.3 — Testes de redirecionamento com sucesso e dos limites**
  *O que fazer:* testes que seguem um redirecionamento https até o fim, que estouram o limite de 5 saltos e que
  estouram o tempo total.
  *Arquivo:* `packages/nucleo/src/servidor/baixar.test.ts`
  **Tela no app:** não se aplica.
  *Confirmação:* cada teste falha se a regra correspondente for removida.
  *Origem:* host-1.1 · PR #12 · qa

## Decisões que valem para este item
- Nenhuma nova; só teste.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/hostmel-1.3.md como primeiro commit
- [ ] Testes novos em packages/nucleo/src/servidor/baixar.test.ts (cada um cai com a mutação da regra)
- [ ] `npm run vistoria` APROVADA
- [ ] PR (Closes #108) com as seções do modelo e as linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), docs/imagens/ (não commitar
as PNGs regeradas), segredo (certificado de teste gerado em tempo de teste, nunca commitado). Nada além de baixar.test.ts (+ ajuda de teste se precisar).

## O que NÃO decidir (perguntar à orquestradora)
nada
