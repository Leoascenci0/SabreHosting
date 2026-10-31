# Briefing syncmel-1.3

BASE: 0c5c96d3aee87149c2809f075dbb8922ac552b24 · RAMO: roadmap/syncmel-1.3 · MODELO: sonnet
SKILLS: using-superpowers, qualidade-sabre
LEIA: qualidade-sabre › references pertinentes ao tipo (integridade/seguranca/enxugar); docs/arquitetura.md só se precisar.
TRIAGEM: M1/M2 — acabamento em código existente; reaproveitar o que já há, escrever uma vez só (a filha confirma com grep antes).

## Item (texto literal do roadmap)
- [ ] **1.3 — Prova de que só pacote fechado sai pelo `arquivos(hash)`**
  *O que fazer:* quando o servidor for ligado ao app (sync-2.1), exigir teste de que só arquivos de pacotes registrados
  são servidos e de que `arquivos()` nunca devolve link simbólico nem caminho da pasta do mundo vivo.
  *Arquivo:* `packages/nucleo/src/sync/`
  **Tela no app:** não se aplica.
  *Confirmação:* teste com mundo inventado e link simbólico para fora → 404.
  *Origem:* sync-1.1 · PR #156 · qa segurança + qa integridade

## Decisões que valem para este item
Banda padrão 10 MB/s; nuvem NÃO é fonte do espalhar (decididos 31/10). Demais: docs/ops/DECISOES.md.

## Critério de pronto
- [ ] Plano em docs/agentes/planos/syncmel-1.3.md como primeiro commit
- [ ] Testes novos (falham antes, passam depois)
- [ ] `npm run vistoria` APROVADA (e, se mexer em infra/, também como usuário comum, S-03)
- [ ] PR com seções do modelo e linhas Triagem/Segurança/Integridade/Enxugamento/Roteamento, Regressão: e Tela no app:

## Fora do alcance
CLAUDE.md, .claude/, docs/roadmap-*.md, docs/MILESTONE.md, docs/agentes/ (exceto o plano), máquina da nuvem real, mundo real, segredos.

## O que NÃO decidir
Nada: dúvida de regra do grupo vira pergunta à sessão de onda.
